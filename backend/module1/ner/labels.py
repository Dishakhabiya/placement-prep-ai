"""
Entity labels for Resume and Job Description Named Entity Recognition (NER).
"""

LABEL_LIST = [
    "O",
    "B-SKILL",
    "I-SKILL",
    "B-TECH",
    "I-TECH",
    "B-ORG",
    "I-ORG",
    "B-ROLE",
    "I-ROLE",
    "B-DEGREE",
    "I-DEGREE"
]

ID2LABEL = {idx: label for idx, label in enumerate(LABEL_LIST)}
LABEL2ID = {label: idx for idx, label in enumerate(LABEL_LIST)}

ENTITY_TYPES = ["SKILL", "TECH", "ORG", "ROLE", "DEGREE"]
