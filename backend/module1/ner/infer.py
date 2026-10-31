import os
import re
from typing import Dict, List, Optional
import spacy
from module1.ner.labels import ENTITY_TYPES
from module1.matching.normalize import _TAXONOMY, _ALIASES, _LOWER_TO_CANONICAL, normalize_skill, normalize_skill_list

# Transformer model path or HuggingFace Hub model ID.
# Set NER_MODEL_PATH to either:
#   - A local directory (e.g. "models/distilbert-resume-ner") after running train.py
#   - A HuggingFace Hub ID (e.g. "dslim/bert-base-NER") for a pre-trained model
NER_MODEL_PATH = os.getenv("NER_MODEL_PATH", "models/distilbert-resume-ner")

# Load spaCy pipeline for linguistic baseline
try:
    nlp = spacy.load("en_core_web_sm")
except Exception:
    nlp = spacy.blank("en")

_HF_PIPELINE = None


def _is_hub_model_id(path: str) -> bool:
    """Returns True if path looks like a HuggingFace Hub model ID (e.g. 'org/model-name')."""
    return bool(path) and "/" in path and not os.sep in path


def is_ner_model_available() -> bool:
    """Checks whether a Transformer model is available — either as a local checkpoint or a Hub ID."""
    if _is_hub_model_id(NER_MODEL_PATH):
        return True  # Hub ID: assume available (network check happens at load time)
    return os.path.exists(NER_MODEL_PATH) and os.path.isdir(NER_MODEL_PATH)


def load_transformer_ner():
    """Loads fine-tuned Hugging Face pipeline if available."""
    global _HF_PIPELINE
    if _HF_PIPELINE is not None:
        return _HF_PIPELINE

    if is_ner_model_available():
        try:
            from transformers import AutoTokenizer, AutoModelForTokenClassification, pipeline
            tokenizer = AutoTokenizer.from_pretrained(NER_MODEL_PATH)
            model = AutoModelForTokenClassification.from_pretrained(NER_MODEL_PATH)
            _HF_PIPELINE = pipeline("ner", model=model, tokenizer=tokenizer, aggregation_strategy="simple")
            return _HF_PIPELINE
        except Exception:
            _HF_PIPELINE = None
    return None


def extract_entities_rule_based(text: str) -> Dict[str, List[str]]:
    """
    Extracts entities using spaCy linguistic features and dictionary taxonomy.
    """
    entities: Dict[str, List[str]] = {etype: [] for etype in ENTITY_TYPES}

    if not text:
        return entities

    # 1. Extract SKILL & TECH from taxonomy & aliases
    cleaned = f" {text} "
    found_skills = set()
    found_tech = set()

    for category, skill_list in _TAXONOMY.items():
        for skill in skill_list:
            pattern = rf"(?<![\w\.\+#]){re.escape(skill.lower())}(?![\w\.\+#])"
            if re.search(pattern, cleaned, re.IGNORECASE):
                if category in ["programming_languages", "frameworks_and_libraries", "databases_and_storage", "cloud_and_devops"]:
                    found_tech.add(skill)
                else:
                    found_skills.add(skill)

    for alias, canonical in _ALIASES.items():
        pattern = rf"(?<![\w\.\+#]){re.escape(alias.lower())}(?![\w\.\+#])"
        if re.search(pattern, cleaned, re.IGNORECASE):
            found_skills.add(canonical)

    entities["SKILL"] = normalize_skill_list(list(found_skills))
    entities["TECH"] = normalize_skill_list(list(found_tech))

    # 2. Extract ORG, ROLE, DEGREE using spaCy NER & Regex
    doc = nlp(text[:10000])  # Cap slice for performance

    for ent in doc.ents:
        if ent.label_ == "ORG":
            clean_org = ent.text.strip().strip(".,;:|")
            if len(clean_org) > 2 and clean_org not in entities["ORG"] and not any(s.lower() == clean_org.lower() for s in entities["SKILL"]):
                entities["ORG"].append(clean_org)

    # Regex for Degrees
    degree_patterns = [
        r"\b(?:B\.?Tech|B\.?E\.?|M\.?Tech|M\.?E\.?|B\.?S\.?|M\.?S\.?|B\.?Sc|M\.?Sc|BCA|MCA|Ph\.?D|Bachelor(?:'s)?|Master(?:'s)?)\b(?:\s+(?:in|of)\s+[A-Za-z\s]+)?"
    ]
    for pattern in degree_patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for m in matches:
            deg = m.group(0).strip()
            if deg and deg not in entities["DEGREE"]:
                entities["DEGREE"].append(deg)

    # Regex for common Roles
    role_patterns = [
        r"\b(?:Software\s+Engineer|Frontend\s+Developer|Backend\s+Developer|Full\s+Stack\s+Developer|Data\s+Scientist|ML\s+Engineer|DevOps\s+Engineer|Product\s+Manager|QA\s+Engineer|Intern)\b"
    ]
    for pattern in role_patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for m in matches:
            role = m.group(0).strip()
            if role and role not in entities["ROLE"]:
                entities["ROLE"].append(role)

    return entities


