from typing import Dict, List, Any
from module1.matching.normalize import normalize_skill_list


def build_ranked_interview_topics(
    mode: str,
    candidate_skills: List[str],
    projects: List[Dict[str, Any]],
    job_title: str,
    required_skills: List[str],
    preferred_skills: List[str],
    responsibilities: List[str],
    match_dict: Dict[str, List[str]]
) -> List[Dict[str, str]]:
    """
    Generates 8-12 ranked interview topics for Person 2's question-generation engine.

    Inputs:
    - mode: 'hr', 'technical', 'resume-based', 'jd-based', or 'mixed' (case-insensitive)
    - candidate_skills, projects, job_title, required_skills, preferred_skills, responsibilities
    - match_dict: {'matched': [...], 'missing': [...], 'extra': [...]}

    Output format:
    [
        {"topic": "...", "priority": "high"|"medium"|"low", "reason": "..."},
        ...
    ]
    """
    mode_lower = mode.lower().strip() if mode else "mixed"
    topics: List[Dict[str, str]] = []
    seen_topics = set()

    def add_topic(topic_name: str, priority: str, reason_text: str):
        key = topic_name.lower().strip()
        if key not in seen_topics and len(topic_name) > 2:
            seen_topics.add(key)
            topics.append({
                "topic": topic_name,
                "priority": priority,
                "reason": reason_text
            })

    matched = match_dict.get("matched", [])
    missing = match_dict.get("missing", [])
    extra = match_dict.get("extra", [])

    # 1. Missing Skills Probe (Crucial for Technical, JD-based, Mixed)
    if mode_lower in ["technical", "jd-based", "mixed", "resume-based"]:
        for skill in missing[:3]:
            add_topic(
                f"{skill} Competency & Learning Curve",
                "high",
                f"Candidate resume does not explicitly show '{skill}' which is required or preferred for the {job_title} role."
            )

    # 2. Candidate Projects Deep-Dive (Essential for Resume-Based, Technical, Mixed, HR)
    if mode_lower in ["resume-based", "technical", "mixed", "hr"]:
        for proj in projects[:3]:
            title = proj.get("title", "").strip() or "Core Project"
            tech_stack = ", ".join(proj.get("tech", [])[:3])
            tech_note = f" using {tech_stack}" if tech_stack else ""
            add_topic(
                f"Project Architecture & Execution: {title}",
                "high",
                f"Verify candidate's hands-on contribution, design trade-offs, and technical problem solving in '{title}'{tech_note}."
            )

    # 3. Matched Core Technical Skills
    if mode_lower in ["technical", "mixed", "jd-based"]:
        for skill in matched[:4]:
            add_topic(
                f"Core Proficiency: {skill}",
                "high",
                f"Core skill '{skill}' is confirmed in resume and directly aligns with the target job requirements."
            )

    # 4. Job Responsibility & Scenario-Based Questions
    if mode_lower in ["jd-based", "mixed", "hr"]:
        for resp in responsibilities[:3]:
            short_resp = resp.split(".")[0] if "." in resp else resp
            if len(short_resp) > 50:
                short_resp = short_resp[:47] + "..."
            add_topic(
                f"Practical Scenario: {short_resp}",
                "medium" if mode_lower == "hr" else "high",
                f"Evaluate practical capability to deliver on target job responsibility: '{short_resp}'."
            )

    # 5. Extra Technical Capabilities & Versatility
    if mode_lower in ["resume-based", "technical", "mixed"]:
        for skill in extra[:2]:
            add_topic(
                f"Transferable Skill: {skill}",
                "medium",
                f"Additional skill '{skill}' from candidate profile that could offer value beyond baseline JD expectations."
            )

    # 6. HR / Cultural / Behavioral Topics
    if mode_lower in ["hr", "mixed"]:
        add_topic(
            "Career Motivation & Role Alignment",
            "high" if mode_lower == "hr" else "medium",
            f"Assess candidate's alignment with the {job_title} role and long-term career growth aspirations."
        )
        add_topic(
            "Collaboration, Conflict Resolution & Ownership",
            "high" if mode_lower == "hr" else "medium",
            "Evaluate communication skills, teamwork dynamics, and handling tight deadlines or ambiguities."
        )
        add_topic(
            "Leadership, Initiative & Mentorship",
            "medium",
            "Explore instances where the candidate took technical initiative, led peers, or mentored colleagues."
        )

    # 7. Foundational Computer Science Topics
    if mode_lower in ["technical", "mixed"]:
        if any(s.lower() in ["dsa", "algorithms", "data structures"] for s in candidate_skills + required_skills):
            add_topic(
                "Data Structures & Algorithmic Problem Solving",
                "high",
                "Test core algorithmic problem solving, time/space complexity, and code optimization."
            )
        if any(s.lower() in ["system design", "microservices", "rest apis", "scalability"] for s in candidate_skills + required_skills):
            add_topic(
                "System Design & Scalability Principles",
                "medium",
                "Evaluate architectural knowledge, API design, caching, and database scaling strategies."
            )

    # Ensure we deliver 8-12 topics cleanly by padding with structured domain topics
    fallbacks = [
        ("Debugging, Testing & Code Quality", "medium", "Evaluate software quality habits, unit testing, and debugging strategies under pressure."),
        (f"{job_title} Industry Practices", "medium", f"Gauge general domain awareness and industry best practices for {job_title} positions."),
        ("Handling Ambiguous Requirements", "low", "Assess how the candidate navigates unclear product specs or changing project requirements."),
        ("Adaptability & Continuous Learning", "low", "Evaluate candidate's approach to learning new frameworks and staying updated with modern tech."),
        ("Time Management & Sprint Delivery", "low", "Understand prioritization techniques and handling multiple project deliverables."),
        ("Professional Ethics & Integrity", "low", "Assess ethical decision making, intellectual property handling, and professional conduct.")
    ]

    for f_topic, f_priority, f_reason in fallbacks:
        if len(topics) >= 8:
            break
        add_topic(f_topic, f_priority, f_reason)

    return topics[:12]
