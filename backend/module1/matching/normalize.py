import json
import os
import re
from typing import Dict, List, Set

TAXONOMY_DIR = os.path.join(os.path.dirname(__file__), "..", "taxonomy")
SKILLS_FILE = os.path.join(TAXONOMY_DIR, "skills.json")
ALIASES_FILE = os.path.join(TAXONOMY_DIR, "aliases.json")


def load_taxonomy() -> Dict[str, List[str]]:
    """Loads skills taxonomy categorized by category."""
    if os.path.exists(SKILLS_FILE):
        with open(SKILLS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def load_aliases() -> Dict[str, str]:
    """Loads alias mappings."""
    if os.path.exists(ALIASES_FILE):
        with open(ALIASES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


# Pre-load in memory
_TAXONOMY = load_taxonomy()
_ALIASES = load_aliases()

# Build a lookup dictionary for fast exact/case-insensitive matching
_CANONICAL_SKILLS: Set[str] = set()
for category_skills in _TAXONOMY.values():
    for skill in category_skills:
        _CANONICAL_SKILLS.add(skill)

_LOWER_TO_CANONICAL: Dict[str, str] = {s.lower(): s for s in _CANONICAL_SKILLS}
for alias, canonical in _ALIASES.items():
    _LOWER_TO_CANONICAL[alias.lower()] = canonical


def normalize_skill(skill: str) -> str:
    """
    Normalizes a skill string to its canonical taxonomy name if mapped,
    otherwise formats it cleanly.
    """
    if not skill:
        return ""

    cleaned = skill.strip()
    lowered = cleaned.lower()

    # Exact alias / canonical match
    if lowered in _LOWER_TO_CANONICAL:
        return _LOWER_TO_CANONICAL[lowered]

    # Handle slight variations like "react.js" or "node js"
    cleaned_variant = re.sub(r"[\s\.\-]+", " ", lowered).strip()
    if cleaned_variant in _LOWER_TO_CANONICAL:
        return _LOWER_TO_CANONICAL[cleaned_variant]

    # Preserve special acronyms or Title Case for unmapped skills
    if cleaned.isupper() and len(cleaned) <= 5:
        return cleaned
    return cleaned.title() if len(cleaned) > 2 else cleaned.upper()


def normalize_skill_list(skills: List[str]) -> List[str]:
    """
    Normalizes a list of skills, removes duplicates while maintaining order.
    """
    seen: Set[str] = set()
    result: List[str] = []

    for s in skills:
        norm = normalize_skill(s)
        if norm and norm.lower() not in seen:
            seen.add(norm.lower())
            result.append(norm)

    return result


def get_all_known_skills() -> List[str]:
    """Returns sorted list of all unique canonical skills from taxonomy."""
    return sorted(list(_CANONICAL_SKILLS))
