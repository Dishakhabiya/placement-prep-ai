from typing import Dict, List, Tuple
from module1.matching.normalize import normalize_skill, normalize_skill_list


def compute_skill_gap_and_score(
    candidate_skills: List[str],
    required_skills: List[str],
    preferred_skills: List[str]
) -> Tuple[Dict[str, List[str]], float]:
    """
    Computes matched, missing (not found in resume), and extra skills,
    along with a transparently weighted match score (0.0 - 100.0).

    Scoring Logic:
    - Required skills coverage weight: 80%
    - Preferred skills coverage weight: 20%
    - If preferred is empty, required gets 100% weight.
    - If required is empty and preferred exists, preferred gets 100% weight.
    - If both are empty, score is 0.0 (neutral).
    """
    norm_candidate = normalize_skill_list(candidate_skills)
    norm_required = normalize_skill_list(required_skills)
    norm_preferred = normalize_skill_list(preferred_skills)

    candidate_set = {s.lower(): s for s in norm_candidate}
    required_set = {s.lower(): s for s in norm_required}
    preferred_set = {s.lower(): s for s in norm_preferred}
    all_jd_keys = set(required_set.keys()).union(set(preferred_set.keys()))

    matched_skills: List[str] = []
    missing_skills: List[str] = []
    extra_skills: List[str] = []

    matched_req_count = 0
    matched_pref_count = 0

    # 1. Check required skills
    for key, original_name in required_set.items():
        if key in candidate_set:
            matched_skills.append(candidate_set[key])
            matched_req_count += 1
        else:
            missing_skills.append(original_name)

    # 2. Check preferred skills
    for key, original_name in preferred_set.items():
        if key in candidate_set:
            if candidate_set[key] not in matched_skills:
                matched_skills.append(candidate_set[key])
            matched_pref_count += 1
        else:
            if original_name not in missing_skills:
                missing_skills.append(original_name)

    # 3. Find extra skills (present in resume, not requested in JD)
    for key, original_name in candidate_set.items():
        if key not in all_jd_keys:
            extra_skills.append(original_name)

    # 4. Compute Match Score
    num_req = len(required_set)
    num_pref = len(preferred_set)

    if num_req > 0 and num_pref > 0:
        req_ratio = matched_req_count / num_req
        pref_ratio = matched_pref_count / num_pref
        score = (req_ratio * 0.8 + pref_ratio * 0.2) * 100.0
    elif num_req > 0:
        score = (matched_req_count / num_req) * 100.0
    elif num_pref > 0:
        score = (matched_pref_count / num_pref) * 100.0
    else:
        score = 0.0

    score = round(max(0.0, min(100.0, score)), 1)

    match_dict = {
        "matched": matched_skills,
        "missing": missing_skills,
        "extra": extra_skills
    }

    return match_dict, score
