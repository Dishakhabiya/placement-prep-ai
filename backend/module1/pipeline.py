import re
import uuid
from typing import Dict, List, Any, Union
from module1.parsing.extract_text import extract_text
from module1.parsing.clean import clean_text
from module1.parsing.sections import split_into_sections
from module1.matching.normalize import normalize_skill_list
from module1.jd.jd_parser import parse_job_description, extract_skills_from_text
from module1.matching.gap import compute_skill_gap_and_score
from module1.matching.project_links import link_projects_to_responsibilities
from module1.context.topic_builder import build_ranked_interview_topics
from module1.ner.infer import extract_entities


def _clean_bullet_text(text: str) -> str:
    """Strips leading bullet points, markdown symbols, and edge punctuation."""
    if not text:
        return ""
    return re.sub(r"^[\s\-\*•\u2022\u25cf\u25aa\u25b6\d\.\)\:\_]+\s*", "", text).strip()


def _is_glyph_or_artifact(text: str) -> bool:
    """Detects font icon glyphs (e.g. isolated 'G' for GitHub logo), standalone markers, or empty strings."""
    cleaned = _clean_bullet_text(text)
    if not cleaned or len(cleaned) <= 2:
        return True
    if cleaned.lower() in ["g", "f", "github", "github link", "link", "demo", "code", "[github link]", "[link]"]:
        return True
    return False


def _is_invalid_project_title(title: str, current_proj_title: str = None) -> bool:
    """
    Returns True if the line cannot be a valid standalone project title:
    e.g., date ranges, links, action verb sentence fragments, sub-platform tags, or tech stack lines.
    """
    if not title:
        return True

    clean = title.strip()
    clean_lower = clean.lower()

    # 1. Date ranges or temporal keywords (e.g. 'Sep 2025 - Present', '2023 - 2024', 'Jan 2022 - Dec 2022')
    date_pattern = r"(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{4})\s*[-–—to/]+\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{4}|present|current|ongoing)"
    if re.search(date_pattern, clean_lower):
        return True
    if re.match(r"^(?:present|ongoing|current|\d{4})$", clean_lower):
        return True
    if re.search(r"^\d{1,2}/\d{4}\s*[-–—]\s*(?:\d{1,2}/\d{4}|present)", clean_lower):
        return True

    # 2. Links, store references, repository keywords
    link_keywords = {
        "testflight", "test flight", "app store", "appstore", "play store", "playstore",
        "google play", "github", "gitlab", "bitbucket", "live demo", "demo", "link",
        "website", "preview", "source code", "repo", "repository", "apk", "url"
    }
    unbracketed = re.sub(r"[\[\]\(\)\:\-–—|]", " ", clean_lower).strip()
    unbracketed = re.sub(r"\s+", " ", unbracketed)
    if unbracketed in link_keywords or unbracketed.startswith("http") or unbracketed.startswith("www"):
        return True

    has_store_link = bool(re.search(r"\[\s*(?:testflight|app\s*store|play\s*store|github|gitlab|demo|link|website|apk|code)", clean_lower))
    if has_store_link and len(clean) < 55:
        return True

    # 3. Action verbs or sentence fragments (e.g. 'serving 150+ users.', 'architected an offline-first...')
    if clean[0].islower():
        return True

    action_verbs = {
        "serving", "served", "architected", "architecting", "developed", "developing",
        "built", "building", "designed", "designing", "implemented", "implementing",
        "created", "creating", "engineered", "engineering", "spearheaded", "spearheading",
        "led", "leading", "managed", "managing", "worked", "working", "leveraged",
        "leveraging", "utilized", "utilizing", "using", "reduced", "reducing",
        "increased", "increasing", "improved", "improving", "optimized", "optimizing",
        "collaborated", "collaborating", "contributed", "contributing", "maintained",
        "maintaining", "deployed", "deploying", "integrated", "integrating", "enabled", "enabling"
    }
    first_word = re.split(r"[\s,\.\-]+", clean_lower)[0]
    if first_word in action_verbs:
        return True

    # 4. Tech stack / tools labels
    if re.match(r"^(?:tech(?:nolog(?:y|ies))?|tools?|skills?|environment|stack)\b", clean_lower):
        return True

    # 5. Sub-platform tags or sub-bullet variants of current project
    # e.g. If current project is 'Cyster', lines like 'CysteriOS', 'CysterAndroid', 'iOS', 'Android'
    if current_proj_title:
        base_name = re.split(r"[\s\-–—:|]+", current_proj_title.strip())[0].lower()
        if len(base_name) >= 3 and clean_lower.startswith(base_name):
            rem = clean_lower[len(base_name):].strip(" \t\-_:|/[]()")
            platform_tokens = ("ios", "android", "web", "app", "mobile", "frontend", "backend")
            for pt in platform_tokens:
                if rem.startswith(pt):
                    return True
        if clean_lower in {"ios", "android", "web", "frontend", "backend"}:
            return True

    # 6. Sentence ending in period with multiple words
    if clean.endswith(".") and len(clean.split()) > 2 and (" " in clean):
        return True

    return False


