import re
from typing import Dict, List, Tuple

SECTION_HEADERS = {
    "skills": [
        r"technical\s+skills?",
        r"skills?\s*(?:&|and)\s*abilities?",
        r"core\s+competencies",
        r"skills?\s*(?:&|and)\s*tools?",
        r"tech\s+stack",
        r"key\s+skills?",
        r"skills?",
        r"technologies",
        r"programming\s+languages"
    ],
    "experience": [
        r"work\s+experience",
        r"professional\s+experience",
        r"employment\s+history",
        r"work\s+history",
        r"internships?\s*(?:&|and)\s*experience",
        r"experience",
        r"internships?"
    ],
    "projects": [
        r"academic\s+projects?",
        r"personal\s+projects?",
        r"key\s+projects?",
        r"featured\s+projects?",
        r"major\s+projects?",
        r"projects?"
    ],
    "education": [
        r"educational\s+background",
        r"academic\s+qualifications?",
        r"education\s*(?:&|and)\s*qualifications?",
        r"academics?",
        r"education"
    ],
    "certifications": [
        r"certifications?\s*(?:&|and)\s*licenses?",
        r"certificates?",
        r"courses?\s*(?:&|and)\s*certifications?",
        r"licenses?\s*(?:&|and)\s*certifications?",
        r"certifications?",
        r"achievements?\s*(?:&|and)\s*certifications?"
    ],
    "summary": [
        r"professional\s+summary",
        r"career\s+objective",
        r"executive\s+summary",
        r"about\s+me",
        r"summary",
        r"objective"
    ]
}


def _match_header_line(line: str) -> Tuple[str, bool]:
    """Checks if a single line acts as a section header."""
    clean_line = line.strip().rstrip(":").lower()
    if not clean_line or len(clean_line) > 45:
        return ("", False)

    for section_name, patterns in SECTION_HEADERS.items():
        for pattern in patterns:
            # Check full match or header surrounded by markers like '---' or '=='
            regex = rf"^[\-=\*_#\s]*{pattern}[\-=\*_#\s]*$"
            if re.match(regex, clean_line):
                return (section_name, True)
    return ("", False)


def split_into_sections(text: str) -> Dict[str, str]:
    """
    Parses a resume text into categorized sections.
    Returns a dictionary mapping section name to extracted section text.
    Handles missing sections gracefully.
    """
    lines = text.split("\n")
    sections: Dict[str, List[str]] = {
        "header": [],
        "summary": [],
        "skills": [],
        "experience": [],
        "projects": [],
        "education": [],
        "certifications": [],
        "other": []
    }

    current_section = "header"

    for line in lines:
        trimmed = line.strip()
        if not trimmed:
            continue

        matched_section, is_header = _match_header_line(trimmed)
        if is_header:
            current_section = matched_section
        else:
            sections[current_section].append(line)

    result = {k: "\n".join(v).strip() for k, v in sections.items() if v}
    return result
