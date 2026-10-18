"""
Fine-tuning script for DistilBERT on Resume & JD Named Entity Recognition (NER).

Supports two modes:
  1. generate  -- Generates a synthetic annotated dataset from the skill taxonomy.
  2. train     -- Fine-tunes distilbert-base-uncased and saves to models/distilbert-resume-ner.

Usage (from backend/ directory):
  python -m module1.ner.train generate               # Generate dataset only
  python -m module1.ner.train train                  # Generate + fine-tune
  python -m module1.ner.train train --epochs 5       # Custom epoch count
  python -m module1.ner.train train --samples-per-skill 5   # More data

Can also be run on Google Colab / Kaggle by pasting this file.
"""

import json
import os
import sys
import random
import re
import argparse
from typing import List, Dict, Any, Tuple

from module1.ner.labels import LABEL_LIST, LABEL2ID, ID2LABEL

# ── Paths ──────────────────────────────────────────────────────────────────────
_HERE = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(_HERE, "dataset_ner.json")
OUTPUT_DIR = os.path.abspath(os.path.join(_HERE, "..", "..", "models", "distilbert-resume-ner"))
BASE_MODEL = "distilbert-base-uncased"

# ── Sentence Templates ─────────────────────────────────────────────────────────
_SKILL_TEMPLATES = [
    "Proficient in {skill} for building scalable applications.",
    "Strong knowledge of {skill} gained through multiple projects.",
    "Experienced with {skill} and related tools.",
    "Used {skill} extensively during internship at {org}.",
    "{skill} is a core competency of the candidate.",
    "Hands-on experience with {skill} and {skill2}.",
    "Required: proficiency in {skill}.",
    "Must have strong {skill} skills.",
    "Nice to have: familiarity with {skill}.",
    "We are looking for someone with expertise in {skill}.",
    "Candidate should be proficient in {skill} and {skill2}.",
]

_ROLE_TEMPLATES = [
    "Worked as a {role} at {org}.",
    "Currently a {role} at {org} focusing on backend development.",
    "Seeking a {role} position at a product-based company.",
    "The ideal candidate will work as a {role}.",
    "Hired as {role} Intern at {org} for 6 months.",
]

_DEGREE_TEMPLATES = [
    "Completed {degree} in Computer Science from {org}.",
    "Holds a {degree} from {org}.",
    "{degree} graduate with 8 CGPA from {org}.",
    "Currently pursuing {degree} at {org}.",
    "Required: {degree} or equivalent qualification.",
]

_ORGS = [
    "Google", "Microsoft", "Amazon", "Infosys", "TCS", "Wipro", "Flipkart",
    "IIT Delhi", "IIT Bombay", "NIT Trichy", "BITS Pilani", "VIT Chennai",
    "Razorpay", "CRED", "Swiggy", "Zomato", "Meesho", "PhonePe",
]

_ROLES = [
    "Software Engineer", "Frontend Developer", "Backend Developer",
    "Full Stack Developer", "Data Scientist", "ML Engineer",
    "DevOps Engineer", "QA Engineer", "Product Manager",
]

_DEGREES = [
    "B.Tech", "M.Tech", "B.E.", "M.E.", "B.Sc", "M.Sc",
    "BCA", "MCA", "Ph.D", "Bachelor's", "Master's",
]

_TECH_CATEGORIES = {
    "programming_languages", "frameworks_and_libraries",
    "databases_and_storage", "cloud_and_devops",
}


# ── Dataset Generation ─────────────────────────────────────────────────────────

def _tokenize_simple(text: str) -> List[str]:
    """Simple word + punctuation tokenizer."""
    return re.findall(r"\w[\w\.#\+\-]*|\S", text)


def _align_tags(tokens: List[str], entity_spans: List[Tuple[str, str, str]]) -> List[str]:
    """
    Assigns BIO tags to tokens given a list of (entity_text, B_tag, I_tag).
    """
    tags = ["O"] * len(tokens)
    for entity_text, b_tag, i_tag in entity_spans:
        entity_tokens = _tokenize_simple(entity_text)
        n = len(entity_tokens)
        for i in range(len(tokens) - n + 1):
            if [t.lower() for t in tokens[i:i + n]] == [t.lower() for t in entity_tokens]:
                tags[i] = b_tag
                for j in range(1, n):
                    tags[i + j] = i_tag
                break
    return tags


def _make_sample(tokens: List[str], tags: List[str]) -> Dict[str, Any]:
    return {
        "tokens": tokens,
        "ner_tags": [LABEL2ID.get(t, 0) for t in tags],
        "ner_tag_labels": tags,
    }


