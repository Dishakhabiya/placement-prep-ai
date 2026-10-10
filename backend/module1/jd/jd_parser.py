import re
from typing import Dict, List, Any, Set
from module1.parsing.clean import clean_text
from module1.matching.normalize import _TAXONOMY, _ALIASES, normalize_skill, normalize_skill_list

# Common job title patterns
TITLE_PATTERNS = [
    r"(?:job\s*title|role|position|designation)\s*:\s*([^\n\r]+)",
    r"(?:looking\s+for|hiring)\s+(?:an?|our\s+next)\s+([A-Z][A-Za-z0-9\s\/\-\+]+(?:Engineer|Developer|Scientist|Architect|Lead|Intern|Specialist|Analyst|Consultant))",
    r"^([A-Z][A-Za-z0-9\s\/\-\+]+(?:Engineer|Developer|Scientist|Architect|Lead|Intern|Specialist|Analyst|Consultant))"
]

# Section headers strictly matching heading lines
REQUIRED_HEADERS = [
    r"minimum\s+qualifications?",
    r"requirements?",
    r"what\s+you\s+need",
    r"who\s+you\s+are",
    r"must\s+haves?",
    r"qualifications?"
]

PREFERRED_HEADERS = [
    r"preferred\s+qualifications?",
    r"nice\s+to\s+haves?",
    r"good\s+to\s+haves?",
    r"bonus\s+points?",
    r"preferred\s+skills?",
    r"preferred"
]

RESPONSIBILITY_HEADERS = [
    r"responsibilit(?:y|ies)",
    r"what\s+you(?:'ll|\s+will)\s+do",
    r"duties",
    r"day\s+to\s+day",
    r"key\s+deliverables?",
    r"about\s+the\s+role",
    r"role\s+overview"
]

REQUIRED_INLINE_CUES = [
    r"must\s+have",
    r"required",
    r"mandatory",
    r"essential",
    r"proficiency\s+in",
    r"strong\s+knowledge",
    r"expertise\s+in",
    r"hands-on"
]

PREFERRED_INLINE_CUES = [
    r"preferred",
    r"nice\s+to\s+have",
    r"good\s+to\s+have",
    r"plus",
    r"bonus",
    r"desired",
    r"optional",
    r"familiarity\s+with"
]


def extract_skills_from_text(text: str) -> List[str]:
    """
    Extracts known skills from arbitrary text using regex boundary matching
    against the taxonomy and alias dictionaries.
    """
    if not text:
        return []

    found_skills: Set[str] = set()

    for category, skills in _TAXONOMY.items():
        for skill in skills:
            escaped = re.escape(skill)
            if re.search(r"\b" + escaped + r"\b", text, re.IGNORECASE):
                found_skills.add(skill)
            elif skill.lower() in ["c++", "c#", ".net", "node.js", "vue.js", "next.js"]:
                pattern = rf"(?<![a-zA-Z0-9]){escaped}(?![a-zA-Z0-9])"
                if re.search(pattern, text, re.IGNORECASE):
                    found_skills.add(skill)

    for alias, canonical in _ALIASES.items():
        escaped = re.escape(alias)
        if re.search(r"\b" + escaped + r"\b", text, re.IGNORECASE):
            found_skills.add(canonical)
        elif alias.lower() in ["c++", "c#", "node.js", "react.js", "express.js"]:
            pattern = rf"(?<![a-zA-Z0-9]){escaped}(?![a-zA-Z0-9])"
            if re.search(pattern, text, re.IGNORECASE):
                found_skills.add(canonical)

    return normalize_skill_list(list(found_skills))


