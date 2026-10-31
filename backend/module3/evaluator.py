import re
import os
import json
import logging
from datetime import datetime, timezone
from typing import List, Dict, Tuple, Optional, Set
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from module3.schemas import (
    ConceptStatus,
    ConceptCoverageItem,
    ConceptCoverageSummary,
    AnswerRelevanceResult,
    TranscriptMetadata,
    AnswerEvaluationResponse,
)

logger = logging.getLogger(__name__)

# Basic English stopwords to filter when tokenizing concepts
STOP_WORDS: Set[str] = {
    "a", "an", "the", "and", "or", "of", "in", "on", "at", "to", "for", "with",
    "by", "about", "as", "into", "like", "through", "after", "over", "between",
    "out", "against", "during", "without", "before", "under", "around", "among",
    "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
    "do", "does", "did", "can", "could", "should", "would", "how", "what", "why"
}

# Common technical concept aliases & expansions
CONCEPT_SYNONYMS: Dict[str, List[str]] = {
    "gil": ["global interpreter lock", "interpreter lock"],
    "gc": ["garbage collection", "garbage collector", "memory recycling"],
    "garbage collection": ["gc", "garbage collector", "generational gc", "reference counting"],
    "reference counting": ["ref count", "ref counting", "reference counter"],
    "async/await": ["async", "await", "asynchronous", "coroutine", "coroutines"],
    "pydantic validation": ["pydantic", "schema validation", "request validation"],
    "dependency injection": ["di", "depends", "injected dependency", "ioc"],
    "virtual dom": ["vdom", "diffing", "reconciliation", "fiber"],
    "usememo & usecallback": ["usememo", "usecallback", "memoization", "memo"],
    "usestate & useeffect": ["usestate", "useeffect", "state hook", "effect hook", "hooks"],
    "acid compliance": ["acid", "atomicity", "consistency", "isolation", "durability"],
    "b-tree indexes": ["btree", "b-tree", "indexing", "index", "indices"],
    "join types": ["inner join", "left join", "outer join", "cross join", "joins"],
    "containerization": ["container", "containers", "docker", "dockerfile", "image"],
    "multi-stage builds": ["multi-stage", "multistage", "build stage", "builder pattern"],
    "volumes & binding": ["volume", "volumes", "bind mount", "persistent storage"],
    "merge vs rebase": ["git merge", "git rebase", "rebase", "fast-forward", "merge commit"],
    "conflict resolution": ["merge conflict", "conflicts", "resolving conflicts"],
    "big-o notation": ["time complexity", "space complexity", "o(1)", "o(n)", "o(log n)", "big o"],
    "hashmap + doubly linkedlist": ["hashmap", "hash map", "doubly linked list", "lru cache", "linked list"],
    "recursion & memoization": ["dynamic programming", "memoization", "recursion", "memoize", "top-down"],
    "tree traversals": ["inorder", "preorder", "postorder", "bfs", "dfs", "binary tree"],
    "immutability": ["immutable", "unmodifiable", "cannot be changed", "tuple"],
    "rest apis": ["rest", "restful", "endpoints", "http methods", "json api"],
    "microservices": ["microservice", "service-oriented", "decoupled services"]
}