def _make_skill_sample(skill: str, category: str, taxonomy: Dict, org_list: List[str]) -> Dict[str, Any]:
    is_tech = category in _TECH_CATEGORIES
    b_tag = "B-TECH" if is_tech else "B-SKILL"
    i_tag = "I-TECH" if is_tech else "I-SKILL"

    template = random.choice(_SKILL_TEMPLATES)
    org = random.choice(org_list)
    all_skills = [s for cat_skills in taxonomy.values() for s in cat_skills if s != skill]
    skill2 = random.choice(all_skills) if all_skills else skill

    sentence = template.format(skill=skill, skill2=skill2, org=org)
    tokens = _tokenize_simple(sentence)

    spans: List[Tuple[str, str, str]] = [(skill, b_tag, i_tag)]
    if "{skill2}" in template:
        cat2 = next((cat for cat, skills in taxonomy.items() if skill2 in skills), "")
        is_tech2 = cat2 in _TECH_CATEGORIES
        spans.append((skill2, "B-TECH" if is_tech2 else "B-SKILL", "I-TECH" if is_tech2 else "I-SKILL"))
    if "{org}" in template:
        spans.append((org, "B-ORG", "I-ORG"))

    tags = _align_tags(tokens, spans)
    return _make_sample(tokens, tags)


def _make_role_sample(role: str, org: str) -> Dict[str, Any]:
    sentence = random.choice(_ROLE_TEMPLATES).format(role=role, org=org)
    tokens = _tokenize_simple(sentence)
    tags = _align_tags(tokens, [(role, "B-ROLE", "I-ROLE"), (org, "B-ORG", "I-ORG")])
    return _make_sample(tokens, tags)


def _make_degree_sample(degree: str, org: str) -> Dict[str, Any]:
    sentence = random.choice(_DEGREE_TEMPLATES).format(degree=degree, org=org)
    tokens = _tokenize_simple(sentence)
    tags = _align_tags(tokens, [(degree, "B-DEGREE", "I-DEGREE"), (org, "B-ORG", "I-ORG")])
    return _make_sample(tokens, tags)