def _clean_hf_word(word: str) -> str:
    """
    Cleans a HuggingFace aggregated word:
    - Removes subword prefix '##' artifacts
    - Strips leading/trailing punctuation and whitespace
    - Collapses internal spaces
    """
    word = word.replace("##", "").strip(" .,;:!?-")
    word = " ".join(word.split())
    return word


def _resolve_to_canonical(word: str, group: str) -> Optional[str]:
    """
    Tries to resolve a (possibly lowercased/fragmented) word back to its
    canonical taxonomy form.

    For SKILL/TECH: returns None if the word is NOT found in the taxonomy
    (prevents false positives like 'Vehicles', 'Dish', 'Fleet').
    For ORG/ROLE/DEGREE: returns the word as-is (not taxonomy-bounded).
    """
    if not word:
        return None
    lower = word.lower()

    # Direct lookup in the prebuilt lower→canonical map
    canonical = _LOWER_TO_CANONICAL.get(lower)
    if canonical:
        return canonical

    # Partial prefix match — only for known subword fragments (min 4 chars)
    # e.g. 'dock' → 'Docker', 'kube' → 'Kubernetes'
    if len(lower) >= 4:
        for key, val in _LOWER_TO_CANONICAL.items():
            if key.startswith(lower):
                return val

    # For SKILL/TECH: reject words not in taxonomy to avoid false positives
    if group in ("SKILL", "TECH"):
        return None

    # For ORG, ROLE, DEGREE: accept and title-case
    return word.title() if word.islower() else word


def extract_entities(text: str) -> Dict[str, List[str]]:
    """
    Unified extraction interface:
    - Uses fine-tuned Transformer model if available.
    - Otherwise, falls back gracefully to rule-based & spaCy dictionary extraction.
    """
    pipe = load_transformer_ner()
    if pipe is not None:
        try:
            results = pipe(text)
            entities: Dict[str, List[str]] = {etype: [] for etype in ENTITY_TYPES}
            for res in results:
                group = res.get("entity_group", "")
                raw_word = res.get("word", "")
                if group not in entities:
                    continue
                word = _clean_hf_word(raw_word)
                if not word or len(word) < 2:
                    continue
                word = _resolve_to_canonical(word, group)
                if word and word not in entities[group]:
                    entities[group].append(word)
            # Merge DistilBERT results with rule-based for higher recall
            rule_entities = extract_entities_rule_based(text)
            for etype in ENTITY_TYPES:
                for item in rule_entities.get(etype, []):
                    if item not in entities[etype]:
                        entities[etype].append(item)
            return entities
        except Exception:
            pass  # Fallback to rule-based

    return extract_entities_rule_based(text)