def normalize_text(text: Optional[str]) -> str:
    """
    Cleans and canonicalizes text for robust token and phrase matching:
    - Normalizes unicode whitespace and quotes
    - Lowers case
    - Preserves internal hyphens and underscores in technical identifiers
    - Collapses consecutive whitespace
    """
    if not text:
        return ""
    
    # Replace non-standard whitespace and smart quotes
    cleaned = text.replace("\u00a0", " ").replace("“", '"').replace("”", '"').replace("’", "'").replace("‘", "'")
    cleaned = cleaned.lower()
    
    # Replace punctuation that is not part of a hyphenated technical term or slash
    cleaned = re.sub(r"[^\w\s\-/]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def _tokenize_meaningful_terms(text: str) -> List[str]:
    """Extracts non-stopword alphanumeric terms of length >= 2."""
    raw_tokens = re.findall(r"[a-z0-9]+(?:-[a-z0-9]+)*", text.lower())
    return [t for t in raw_tokens if t not in STOP_WORDS and len(t) >= 2]


def evaluate_concept_coverage(
    expected_concepts: List[str],
    transcript: str
) -> ConceptCoverageSummary:
    """
    Evaluates whether each expected concept from QuestionItem is covered in the candidate's answer.
    Assigns:
      - 'covered' (1.0): exact phrase, known alias/synonym, or all core content terms found.
      - 'partially_covered' (0.5): at least half (or >=1) of the key component terms appear.
      - 'missing' (0.0): none of the concept's key terms or synonyms are detected.
    """
    normalized_transcript = normalize_text(transcript)
    items: List[ConceptCoverageItem] = []

    if not expected_concepts:
        # No concepts expected for this question
        return ConceptCoverageSummary(
            total_expected=0,
            covered_count=0,
            partially_covered_count=0,
            missing_count=0,
            coverage_score=100.0 if normalized_transcript else 0.0,
            covered_concepts=[],
            partially_covered_concepts=[],
            missing_concepts=[],
            details=[],
            scoring_notes="No expected key concepts were specified for this question."
        )

    covered_list: List[str] = []
    partially_covered_list: List[str] = []
    missing_list: List[str] = []

    for concept in expected_concepts:
        clean_concept = concept.strip()
        norm_concept = normalize_text(clean_concept)
        if not norm_concept:
            continue

        # Check 1: Exact normalized phrase match
        if norm_concept in normalized_transcript:
            items.append(ConceptCoverageItem(
                concept=clean_concept,
                status=ConceptStatus.COVERED,
                matched_phrase=norm_concept,
                score=1.0,
                explanation=f"Exact match for concept '{clean_concept}' identified in response."
            ))
            covered_list.append(clean_concept)
            continue

        # Check 2: Known technical alias / synonym check
        synonyms = CONCEPT_SYNONYMS.get(norm_concept, [])
        matched_synonym = None
        for syn in synonyms:
            if syn in normalized_transcript:
                matched_synonym = syn
                break

        if matched_synonym:
            items.append(ConceptCoverageItem(
                concept=clean_concept,
                status=ConceptStatus.COVERED,
                matched_phrase=matched_synonym,
                score=1.0,
                explanation=f"Equivalent technical synonym '{matched_synonym}' found for concept '{clean_concept}'."
            ))
            covered_list.append(clean_concept)
            continue

        # Check 3: Token-level decomposition and partial matching
        concept_terms = _tokenize_meaningful_terms(clean_concept)
        if not concept_terms:
            # Fallback if concept consisted only of stopwords or symbols
            if norm_concept in normalized_transcript:
                items.append(ConceptCoverageItem(
                    concept=clean_concept,
                    status=ConceptStatus.COVERED,
                    matched_phrase=norm_concept,
                    score=1.0,
                    explanation=f"Concept matched transcript."
                ))
                covered_list.append(clean_concept)
            else:
                items.append(ConceptCoverageItem(
                    concept=clean_concept,
                    status=ConceptStatus.MISSING,
                    matched_phrase=None,
                    score=0.0,
                    explanation=f"Concept '{clean_concept}' not detected in transcript."
                ))
                missing_list.append(clean_concept)
            continue

        matched_tokens = [t for t in concept_terms if t in normalized_transcript]
        match_ratio = len(matched_tokens) / len(concept_terms)

        if match_ratio == 1.0:
            # All individual words found in answer
            items.append(ConceptCoverageItem(
                concept=clean_concept,
                status=ConceptStatus.COVERED,
                matched_phrase=", ".join(matched_tokens),
                score=1.0,
                explanation=f"All key component words ({', '.join(matched_tokens)}) were discussed."
            ))
            covered_list.append(clean_concept)
        elif match_ratio >= 0.5 or (len(concept_terms) > 1 and len(matched_tokens) >= 1):
            # Partial coverage
            items.append(ConceptCoverageItem(
                concept=clean_concept,
                status=ConceptStatus.PARTIALLY_COVERED,
                matched_phrase=", ".join(matched_tokens),
                score=0.5,
                explanation=f"Partially covered: terms '{', '.join(matched_tokens)}' were mentioned, but full concept was not elaborated."
            ))
            partially_covered_list.append(clean_concept)
        else:
            # Missing
            items.append(ConceptCoverageItem(
                concept=clean_concept,
                status=ConceptStatus.MISSING,
                matched_phrase=None,
                score=0.0,
                explanation=f"Concept '{clean_concept}' was not addressed in candidate response."
            ))
            missing_list.append(clean_concept)

    total_expected = len(items)
    if total_expected > 0:
        total_score_sum = sum(item.score for item in items)
        coverage_score = round((total_score_sum / total_expected) * 100.0, 1)
    else:
        coverage_score = 0.0

    notes = (
        "Coverage evaluates occurrence of expected technical terms and known aliases. "
        "Full coverage (1.0) indicates explicit mention or complete keyword alignment; "
        "partial coverage (0.5) indicates related component keywords were touched upon; "
        "missing (0.0) indicates absence. High keyword coverage correlates with topic discussion "
        "but does not guarantee complete architectural accuracy."
    )

    return ConceptCoverageSummary(
        total_expected=total_expected,
        covered_count=len(covered_list),
        partially_covered_count=len(partially_covered_list),
        missing_count=len(missing_list),
        coverage_score=coverage_score,
        covered_concepts=covered_list,
        partially_covered_concepts=partially_covered_list,
        missing_concepts=missing_list,
        details=items,
        scoring_notes=notes
    )


def _stem_term(term: str) -> str:
    """Lightweight suffix-stripping stemmer for common English technical grammatical inflections."""
    t = term.lower().strip()
    for suffix in ("ization", "isations", "isation", "ising", "izing", "ation", "tions", "tion", "ments", "ment", "ings", "ing", "ers", "er", "ies", "ed", "es", "s"):
        if t.endswith(suffix) and len(t) - len(suffix) >= 3:
            return t[:-len(suffix)]
    return t


def _match_terms_and_roots(ref_tokens: Set[str], ans_tokens: Set[str]) -> Tuple[List[str], float]:
    """
    Finds direct keyword matches and root-stem matches (e.g. 'containerization' and 'containers',
    'isolate' and 'isolation', 'processes' and 'process').
    Returns (list of matching terms, coverage ratio).
    """
    matched_ref_roots = set()
    matched_terms = []

    for r in ref_tokens:
        rs = _stem_term(r)
        for a in ans_tokens:
            as_ = _stem_term(a)
            if r == a or rs == as_ or (len(rs) >= 4 and len(as_) >= 4 and (rs.startswith(as_) or as_.startswith(rs))):
                matched_ref_roots.add(r)
                if a not in matched_terms:
                    matched_terms.append(a)
                break

    root_coverage_ratio = len(matched_ref_roots) / max(len(ref_tokens), 1) if ref_tokens else 0.0
    return sorted(matched_terms), root_coverage_ratio


def estimate_answer_relevance(
    question_text: str,
    transcript: str,
    expected_concepts: Optional[List[str]] = None
) -> AnswerRelevanceResult:
    """
    Estimates the relevance of the candidate's answer to the original interview question.
    Uses TF-IDF sub-linear n-gram cosine similarity enriched with question context,
    stem-aligned keyword overlap, and concept coverage calibrated to a 0-100 scale.
    """
    clean_q = normalize_text(question_text)
    clean_a = normalize_text(transcript)

    # Empty answer check
    if not clean_a or len(clean_a.strip()) == 0:
        return AnswerRelevanceResult(
            relevance_score=0.0,
            method="tfidf_cosine_with_keyword_alignment",
            interpretation="Low Relevance / Off-Topic",
            key_matching_terms=[],
            notes="Candidate answer is empty or contains no recognized speech."
        )

    # Build reference context: question text + expected concepts
    concept_str = " ".join([normalize_text(c) for c in (expected_concepts or [])])
    reference_context = f"{clean_q} {concept_str}".strip()

    # Extract matching tokens & morphological stems
    ref_tokens = set(_tokenize_meaningful_terms(reference_context))
    ans_tokens = set(_tokenize_meaningful_terms(clean_a))
    matched_terms, root_coverage_ratio = _match_terms_and_roots(ref_tokens, ans_tokens)

    # Compute TF-IDF Cosine Similarity
    try:
        vectorizer = TfidfVectorizer(
            ngram_range=(1, 2),
            sublinear_tf=True,
            stop_words="english"
        )
        tfidf_matrix = vectorizer.fit_transform([reference_context, clean_a])
        cos_sim = float(cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0])
    except Exception as e:
        logger.warning(f"TF-IDF similarity calculation encountered exception: {e}.")
        cos_sim = root_coverage_ratio

    # Calculate concept coverage if concepts provided
    concept_score = 0.0
    if expected_concepts:
        cov = evaluate_concept_coverage(expected_concepts, transcript)
        concept_score = cov.coverage_score / 100.0

    # Calibrated relevance score:
    # Blend root/stem keyword alignment, concept coverage, and TF-IDF cosine similarity
    if expected_concepts:
        raw_metric = (root_coverage_ratio * 0.45) + (concept_score * 0.35) + (cos_sim * 0.20)
    else:
        raw_metric = (root_coverage_ratio * 0.65) + (cos_sim * 0.35)

    scaled_score = min(100.0, max(0.0, raw_metric * 115.0))
    final_score = round(scaled_score, 1)

    if final_score >= 60.0:
        interpretation = "High Relevance"
    elif final_score >= 30.0:
        interpretation = "Moderate Relevance"
    else:
        interpretation = "Low Relevance / Off-Topic"

    notes = (
        f"Calculated using TF-IDF n-gram cosine similarity ({round(cos_sim, 3)}) "
        f"combined with root/keyword alignment ratio ({round(root_coverage_ratio, 3)}) "
        f"and concept coverage contribution. "
        "Measures domain vocabulary alignment between question context and candidate response; "
        "does not evaluate factual depth or technical rigor."
    )

    return AnswerRelevanceResult(
        relevance_score=final_score,
        method="tfidf_cosine_with_keyword_alignment",
        interpretation=interpretation,
        key_matching_terms=matched_terms[:10],
        notes=notes
    )



