"""
module4/sbert_analyzer.py
=========================
Sentence-BERT (SBERT) Semantic Answer Quality Analyzer — Module 4

Research Objective (Member 4):
    "To analyze observable speaking indicators and semantic answer quality,
     and integrate these results into a personalized performance report."
    Model: Sentence-BERT (SBERT)

What this module does:
    1. Loads a lightweight SBERT model (all-MiniLM-L6-v2, ~80 MB) locally.
    2. Encodes candidate answer text and expected key concepts as dense
       semantic vectors (embeddings).
    3. Computes cosine similarity between the answer embedding and each
       concept embedding — this detects paraphrases that keyword matching misses.
       e.g. "memory recycling" matches "garbage collection" via semantics.
    4. Returns per-concept semantic similarity scores and a composite
       SemanticQualityResult for inclusion in the performance report.

Fallback:
    If sentence-transformers is not installed or the model fails to load,
    all functions degrade gracefully to a TF-IDF cosine similarity baseline
    (same as module3/evaluator.py currently uses).
"""

import logging
from typing import List, Dict, Optional, Tuple
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# ── SBERT Model Configuration ────────────────────────────────────────────────
SBERT_MODEL_NAME = "all-MiniLM-L6-v2"   # 80 MB, fast, high quality
_sbert_model = None                        # Lazy-loaded singleton
_sbert_available: Optional[bool] = None   # None = not yet checked


# ── Schema ───────────────────────────────────────────────────────────────────

class ConceptSemanticScore(BaseModel):
    """Per-concept semantic similarity result from SBERT."""
    concept: str = Field(..., description="Expected key concept text")
    similarity_score: float = Field(
        ..., ge=0.0, le=1.0,
        description="Cosine similarity between answer embedding and concept embedding (0–1)"
    )
    covered: bool = Field(
        ...,
        description="True if similarity_score >= threshold (concept semantically addressed)"
    )


class SemanticQualityResult(BaseModel):
    """
    Full SBERT-based semantic quality analysis for a single candidate answer.
    Included in the Module 4 performance report.
    """
    model_used: str = Field(
        default=SBERT_MODEL_NAME,
        description="SBERT model name used for embedding"
    )
    semantic_coverage_score: float = Field(
        ..., ge=0.0, le=100.0,
        description="Percentage of expected concepts semantically addressed (0–100)"
    )
    avg_similarity: float = Field(
        ..., ge=0.0, le=1.0,
        description="Mean cosine similarity across all concept–answer pairs"
    )
    concept_scores: List[ConceptSemanticScore] = Field(
        default_factory=list,
        description="Per-concept semantic similarity breakdown"
    )
    semantically_covered: List[str] = Field(
        default_factory=list,
        description="Concepts the candidate semantically addressed"
    )
    semantically_missing: List[str] = Field(
        default_factory=list,
        description="Concepts the candidate did not address"
    )
    answer_embedding_norm: float = Field(
        default=0.0,
        description="L2 norm of the answer embedding vector (proxy for answer richness)"
    )
    quality_label: str = Field(
        default="",
        description="Human-readable quality band: Excellent / Good / Partial / Weak"
    )
    coaching_note: str = Field(
        default="",
        description="Personalised coaching tip based on semantic coverage"
    )
    fallback_used: bool = Field(
        default=False,
        description="True if SBERT was unavailable and TF-IDF fallback was used"
    )


# ── Model Loading ─────────────────────────────────────────────────────────────

def is_sbert_available() -> bool:
    """Returns True if sentence-transformers is installed and the model can load."""
    global _sbert_available
    if _sbert_available is not None:
        return _sbert_available
    try:
        from sentence_transformers import SentenceTransformer  # noqa: F401
        _sbert_available = True
        logger.info("sentence-transformers is available — SBERT ready.")
    except ImportError:
        _sbert_available = False
        logger.warning(
            "sentence-transformers not installed. "
            "Run: pip install sentence-transformers\n"
            "Falling back to TF-IDF cosine similarity."
        )
    return _sbert_available


def load_sbert() -> Optional[object]:
    """
    Lazily loads the SBERT model (all-MiniLM-L6-v2).
    Returns the SentenceTransformer instance, or None if unavailable.
    """
    global _sbert_model
    if _sbert_model is not None:
        return _sbert_model
    if not is_sbert_available():
        return None
    try:
        from sentence_transformers import SentenceTransformer
        logger.info(f"Loading SBERT model '{SBERT_MODEL_NAME}'...")
        _sbert_model = SentenceTransformer(SBERT_MODEL_NAME)
        logger.info("SBERT model loaded successfully.")
        return _sbert_model
    except Exception as e:
        logger.error(f"Failed to load SBERT model '{SBERT_MODEL_NAME}': {e}")
        return None


# ── Core Semantic Scoring ──────────────────────────────────────────────────────

