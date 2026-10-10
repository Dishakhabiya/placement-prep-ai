from typing import List, Dict, Any
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from module1.matching.normalize import normalize_skill_list


def link_projects_to_responsibilities(
    projects: List[Dict[str, Any]],
    responsibilities: List[str]
) -> List[Dict[str, Any]]:
    """
    Links candidate projects to target job responsibilities by computing
    semantic/lexical relevance scores (0.0 - 1.0) using TF-IDF and tech overlap.

    Returns a list of dicts: [{"project": str, "responsibility": str, "similarity": float}]
    """
    if not projects or not responsibilities:
        return []

    links: List[Dict[str, Any]] = []

    # Prepare project representations
    project_corpus = []
    project_meta = []
    for p in projects:
        title = p.get("title", "").strip() or "Untitled Project"
        desc = p.get("description", "").strip()
        tech = " ".join(normalize_skill_list(p.get("tech", [])))
        combined_text = f"{title}. {desc} Technologies: {tech}"
        project_corpus.append(combined_text)
        project_meta.append((title, set(t.lower() for t in p.get("tech", []))))

    # Vectorize using TF-IDF with sublinear tf scaling and English stop words
    vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
    all_texts = project_corpus + responsibilities

    try:
        tfidf_matrix = vectorizer.fit_transform(all_texts)
        proj_matrix = tfidf_matrix[:len(project_corpus)]
        resp_matrix = tfidf_matrix[len(project_corpus):]

        sim_matrix = cosine_similarity(proj_matrix, resp_matrix)
    except Exception:
        # Fallback if vocabulary is too sparse or empty
        sim_matrix = np.zeros((len(project_corpus), len(responsibilities)))

    for p_idx, (p_title, p_tech_set) in enumerate(project_meta):
        for r_idx, resp in enumerate(responsibilities):
            lexical_sim = float(sim_matrix[p_idx][r_idx])

            # Bonus if project tech words explicitly appear in the responsibility
            resp_lower = resp.lower()
            overlap_bonus = 0.0
            if p_tech_set:
                matched_tech_count = sum(1 for t in p_tech_set if t in resp_lower)
                overlap_bonus = min(0.3, matched_tech_count * 0.1)

            final_sim = min(1.0, max(0.0, lexical_sim * 0.7 + overlap_bonus + 0.05 if lexical_sim > 0 else 0.0))
            final_sim = round(final_sim, 2)

            if final_sim > 0.15:  # Only record meaningful links
                links.append({
                    "project": p_title,
                    "responsibility": resp,
                    "similarity": final_sim
                })

    # Sort links by similarity descending
    links.sort(key=lambda x: x["similarity"], reverse=True)
    return links