def _extract_projects(project_section_text: str) -> List[Dict[str, Any]]:
    """Parses project section into list of {title, description, tech} items with artifact and date filtering."""
    if not project_section_text:
        return []

    raw_lines = [l.strip() for l in project_section_text.split("\n") if l.strip()]
    projects = []
    current_proj = None

    for line in raw_lines:
        if _is_glyph_or_artifact(line):
            # Glyph line signals previous project closed
            if current_proj and len(current_proj["title"]) > 2:
                projects.append(current_proj)
                current_proj = None
            continue

        clean_line = _clean_bullet_text(line)
        if not clean_line:
            continue

        # Check if line cannot be a project title (dates, links, verbs, platform tags)
        curr_title = current_proj["title"] if current_proj else None
        if _is_invalid_project_title(clean_line, curr_title):
            # This line belongs to the description/tech of current project
            if current_proj:
                current_proj["description"] = (current_proj["description"] + " " + clean_line).strip()
                more_tech = extract_skills_from_text(clean_line)
                for t in more_tech:
                    if t not in current_proj["tech"]:
                        current_proj["tech"].append(t)
            continue

        # Is this line a sub-bullet description point?
        is_sub_bullet = line.startswith(("-", "*", "–", "↳"))

        # Check if line looks like a new project title
        is_new_project = (
            current_proj is None
            or (not is_sub_bullet and len(clean_line) < 80 and current_proj.get("description"))
            or (not is_sub_bullet and line.startswith(("•", "1.", "2.", "3.", "4.", "5.")))
        )

        clean_title = re.sub(r"\[\s*(?:github|link|demo)\s*(?:link)?\s*\]", "", clean_line, flags=re.I).strip()
        # Clean trailing separators like ' -', ' |', ':'
        clean_title = re.sub(r"[\s\-–—:|]+$", "", clean_title).strip()

        if is_new_project and clean_title:
            if current_proj and len(current_proj["title"]) > 2:
                projects.append(current_proj)
            current_proj = {
                "title": clean_title[:75],
                "description": clean_line,
                "tech": extract_skills_from_text(line)
            }
        else:
            if current_proj:
                current_proj["description"] = (current_proj["description"] + " " + clean_line).strip()
                more_tech = extract_skills_from_text(clean_line)
                for t in more_tech:
                    if t not in current_proj["tech"]:
                        current_proj["tech"].append(t)
            else:
                if clean_title:
                    current_proj = {
                        "title": clean_title[:75],
                        "description": clean_line,
                        "tech": extract_skills_from_text(line)
                    }

    if current_proj and len(current_proj["title"]) > 2:
        projects.append(current_proj)

    # Clean and validate extracted projects
    valid_projects = []
    seen_titles = set()
    for p in projects:
        clean_title = _clean_bullet_text(p["title"])
        clean_title = re.sub(r"\[\s*(?:github|link|demo)\s*(?:link)?\s*\]", "", clean_title, flags=re.I).strip()
        clean_title = re.sub(r"[\s\-–—:|]+$", "", clean_title).strip()
        if (
            not _is_glyph_or_artifact(clean_title)
            and not _is_invalid_project_title(clean_title)
            and len(clean_title) > 2
            and clean_title.lower() not in seen_titles
        ):
            p["title"] = clean_title
            seen_titles.add(clean_title.lower())
            if not p.get("tech"):
                p["tech"] = extract_skills_from_text(f"{p['title']} {p.get('description', '')}")
            valid_projects.append(p)

    return valid_projects[:6]


def _extract_bullet_list(section_text: str) -> List[str]:
    """Extracts clean bullet items or lines from a section."""
    if not section_text:
        return []
    lines = [l.strip().lstrip("-•*| ") for l in section_text.split("\n") if l.strip()]
    # Filter out empty or header lines
    return [l for l in lines if len(l) > 3][:10]


