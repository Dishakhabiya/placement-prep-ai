"""
Scaffold and Google Colab / Kaggle training script for fine-tuning
DistilBERT on Resume & JD Named Entity Recognition (NER).

Dataset format expected:
[
  {
    "tokens": ["Proficient", "in", "Python", "and", "FastAPI", "with", "AWS", "deployment"],
    "ner_tags": ["O", "O", "B-SKILL", "O", "B-TECH", "O", "B-TECH", "O"]
  }
]
"""

import json
import os
from typing import List, Dict, Any
from module1.ner.labels import LABEL_LIST, LABEL2ID, ID2LABEL


def format_annotated_sample(tokens: List[str], tags: List[str]) -> Dict[str, Any]:
    """Helper to structure an annotated NER sample."""
    assert len(tokens) == len(tags), "Tokens and tags must match in length"
    tag_ids = [LABEL2ID.get(t, 0) for t in tags]
    return {
        "tokens": tokens,
        "ner_tags": tag_ids,
        "ner_tag_labels": tags
    }


def generate_synthetic_ner_training_data(output_path: str = "dataset_ner_sample.json"):
    """
    Creates a baseline sample dataset demonstrating the annotation schema.
    """
    samples = [
        format_annotated_sample(
            ["Developed", "scalable", "microservices", "using", "FastAPI", "and", "PostgreSQL", "."],
            ["O", "O", "B-SKILL", "O", "B-TECH", "O", "B-TECH", "O"]
        ),
        format_annotated_sample(
            ["Completed", "B.Tech", "in", "Computer", "Science", "at", "IIT", "Delhi", "."],
            ["O", "B-DEGREE", "I-DEGREE", "I-DEGREE", "I-DEGREE", "O", "B-ORG", "I-ORG", "O"]
        ),
        format_annotated_sample(
            ["Worked", "as", "Software", "Engineer", "Intern", "at", "Microsoft", "."],
            ["O", "O", "B-ROLE", "I-ROLE", "I-ROLE", "O", "B-ORG", "O"]
        ),
        format_annotated_sample(
            ["Strong", "knowledge", "of", "Machine", "Learning", ",", "PyTorch", ",", "and", "NLP", "."],
            ["O", "O", "O", "B-SKILL", "I-SKILL", "O", "B-TECH", "O", "O", "B-SKILL", "O"]
        )
    ]

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(samples, f, indent=2)

    return output_path


def train_model_stub(
    model_name: str = "distilbert-base-uncased",
    train_file: str = "dataset_ner_sample.json",
    output_dir: str = "models/distilbert-resume-ner",
    epochs: int = 3
):
    """
    Scaffold function to run fine-tuning if transformers, datasets, and torch are available.
    Can be run locally or pasted into Google Colab / Kaggle.
    """
    print(f"=== Starting NER Fine-Tuning Pipeline ===")
    print(f"Base model: {model_name}")
    print(f"Training data: {train_file}")
    print(f"Output directory: {output_dir}")

    try:
        import torch
        from transformers import (
            AutoTokenizer,
            AutoModelForTokenClassification,
            TrainingArguments,
            Trainer,
            DataCollatorForTokenClassification
        )
        print("Required libraries (torch, transformers) detected.")
        print(f"CUDA Available: {torch.cuda.is_available()}")

        # Ensure dataset exists
        if not os.path.exists(train_file):
            generate_synthetic_ner_training_data(train_file)

        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForTokenClassification.from_pretrained(
            model_name,
            num_labels=len(LABEL_LIST),
            id2label=ID2LABEL,
            label2id=LABEL2ID
        )

        print(f"Model architecture initialized with {len(LABEL_LIST)} labels.")
        print("To run full training on a GPU, execute in Google Colab with the generated dataset.")

    except ImportError as e:
        print(f"PyTorch or Transformers not installed in current environment ({e}).")
        print("Skipping active local training. Model scaffold is ready for Colab.")


if __name__ == "__main__":
    generate_synthetic_ner_training_data()
    train_model_stub()