def extract_transcript_metadata(
    transcript: str,
    duration_seconds: Optional[float] = None,
    detected_language: Optional[str] = "en",
    language_probability: Optional[float] = 1.0,
    model_used: Optional[str] = "whisper-base",
    processing_time_seconds: Optional[float] = None,
    status: str = "success"
) -> TranscriptMetadata:
    """Computes textual word and character metrics for the transcript."""
    words = [w for w in transcript.strip().split() if w]
    word_count = len(words)
    char_count = len(transcript.strip())

    return TranscriptMetadata(
        transcript=transcript.strip(),
        word_count=word_count,
        char_count=char_count,
        detected_language=detected_language,
        language_probability=language_probability,
        duration_seconds=duration_seconds,
        model_used=model_used,
        processing_time_seconds=processing_time_seconds,
        status=status if word_count > 0 else "silent_or_empty"
    )


def evaluate_answer(
    question_id: str,
    question_text: str,
    expected_concepts: List[str],
    transcript: str,
    profile_id: Optional[str] = None,
    session_id: Optional[str] = None,
    metadata: Optional[TranscriptMetadata] = None,
    evaluation_id: Optional[str] = None
) -> AnswerEvaluationResponse:
    """
    Orchestrates transcript metadata generation, concept coverage tracking,
    and answer relevance analysis into a unified AnswerEvaluationResponse.
    """
    clean_transcript = transcript.strip() if transcript else ""
    meta = metadata or extract_transcript_metadata(clean_transcript)
    
    # Analyze Expected-Concept Coverage
    coverage_result = evaluate_concept_coverage(
        expected_concepts=expected_concepts,
        transcript=clean_transcript
    )

    # Estimate Answer Relevance
    relevance_result = estimate_answer_relevance(
        question_text=question_text,
        transcript=clean_transcript,
        expected_concepts=expected_concepts
    )

    eval_id = evaluation_id or f"eval_{os.urandom(6).hex()}"
    evaluated_at = datetime.now(timezone.utc).isoformat()

    return AnswerEvaluationResponse(
        evaluation_id=eval_id,
        profile_id=profile_id,
        session_id=session_id,
        question_id=question_id,
        question_text=question_text,
        transcript_metadata=meta,
        relevance=relevance_result,
        concept_coverage=coverage_result,
        evaluated_at=evaluated_at
    )
