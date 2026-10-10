from typing import Dict, List, Set, Any


def compute_entity_metrics(
    ground_truth: List[str],
    predicted: List[str]
) -> Dict[str, float]:
    """
    Computes entity-level Precision, Recall, and F1-score (case-insensitive).
    """
    gt_set: Set[str] = {item.strip().lower() for item in ground_truth if item.strip()}
    pred_set: Set[str] = {item.strip().lower() for item in predicted if item.strip()}

    if not gt_set and not pred_set:
        return {"precision": 1.0, "recall": 1.0, "f1": 1.0, "tp": 0, "fp": 0, "fn": 0}
    if not pred_set:
        return {"precision": 0.0, "recall": 0.0, "f1": 0.0, "tp": 0, "fp": 0, "fn": len(gt_set)}
    if not gt_set:
        return {"precision": 0.0, "recall": 0.0, "f1": 0.0, "tp": 0, "fp": len(pred_set), "fn": 0}

    true_positives = len(gt_set.intersection(pred_set))
    false_positives = len(pred_set - gt_set)
    false_negatives = len(gt_set - pred_set)

    precision = true_positives / (true_positives + false_positives) if (true_positives + false_positives) > 0 else 0.0
    recall = true_positives / (true_positives + false_negatives) if (true_positives + false_negatives) > 0 else 0.0
    f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

    return {
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "tp": true_positives,
        "fp": false_positives,
        "fn": false_negatives
    }


def evaluate_dataset(
    annotated_dataset: List[Dict[str, Any]],
    extractor_fn
) -> Dict[str, Any]:
    """
    Evaluates an extractor function over a list of annotated test cases.

    Each item in annotated_dataset should be:
    {
      "id": "sample_01",
      "text": "...",
      "ground_truth_skills": ["Python", "SQL", "FastAPI"]
    }
    """
    total_tp = 0
    total_fp = 0
    total_fn = 0
    individual_results = []

    for item in annotated_dataset:
        sample_id = item.get("id", "unknown")
        text = item.get("text", "")
        gt_skills = item.get("ground_truth_skills", [])

        # Run extractor
        extracted = extractor_fn(text)
        if isinstance(extracted, dict):
            pred_skills = extracted.get("SKILL", []) + extracted.get("TECH", [])
        elif isinstance(extracted, list):
            pred_skills = extracted
        else:
            pred_skills = []

        metrics = compute_entity_metrics(gt_skills, pred_skills)
        total_tp += metrics["tp"]
        total_fp += metrics["fp"]
        total_fn += metrics["fn"]

        individual_results.append({
            "id": sample_id,
            "metrics": metrics,
            "ground_truth": gt_skills,
            "predicted": pred_skills
        })

    # Overall Micro-Averaged Metrics
    micro_p = total_tp / (total_tp + total_fp) if (total_tp + total_fp) > 0 else 0.0
    micro_r = total_tp / (total_tp + total_fn) if (total_tp + total_fn) > 0 else 0.0
    micro_f1 = (2 * micro_p * micro_r) / (micro_p + micro_r) if (micro_p + micro_r) > 0 else 0.0

    return {
        "overall": {
            "precision": round(micro_p, 4),
            "recall": round(micro_r, 4),
            "f1": round(micro_f1, 4),
            "total_samples": len(annotated_dataset),
            "total_tp": total_tp,
            "total_fp": total_fp,
            "total_fn": total_fn
        },
        "samples": individual_results
    }