def _cosine_similarity_numpy(a, b) -> float:
    """Compute cosine similarity between two 1-D numpy arrays."""
    import numpy as np
    norm_a = float(np.linalg.norm(a))
    norm_b = float(np.linalg.norm(b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def _tfidf_fallback(
    answer_text: str,
    concepts: List[str],
    threshold: float,
) -> Tuple[List[ConceptSemanticScore], bool]:
    """
    TF-IDF cosine similarity fallback when SBERT is unavailable.
    Returns (concept_scores, fallback_used=True).
    """
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity as sk_cos

    scores: List[ConceptSemanticScore] = []
    for concept in concepts:
        try:
            vec = TfidfVectorizer().fit_transform([answer_text, concept])
            sim = float(sk_cos(vec[0], vec[1])[0][0])
        except Exception:
            sim = 0.0
        scores.append(ConceptSemanticScore(
            concept=concept,
            similarity_score=round(sim, 4),
            covered=sim >= threshold,
        ))
    return scores, True


DEFAULT_SEMANTIC_THRESHOLD = 0.30


def score_answer_semantics(
    answer_text: str,
    expected_concepts: List[str],
    threshold: float = DEFAULT_SEMANTIC_THRESHOLD,
) -> SemanticQualityResult:
    """
    Core SBERT semantic scoring function.

    Args:
        answer_text:       Raw candidate answer transcript.
        expected_concepts: List of expected key concept strings for the question.
        threshold:         Cosine similarity threshold above which a concept is
                           considered semantically covered (default 0.30).

    Returns:
        SemanticQualityResult with per-concept scores and composite metrics.
    """
    import numpy as np

    if not answer_text or not answer_text.strip():
        return SemanticQualityResult(
            semantic_coverage_score=0.0,
            avg_similarity=0.0,
            quality_label="No Answer",
            coaching_note="No spoken content was detected for this question.",
        )

    if not expected_concepts:
        return SemanticQualityResult(
            semantic_coverage_score=100.0,
            avg_similarity=1.0,
            quality_label="No Concepts",
            coaching_note="No expected concepts were defined for this question.",
        )

    model = load_sbert()
    fallback_used = model is None

    # ── Compute embeddings ──
    if not fallback_used:
        try:
            all_texts = [answer_text] + expected_concepts
            embeddings = model.encode(all_texts, convert_to_numpy=True, show_progress_bar=False)
            answer_emb = embeddings[0]
            concept_embs = embeddings[1:]
            answer_norm = float(np.linalg.norm(answer_emb))

            concept_scores: List[ConceptSemanticScore] = []
            for i, concept in enumerate(expected_concepts):
                sim = _cosine_similarity_numpy(answer_emb, concept_embs[i])
                concept_scores.append(ConceptSemanticScore(
                    concept=concept,
                    similarity_score=round(sim, 4),
                    covered=sim >= threshold,
                ))
        except Exception as e:
            logger.warning(f"SBERT encode failed, falling back to TF-IDF: {e}")
            concept_scores, fallback_used = _tfidf_fallback(answer_text, expected_concepts, threshold)
            answer_norm = 0.0
    else:
        concept_scores, fallback_used = _tfidf_fallback(answer_text, expected_concepts, threshold)
        answer_norm = 0.0

    # ── Aggregate ──
    covered = [cs for cs in concept_scores if cs.covered]
    missing = [cs for cs in concept_scores if not cs.covered]
    n = len(concept_scores)
    coverage_pct = round((len(covered) / n) * 100.0, 1) if n > 0 else 0.0
    avg_sim = round(sum(cs.similarity_score for cs in concept_scores) / n, 4) if n > 0 else 0.0

    # ── Quality label ──
    if coverage_pct >= 85:
        quality_label = "Excellent"
    elif coverage_pct >= 65:
        quality_label = "Good"
    elif coverage_pct >= 40:
        quality_label = "Partial"
    else:
        quality_label = "Weak"

    # ── Coaching note ──
    if missing:
        missing_names = ", ".join(f"'{cs.concept}'" for cs in missing[:3])
        coaching_note = (
            f"Your answer semantically covered {len(covered)}/{n} expected concepts "
            f"(semantic coverage: {coverage_pct}%). "
            f"Consider elaborating on: {missing_names}."
        )
    else:
        coaching_note = (
            f"Excellent semantic coverage — all {n} expected concepts were addressed "
            f"with an average similarity of {avg_sim:.2f}."
        )

    return SemanticQualityResult(
        model_used=SBERT_MODEL_NAME if not fallback_used else "TF-IDF-Fallback",
        semantic_coverage_score=coverage_pct,
        avg_similarity=avg_sim,
        concept_scores=concept_scores,
        semantically_covered=[cs.concept for cs in covered],
        semantically_missing=[cs.concept for cs in missing],
        answer_embedding_norm=round(answer_norm, 4),
        quality_label=quality_label,
        coaching_note=coaching_note,
        fallback_used=fallback_used,
    )


# ── Batch scoring (for full session report) ───────────────────────────────────

def score_session_answers(
    answers: List[Dict],
    threshold: float = 0.35,
) -> List[Dict]:
    """
    Batch-scores all answers in a session using SBERT.

    Each answer dict must have:
        - 'answer_text' or 'transcript': str
        - 'expected_concepts': List[str]
        - 'question_id': str

    Returns a list of dicts with original fields + 'semantic_quality' key.
    """
    results = []
    for answer in answers:
        text = answer.get("answer_text") or answer.get("transcript", "")
        concepts = answer.get("expected_concepts") or answer.get("expected_key_concepts") or []
        semantic = score_answer_semantics(text, concepts, threshold)
        results.append({
            **answer,
            "semantic_quality": semantic.model_dump(),
        })
    return results


# ── Utility ───────────────────────────────────────────────────────────────────

def get_sbert_status() -> Dict:
    """Returns SBERT availability status for health-check / debug endpoints."""
    available = is_sbert_available()
    model_loaded = _sbert_model is not None
    return {
        "sbert_available": available,
        "model_loaded": model_loaded,
        "model_name": SBERT_MODEL_NAME,
        "fallback": "TF-IDF cosine similarity" if not available else None,
        "install_hint": "pip install sentence-transformers" if not available else None,
    }