def parse_job_description(jd_text: str) -> Dict[str, Any]:
    """
    Parses raw Job Description into structured schema:
    - title: detected job title
    - required_skills: mandatory skills
    - preferred_skills: preferred/optional skills
    - responsibilities: list of actionable responsibility statements
    """
    cleaned_jd = clean_text(jd_text)
    lines = [line.strip() for line in cleaned_jd.split("\n") if line.strip()]

    # 1. Extract Job Title
    title = ""
    for pattern in TITLE_PATTERNS:
        match = re.search(pattern, cleaned_jd, re.IGNORECASE | re.MULTILINE)
        if match:
            raw_title = match.group(1).strip().strip("-:| ")
            if 3 <= len(raw_title) <= 60:
                title = raw_title
                break

    if not title and lines:
        first_line = lines[0].strip("#- \t")
        if len(first_line) < 50 and any(keyword in first_line.lower() for keyword in ["engineer", "developer", "intern", "scientist", "analyst", "architect"]):
            title = first_line
        else:
            title = "Software Engineer"

    # 2. Segment JD into sections or sentence blocks
    current_mode = "general"
    required_blocks: List[str] = []
    preferred_blocks: List[str] = []
    responsibility_blocks: List[str] = []
    general_blocks: List[str] = []

    for line in lines:
        lower_line = line.lower().strip()

        # Check if line is strictly a standalone section header (e.g. "Requirements:", "Responsibilities:")
        is_short_header = len(lower_line) <= 35 and (lower_line.endswith(":") or not any(lower_line.startswith(p) for p in ["-", "•", "*"]))

        is_pref_header = is_short_header and any(re.match(rf"^[\-=\*_#\s]*{c}[\s:]*$", lower_line) for c in PREFERRED_HEADERS)
        is_req_header = is_short_header and any(re.match(rf"^[\-=\*_#\s]*{c}[\s:]*$", lower_line) for c in REQUIRED_HEADERS)
        is_resp_header = is_short_header and any(re.match(rf"^[\-=\*_#\s]*{c}[\s:]*$", lower_line) for c in RESPONSIBILITY_HEADERS)

        if is_pref_header:
            current_mode = "preferred"
            continue
        elif is_req_header:
            current_mode = "required"
            continue
        elif is_resp_header:
            current_mode = "responsibilities"
            continue

        # Check in-line cues
        if any(re.search(c, lower_line) for c in PREFERRED_INLINE_CUES):
            preferred_blocks.append(line)
        elif any(re.search(c, lower_line) for c in REQUIRED_INLINE_CUES):
            required_blocks.append(line)
        elif current_mode == "preferred":
            preferred_blocks.append(line)
        elif current_mode == "required":
            required_blocks.append(line)
        elif current_mode == "responsibilities":
            responsibility_blocks.append(line)
        else:
            general_blocks.append(line)

    # 3. Extract skills for each category
    required_skills = extract_skills_from_text("\n".join(required_blocks))
    preferred_skills = extract_skills_from_text("\n".join(preferred_blocks))

    # General skills fall into required if not yet assigned
    general_skills = extract_skills_from_text("\n".join(general_blocks))
    for s in general_skills:
        if s not in required_skills and s not in preferred_skills:
            required_skills.append(s)

    # If required_skills is still empty, scan whole text
    if not required_skills and not preferred_skills:
        all_skills = extract_skills_from_text(cleaned_jd)
        required_skills = all_skills[:int(len(all_skills)*0.75)]
        preferred_skills = all_skills[int(len(all_skills)*0.75):]

    # Required takes precedence over preferred
    preferred_skills = [s for s in preferred_skills if s not in required_skills]

    # 4. Extract responsibilities
    responsibilities: List[str] = []
    for block in responsibility_blocks:
        clean_resp = block.lstrip("-*•> \t").strip()
        if len(clean_resp) > 15 and not any(clean_resp.lower().startswith(h) for h in ["requirement", "qualification", "must have", "about"]):
            responsibilities.append(clean_resp)

    if not responsibilities:
        action_verbs = r"^(?:develop|build|design|implement|maintain|collaborate|create|work|lead|optimize|architect|write|deploy|manage|support|conduct|deliver|ensure)"
        for line in lines:
            clean_l = line.lstrip("-*•> \t").strip()
            if len(clean_l) > 20 and re.match(action_verbs, clean_l, re.IGNORECASE):
                responsibilities.append(clean_l)

    if not responsibilities and lines:
        for line in lines[:8]:
            clean_l = line.lstrip("-*•> \t").strip()
            if len(clean_l) > 25:
                responsibilities.append(clean_l)
                if len(responsibilities) >= 4:
                    break

    return {
        "title": title,
        "required_skills": normalize_skill_list(required_skills),
        "preferred_skills": normalize_skill_list(preferred_skills),
        "responsibilities": responsibilities[:8]
    }