def generate_dataset(output_path: str = DATASET_PATH, samples_per_skill: int = 3) -> str:
    """
    Generates a synthetic annotated NER dataset from the skill taxonomy.
    Falls back to a minimal built-in taxonomy if the project taxonomy is unavailable.
    """
    try:
        from module1.matching.normalize import _TAXONOMY as taxonomy
    except ImportError:
        taxonomy = {
            "programming_languages": ["Python", "Java", "JavaScript", "C++", "Go", "Rust"],
            "frameworks_and_libraries": ["FastAPI", "React", "Django", "PyTorch", "TensorFlow", "Flask"],
            "databases_and_storage": ["PostgreSQL", "MongoDB", "Redis", "MySQL"],
            "cloud_and_devops": ["AWS", "Docker", "Kubernetes", "GCP", "Azure"],
            "soft_skills": ["communication", "teamwork", "problem solving", "leadership"],
        }

    samples: List[Dict[str, Any]] = []

    # Skill + Tech samples
    for category, skills in taxonomy.items():
        for skill in skills:
            for _ in range(samples_per_skill):
                try:
                    samples.append(_make_skill_sample(skill, category, taxonomy, _ORGS))
                except Exception:
                    pass

    # Role samples
    for role in _ROLES:
        for org in random.sample(_ORGS, min(4, len(_ORGS))):
            try:
                samples.append(_make_role_sample(role, org))
            except Exception:
                pass

    # Degree samples
    for degree in _DEGREES:
        for org in random.sample(_ORGS, min(4, len(_ORGS))):
            try:
                samples.append(_make_degree_sample(degree, org))
            except Exception:
                pass

    random.shuffle(samples)

    out_dir = os.path.dirname(output_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(samples, f, indent=2, ensure_ascii=False)

    print(f"Dataset generated: {len(samples)} samples -> {output_path}")
    return output_path


# ── Training ───────────────────────────────────────────────────────────────────

def train_model(
    model_name: str = BASE_MODEL,
    dataset_path: str = DATASET_PATH,
    output_dir: str = OUTPUT_DIR,
    epochs: int = 3,
    batch_size: int = 16,
    learning_rate: float = 2e-5,
    val_split: float = 0.1,
):
    """
    Fine-tunes DistilBERT for token classification (NER) on the generated dataset.
    Saves the model checkpoint to output_dir so that infer.py auto-loads it.
    """
    try:
        import torch
        from transformers import (
            AutoTokenizer,
            AutoModelForTokenClassification,
            TrainingArguments,
            Trainer,
        )
        from torch.utils.data import Dataset as TorchDataset
    except ImportError:
        print("ERROR: torch or transformers not installed.")
        print("  Run: pip install torch transformers")
        sys.exit(1)

    print("=== DistilBERT NER Fine-Tuning ===")
    print(f"Base model   : {model_name}")
    print(f"Dataset      : {dataset_path}")
    print(f"Output dir   : {output_dir}")
    print(f"Epochs       : {epochs}  |  Batch: {batch_size}  |  LR: {learning_rate}")
    print(f"CUDA         : {torch.cuda.is_available()}")

    # Load dataset
    if not os.path.exists(dataset_path):
        print(f"Dataset not found at {dataset_path} -- generating...")
        generate_dataset(dataset_path)

    with open(dataset_path, "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    # Filter invalid samples
    raw_data = [
        d for d in raw_data
        if d.get("tokens") and d.get("ner_tags") and len(d["tokens"]) == len(d["ner_tags"])
    ]
    print(f"Loaded {len(raw_data)} valid samples.")

    if len(raw_data) < 10:
        print("ERROR: Not enough samples. Run 'generate' first.")
        sys.exit(1)

    # Train / val split
    random.shuffle(raw_data)
    split_idx = max(1, int(len(raw_data) * (1 - val_split)))
    train_data, val_data = raw_data[:split_idx], raw_data[split_idx:]
    print(f"Train: {len(train_data)}  |  Val: {len(val_data)}")

    # Tokenizer
    tokenizer = AutoTokenizer.from_pretrained(model_name)

    def tokenize_and_align(samples: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Tokenizes word-level tokens with subword alignment (-100 for sub-tokens)."""
        result = []
        for sample in samples:
            words = sample["tokens"]
            word_labels = sample["ner_tags"]

            encoding = tokenizer(
                words,
                is_split_into_words=True,
                truncation=True,
                max_length=128,
                padding="max_length",
            )

            labels = []
            prev_word_id = None
            for word_id in encoding.word_ids():
                if word_id is None:
                    labels.append(-100)
                elif word_id != prev_word_id:
                    labels.append(word_labels[word_id])
                else:
                    labels.append(-100)   # sub-token: ignore in loss
                prev_word_id = word_id

            result.append({
                "input_ids": encoding["input_ids"],
                "attention_mask": encoding["attention_mask"],
                "labels": labels,
            })
        return result

    train_encoded = tokenize_and_align(train_data)
    val_encoded = tokenize_and_align(val_data)

    class NERDataset(TorchDataset):
        def __init__(self, encoded):
            self.data = encoded

        def __len__(self):
            return len(self.data)

        def __getitem__(self, idx):
            return {k: torch.tensor(v) for k, v in self.data[idx].items()}

    # Model
    model = AutoModelForTokenClassification.from_pretrained(
        model_name,
        num_labels=len(LABEL_LIST),
        id2label=ID2LABEL,
        label2id=LABEL2ID,
        ignore_mismatched_sizes=True,
    )

    # Training arguments
    os.makedirs(output_dir, exist_ok=True)
    training_args = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=epochs,
        per_device_train_batch_size=batch_size,
        per_device_eval_batch_size=batch_size,
        learning_rate=learning_rate,
        weight_decay=0.01,
        warmup_steps=50,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        logging_steps=10,
        report_to="none",
        fp16=torch.cuda.is_available(),
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=NERDataset(train_encoded),
        eval_dataset=NERDataset(val_encoded),
        processing_class=tokenizer,
    )

    print("\nStarting training...")
    trainer.train()

    trainer.save_model(output_dir)
    tokenizer.save_pretrained(output_dir)
    print(f"\nModel saved to: {output_dir}")
    print("The NER pipeline will now use DistilBERT automatically on next startup.")


# ── Legacy helpers (kept for backwards compatibility) ──────────────────────────

def format_annotated_sample(tokens: List[str], tags: List[str]) -> Dict[str, Any]:
    """Helper to structure an annotated NER sample."""
    assert len(tokens) == len(tags), "Tokens and tags must match in length"
    return {
        "tokens": tokens,
        "ner_tags": [LABEL2ID.get(t, 0) for t in tags],
        "ner_tag_labels": tags,
    }


def generate_synthetic_ner_training_data(output_path: str = "dataset_ner_sample.json") -> str:
    """Alias for generate_dataset — kept for backwards compatibility."""
    return generate_dataset(output_path)


def train_model_stub(**kwargs):
    """Alias for train_model — kept for backwards compatibility."""
    return train_model(**{k: v for k, v in kwargs.items() if k in (
        "model_name", "dataset_path", "output_dir", "epochs", "batch_size", "learning_rate"
    )})


# ── CLI ────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="DistilBERT NER fine-tuning for Resume & JD extraction"
    )
    parser.add_argument(
        "mode", choices=["generate", "train"],
        help="'generate' = dataset only  |  'train' = full fine-tune"
    )
    parser.add_argument("--dataset", default=DATASET_PATH, help="Path to dataset JSON")
    parser.add_argument("--output", default=OUTPUT_DIR, help="Output dir for model checkpoint")
    parser.add_argument("--base-model", default=BASE_MODEL, help="HuggingFace base model ID")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--lr", type=float, default=2e-5)
    parser.add_argument("--samples-per-skill", type=int, default=3,
                        help="Synthetic samples generated per skill (higher = more data)")
    cli = parser.parse_args()

    if cli.mode == "generate":
        generate_dataset(cli.dataset, samples_per_skill=cli.samples_per_skill)
    elif cli.mode == "train":
        if not os.path.exists(cli.dataset):
            print("Dataset not found -- generating first...")
            generate_dataset(cli.dataset, samples_per_skill=cli.samples_per_skill)
        train_model(
            model_name=cli.base_model,
            dataset_path=cli.dataset,
            output_dir=cli.output,
            epochs=cli.epochs,
            batch_size=cli.batch_size,
            learning_rate=cli.lr,
        )