def process_resume_and_jd(
    resume_source: Union[str, bytes],
    jd_text: str,
    mode: str = "mixed",
    filename: str = "",
    profile_id: str = None
) -> Dict[str, Any]:
    """
    Complete NLP processing pipeline:
    1. Parse Resume (PDF/DOCX) -> clean text
    2. Split Resume into Sections (Skills, Projects, Experience, Education, Certs)
    3. Extract Candidate Skills (Taxonomy + NER)
    4. Parse Job Description -> Job Title, Required/Preferred Skills, Responsibilities
    5. Compute Match & Gap Analysis -> Matched, Missing, Extra, Score
    6. Link Projects to Responsibilities
    7. Generate Ranked Interview Topics
    8. Return standardized Profile JSON
    """
    if not profile_id:
        profile_id = f"prof_{uuid.uuid4().hex[:10]}"

    # Step 1: Extract and clean resume text
    resume_text = extract_text(resume_source, filename=filename)
    cleaned_resume = clean_text(resume_text)

    # Step 2: Section detection
    sections = split_into_sections(cleaned_resume)

    # Step 3: Extract candidate entities
    # Skills from explicit skills section + full text
    skills_section = sections.get("skills", "")
    section_skills = extract_skills_from_text(skills_section)
    full_text_skills = extract_skills_from_text(cleaned_resume)
    ner_entities = extract_entities(cleaned_resume)

    candidate_skills = normalize_skill_list(
        section_skills + full_text_skills + ner_entities.get("SKILL", []) + ner_entities.get("TECH", [])
    )

    # Candidate projects
    projects_section = sections.get("projects", "")
    projects = _extract_projects(projects_section)
    if not projects:
        # Fallback to experience section if projects section was merged
        projects = _extract_projects(sections.get("experience", ""))

    # Candidate experience, education, certifications
    experience = _extract_bullet_list(sections.get("experience", ""))
    education = _extract_bullet_list(sections.get("education", ""))
    certifications = _extract_bullet_list(sections.get("certifications", ""))

    # Step 4: Parse Job Description
    job_parsed = parse_job_description(jd_text)
    job_title = job_parsed["title"]
    required_skills = job_parsed["required_skills"]
    preferred_skills = job_parsed["preferred_skills"]
    responsibilities = job_parsed["responsibilities"]

    # Step 5: Resume-JD Matching & Gap Analysis
    match_dict, match_score = compute_skill_gap_and_score(
        candidate_skills=candidate_skills,
        required_skills=required_skills,
        preferred_skills=preferred_skills
    )

    # Step 6: Project to Responsibility Links
    project_job_links = link_projects_to_responsibilities(
        projects=projects,
        responsibilities=responsibilities
    )

    # Step 7: Build Ranked Interview Topics
    interview_topics = build_ranked_interview_topics(
        mode=mode,
        candidate_skills=candidate_skills,
        projects=projects,
        job_title=job_title,
        required_skills=required_skills,
        preferred_skills=preferred_skills,
        responsibilities=responsibilities,
        match_dict=match_dict
    )

    # Step 8: Return frozen JSON contract
    profile_response = {
        "profile_id": profile_id,
        "mode": mode.lower() if mode else "mixed",
        "candidate": {
            "skills": candidate_skills,
            "projects": projects,
            "experience": experience,
            "education": education,
            "certifications": certifications
        },
        "job": {
            "title": job_title,
            "required_skills": required_skills,
            "preferred_skills": preferred_skills,
            "responsibilities": responsibilities
        },
        "match": {
            "matched": match_dict["matched"],
            "missing": match_dict["missing"],
            "extra": match_dict["extra"],
            "score": match_score
        },
        "project_job_links": project_job_links,
        "interview_topics": interview_topics
    }

    return profile_response


def recalculate_profile(profile_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Recalculates match results, project links, and interview topics after user edits.
    """
    mode = profile_data.get("mode", "mixed")
    candidate = profile_data.get("candidate", {})
    job = profile_data.get("job", {})

    candidate_skills = normalize_skill_list(candidate.get("skills", []))
    required_skills = normalize_skill_list(job.get("required_skills", []))
    preferred_skills = normalize_skill_list(job.get("preferred_skills", []))
    projects = candidate.get("projects", [])
    responsibilities = job.get("responsibilities", [])
    job_title = job.get("title", "Software Engineer")

    # Recalculate gap & score
    match_dict, match_score = compute_skill_gap_and_score(
        candidate_skills=candidate_skills,
        required_skills=required_skills,
        preferred_skills=preferred_skills
    )

    # Recalculate project links
    project_job_links = link_projects_to_responsibilities(
        projects=projects,
        responsibilities=responsibilities
    )

    # Recalculate interview topics
    interview_topics = build_ranked_interview_topics(
        mode=mode,
        candidate_skills=candidate_skills,
        projects=projects,
        job_title=job_title,
        required_skills=required_skills,
        preferred_skills=preferred_skills,
        responsibilities=responsibilities,
        match_dict=match_dict
    )

    # Update profile_data
    profile_data["candidate"]["skills"] = candidate_skills
    profile_data["job"]["required_skills"] = required_skills
    profile_data["job"]["preferred_skills"] = preferred_skills
    profile_data["match"] = {
        "matched": match_dict["matched"],
        "missing": match_dict["missing"],
        "extra": match_dict["extra"],
        "score": match_score
    }
    profile_data["project_job_links"] = project_job_links
    profile_data["interview_topics"] = interview_topics

    return profile_data
