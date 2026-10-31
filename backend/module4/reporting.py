from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from .schemas import (
    QuestionReportItem,
    SessionReportResponse,
)
from .delivery import rate_speaking_pace


def aggregate_session_report(
    evaluations: List[Dict[str, Any]],
    total_questions: Optional[int] = None,
    questions: Optional[List[Dict[str, Any]]] = None,
    profile_id: Optional[str] = None,
    session_id: Optional[str] = None,
    candidate_name: Optional[str] = "Candidate",
    target_role: Optional[str] = "Software Engineer",
    visual_issues: Optional[List[Dict[str, Any]]] = None,
) -> SessionReportResponse:
    """
    Aggregates interview performance across all evaluated questions in a session.
    Computes genuine averages for relevance, concept coverage, delivery pacing,
    filler words, pauses, and computer vision framing stability.
    """
    # Count truly answered evaluations (with genuine speech)
    genuine_evaluations = [
        ev for ev in evaluations
        if int(ev.get("transcript_metadata", {}).get("word_count", 0)) >= 3
        and ev.get("transcript_metadata", {}).get("transcript", "").strip()
    ]
    answered_count = len(genuine_evaluations)
    total_q_count = total_questions if total_questions and total_questions > 0 else (
        len(questions) if questions else max(len(evaluations), 1)
    )

    if total_q_count < answered_count:
        total_q_count = answered_count

    completion_rate = round((answered_count / total_q_count) * 100.0, 1) if total_q_count > 0 else 0.0

    # 1. Accumulate metrics across answered questions
    relevance_scores: List[float] = []
    coverage_scores: List[float] = []
    semantic_coverage_scores: List[float] = []
    semantic_similarities: List[float] = []
    sbert_model_used: Optional[str] = None
    total_covered_concepts = 0
    total_missing_concepts = 0

    total_words_spoken = 0
    total_speaking_duration = 0.0
    wpm_list: List[float] = []
    total_fillers = 0
    filler_counts_map: Dict[str, int] = {}
    total_extended_pauses = 0

    face_presence_ratios: List[float] = []
    face_centering_ratios: List[float] = []
    video_answers_count = 0

    # Map of question_id -> evaluation for easy lookup when building per-question breakdown
    eval_by_qid: Dict[str, Dict[str, Any]] = {}

    for ev in evaluations:
        qid = str(ev.get("question_id", ""))
        if qid:
            eval_by_qid[qid] = ev

    for ev in genuine_evaluations:

        # Relevance
        rel = ev.get("relevance", {})
        if isinstance(rel, dict) and "relevance_score" in rel:
            try:
                relevance_scores.append(float(rel["relevance_score"]))
            except (ValueError, TypeError):
                pass

        # Concept Coverage
        cov = ev.get("concept_coverage", {})
        if isinstance(cov, dict):
            if "coverage_score" in cov:
                try:
                    coverage_scores.append(float(cov["coverage_score"]))
                except (ValueError, TypeError):
                    pass
            covered_list = cov.get("covered_concepts", [])
            missing_list = cov.get("missing_concepts", [])
            total_covered_concepts += len(covered_list)
            total_missing_concepts += len(missing_list)

        # Transcript Metadata
        meta = ev.get("transcript_metadata", {})
        if isinstance(meta, dict):
            words = meta.get("word_count", 0)
            dur = meta.get("duration_seconds", 0.0)
            if words:
                total_words_spoken += int(words)
            if dur:
                total_speaking_duration += float(dur)

        # Speaking Delivery Metrics
        deliv = ev.get("delivery_metrics", {})
        if isinstance(deliv, dict) and deliv:
            if "words_per_minute" in deliv:
                try:
                    wpm_list.append(float(deliv["words_per_minute"]))
                except (ValueError, TypeError):
                    pass
            if "total_filler_words" in deliv:
                total_fillers += int(deliv.get("total_filler_words", 0))
            if "extended_pause_count" in deliv:
                total_extended_pauses += int(deliv.get("extended_pause_count", 0))
            breakdown = deliv.get("filler_word_breakdown", {})
            if isinstance(breakdown, dict):
                for word, count in breakdown.items():
                    filler_counts_map[word] = filler_counts_map.get(word, 0) + int(count)

        # Visual Framing Metrics
        vis = ev.get("visual_metrics", {})
        if isinstance(vis, dict) and vis.get("video_track_detected", False):
            video_answers_count += 1
            if "face_presence_ratio" in vis:
                face_presence_ratios.append(float(vis["face_presence_ratio"]))
            if "face_centering_ratio" in vis:
                face_centering_ratios.append(float(vis["face_centering_ratio"]))

        # SBERT Semantic Quality Metrics
        sq = ev.get("semantic_quality")
        if isinstance(sq, dict):
            if "semantic_coverage_score" in sq:
                try:
                    semantic_coverage_scores.append(float(sq["semantic_coverage_score"]))
                except (ValueError, TypeError):
                    pass
            if "avg_similarity" in sq:
                try:
                    semantic_similarities.append(float(sq["avg_similarity"]))
                except (ValueError, TypeError):
                    pass
            if not sbert_model_used and sq.get("model_used"):
                sbert_model_used = str(sq.get("model_used"))

    # 2. Compute Aggregates
    if total_words_spoken == 0:
        avg_relevance = 0.0
        avg_coverage = 0.0
    else:
        avg_relevance = round(sum(relevance_scores) / len(relevance_scores), 1) if relevance_scores else 0.0
        avg_coverage = round(sum(coverage_scores) / len(coverage_scores), 1) if coverage_scores else 0.0

    avg_sem_coverage = (
        round(sum(semantic_coverage_scores) / len(semantic_coverage_scores), 1)
        if semantic_coverage_scores
        else None
    )
    avg_sem_similarity = (
        round(sum(semantic_similarities) / len(semantic_similarities), 3)
        if semantic_similarities
        else None
    )

    # Overall WPM: prefer overall total words / duration, or average of WPM list
    if total_words_spoken == 0:
        avg_wpm = 0.0
    elif total_speaking_duration > 0:
        avg_wpm = round((total_words_spoken / total_speaking_duration) * 60.0, 1)
    elif wpm_list:
        avg_wpm = round(sum(wpm_list) / len(wpm_list), 1)
    else:
        avg_wpm = 0.0

    overall_pace = rate_speaking_pace(avg_wpm) if avg_wpm > 0 else "Unknown"

    overall_filler_pct = (
        round((total_fillers / total_words_spoken) * 100.0, 1)
        if total_words_spoken > 0
        else 0.0
    )

    # Top 3 fillers sorted by frequency
    sorted_fillers = dict(
        sorted(filler_counts_map.items(), key=lambda item: item[1], reverse=True)[:5]
    )

    avg_face_presence = (
        round(sum(face_presence_ratios) / len(face_presence_ratios), 1)
        if face_presence_ratios
        else None
    )
    avg_face_centering = (
        round(sum(face_centering_ratios) / len(face_centering_ratios), 1)
        if face_centering_ratios
        else None
    )

    if video_answers_count > 0 and avg_face_presence is not None:
        if avg_face_presence >= 80.0 and (avg_face_centering or 0) >= 70.0:
            visual_summary = "Steady & Centered Video Framing"
        elif avg_face_presence >= 70.0:
            visual_summary = "Adequate Presence with Minor Drift"
        else:
            visual_summary = "Frequent Framing Out-of-Bounds"
    else:
        visual_summary = "Audio-Only Recording Mode"

    # 3. Overall Readiness Score (0-100)
    # Blend: 40% Relevance, 35% Concept Coverage, 15% Delivery (pace & low fillers), 10% Visual presence
    if answered_count > 0 and total_words_spoken > 0:
        delivery_score = 85.0
        if avg_wpm > 0:
            if 115.0 <= avg_wpm <= 160.0:
                delivery_score = 95.0
            elif 95.0 <= avg_wpm < 115.0 or 160.0 < avg_wpm <= 180.0:
                delivery_score = 80.0
            else:
                delivery_score = 65.0
        # Filler penalty
        if overall_filler_pct > 5.0:
            delivery_score = max(50.0, delivery_score - (overall_filler_pct - 5.0) * 3)

        if avg_face_presence is not None:
            visual_score = avg_face_presence
            readiness = (
                0.35 * avg_relevance +
                0.35 * avg_coverage +
                0.18 * delivery_score +
                0.12 * visual_score
            )
        else:
            readiness = (
                0.40 * avg_relevance +
                0.40 * avg_coverage +
                0.20 * delivery_score
            )

        # Apply behavioral penalties for visual violations (lying down, informal wear)
        if visual_issues:
            posture_violations = sum(1 for v in visual_issues if v.get("posture") == "lying_down")
            if posture_violations > 0:
                readiness = max(5.0, readiness - min(35.0, posture_violations * 15.0))
            attire_violations = sum(1 for v in visual_issues if v.get("attire") == "informal")
            if attire_violations > 0:
                readiness = max(5.0, readiness - min(15.0, attire_violations * 5.0))

        overall_readiness = round(min(100.0, max(0.0, readiness)), 1)
    else:
        overall_readiness = 0.0

    if overall_readiness >= 75.0 and completion_rate >= 70.0:
        readiness_tier = "Placement Ready"
    elif overall_readiness >= 55.0:
        readiness_tier = "Strong Potential"
    else:
        readiness_tier = "Needs Practice"

    # 4. Generate Key Strengths
    strengths: List[str] = []
    has_posture_issue = any(v.get("posture") == "lying_down" for v in (visual_issues or []))
    if answered_count > 0 and total_words_spoken >= 15:
        if avg_relevance >= 70.0:
            strengths.append(f"High answer relevance ({avg_relevance}%), directly addressing interview questions.")
        if avg_coverage >= 70.0:
            strengths.append(f"Strong concept coverage ({avg_coverage}%), demonstrating solid domain terminology.")
        if 110.0 <= avg_wpm <= 165.0 and total_words_spoken >= 20:
            strengths.append(f"Optimal speaking pace ({avg_wpm} WPM), maintaining clear conversational rhythm.")
        # Clean speech delivery only counts if content was substantive AND relevance is decent
        if overall_filler_pct <= 3.0 and total_words_spoken >= 20 and avg_relevance >= 50.0:
            strengths.append(f"Clean speech delivery with very low filler usage ({overall_filler_pct}%).")
        if avg_face_presence is not None and avg_face_presence >= 80.0 and not has_posture_issue:
            strengths.append(f"Consistent camera framing presence ({avg_face_presence}%) throughout the session.")
        if avg_sem_coverage is not None and avg_sem_coverage >= 70.0:
            strengths.append(f"Strong semantic answer depth ({avg_sem_coverage}% SBERT coverage) — effectively articulated core concepts in original phrasing.")
        if answered_count == total_q_count and total_q_count > 0 and avg_relevance >= 45.0:
            strengths.append(f"Full session completion ({answered_count}/{total_q_count} questions answered substantively).")

    # 5. Generate Areas for Improvement
    improvements: List[str] = []
    if answered_count == 0 or total_words_spoken == 0:
        improvements.append(
            "No spoken answers were detected during this interview session. Please speak your answer into the microphone during active recording to receive AI evaluation."
        )
    else:
        if avg_coverage < 65.0:
            improvements.append(
                f"Concept coverage averaged {avg_coverage}%. Integrate more technical keywords and architectural principles."
            )
        if avg_relevance < 65.0:
            improvements.append(
                f"Answer relevance was {avg_relevance}%. Focus answers directly on the core scenario asked by the interviewer."
            )
        if avg_wpm > 165.0:
            improvements.append(
                f"Pacing was fast ({avg_wpm} WPM). Slow down slightly during complex technical explanations to improve clarity."
            )
        elif 0 < avg_wpm < 105.0:
            improvements.append(
                f"Speaking pace was deliberate ({avg_wpm} WPM). Practice structured transitions to speak more fluidly."
            )
        if overall_filler_pct > 4.0:
            top_str = ", ".join([f"'{w}'" for w in list(sorted_fillers.keys())[:3]])
            improvements.append(
                f"Filler word density reached {overall_filler_pct}% ({total_fillers} total; top fillers: {top_str}). Replace with brief pauses."
            )
        if total_extended_pauses >= 3:
            improvements.append(
                f"Detected {total_extended_pauses} extended pauses (>1.5s). Organize thoughts using the STAR method before speaking."
            )
        if avg_face_presence is not None and avg_face_presence < 70.0:
            improvements.append(
                f"Face presence in camera was {avg_face_presence}%. Adjust webcam angle and seat height to remain centered."
            )
        if answered_count < total_q_count:
            improvements.append(
                f"Completed {answered_count} of {total_q_count} questions. Practice answering all questions to simulate real interviews."
            )

        # Visual monitoring alerts from real-time AI analysis
        if visual_issues:
            posture_issues = [v for v in visual_issues if v.get("posture") == "lying_down"]
            attire_issues = [v for v in visual_issues if v.get("attire") == "informal"]
            bg_issues = [v for v in visual_issues if v.get("background") == "extra_people"]
            eye_issues = [v for v in visual_issues if v.get("eye_contact") == "poor"]

            if posture_issues:
                improvements.append(
                    f"Posture concern detected {len(posture_issues)} time(s): You were observed lying down or with poor posture during the interview. "
                    "Always sit upright in a dedicated interview space."
                )
            if attire_issues:
                improvements.append(
                    f"Attire concern detected {len(attire_issues)} time(s): Informal clothing was observed. "
                    "Always dress in business casual or formal attire for interview practice."
                )
            if bg_issues:
                improvements.append(
                    f"Background concern: Other people were detected in your camera frame {len(bg_issues)} time(s). "
                    "Conduct interviews in a private, distraction-free space."
                )
            if eye_issues:
                improvements.append(
                    f"Eye contact: Poor eye contact with the camera was detected {len(eye_issues)} time(s). "
                    "Practice looking directly at the camera lens rather than your screen."
                )

    # 6. Actionable Coaching Recommendations
    recommendations: List[str] = []
    if answered_count == 0 or total_words_spoken == 0:
        recommendations.append(
            "Check that your microphone is unmuted and browser microphone permissions are enabled."
        )
        recommendations.append(
            "Practice speaking your answers aloud for at least 30-60 seconds so the AI speech evaluator can measure relevance and technical terminology."
        )
    else:
        if total_missing_concepts > 0:
            recommendations.append(
                f"Review the {total_missing_concepts} missed concept keywords identified across questions to expand technical depth."
            )
        if total_fillers > 5:
            recommendations.append(
                "Practice the 'pause-instead-of-filler' technique: take a silent breath instead of saying 'um' or 'like'."
            )
        if avg_face_centering is not None and avg_face_centering < 65.0:
            recommendations.append(
                "Position your webcam at eye level approximately 2-3 feet away so your face stays in the center 50% framing zone."
            )
        recommendations.append(
            "Leverage the adaptive follow-up prompts to practice defending technical trade-offs under probing questions."
        )

    # 7. Build Per-Question Breakdown
    breakdown: List[QuestionReportItem] = []

    # If full questions list is provided, iterate in order; otherwise iterate evaluations
    if questions:
        for q in questions:
            qid = str(q.get("question_id", ""))
            ev = eval_by_qid.get(qid)
            if ev:
                cov = ev.get("concept_coverage", {})
                rel = ev.get("relevance", {})
                meta = ev.get("transcript_metadata", {})
                deliv = ev.get("delivery_metrics", {}) or {}
                vis = ev.get("visual_metrics", {}) or {}
                sq = ev.get("semantic_quality", {}) or {}

                words_cnt = int(meta.get("word_count", 0))
                q_transcript = meta.get("transcript", "")
                is_q_answered = words_cnt >= 3 and bool(q_transcript.strip())

                sem_cov = float(sq["semantic_coverage_score"]) if (is_q_answered and "semantic_coverage_score" in sq) else None
                sem_sim = float(sq["avg_similarity"]) if (is_q_answered and "avg_similarity" in sq) else None
                sem_covered = sq.get("semantically_covered", []) if is_q_answered else []

                breakdown.append(
                    QuestionReportItem(
                        question_id=qid,
                        question_text=str(q.get("question_text", ev.get("question_text", ""))),
                        target_topic=q.get("target_topic"),
                        category=q.get("category"),
                        difficulty=q.get("difficulty"),
                        status="answered" if is_q_answered else "skipped",
                        transcript=q_transcript if is_q_answered else None,
                        relevance_score=float(rel.get("relevance_score", 0.0)) if (is_q_answered and "relevance_score" in rel) else None,
                        coverage_score=float(cov.get("coverage_score", 0.0)) if (is_q_answered and "coverage_score" in cov) else None,
                        semantic_coverage_score=sem_cov,
                        semantic_similarity=sem_sim,
                        covered_concepts=cov.get("covered_concepts", []) if is_q_answered else [],
                        missing_concepts=cov.get("missing_concepts", []),
                        semantically_covered=sem_covered,
                        words_per_minute=float(deliv.get("words_per_minute")) if (is_q_answered and deliv.get("words_per_minute") is not None) else None,
                        filler_word_count=int(deliv.get("total_filler_words", 0)) if "total_filler_words" in deliv else None,
                        extended_pause_count=int(deliv.get("extended_pause_count", 0)) if "extended_pause_count" in deliv else None,
                        face_presence_ratio=float(vis.get("face_presence_ratio")) if vis.get("face_presence_ratio") is not None else None,
                        face_centering_ratio=float(vis.get("face_centering_ratio")) if vis.get("face_centering_ratio") is not None else None,
                        followup_question=ev.get("followup", {}).get("followup_question") if isinstance(ev.get("followup"), dict) else None,
                        followup_focus=ev.get("followup", {}).get("focus_area") if isinstance(ev.get("followup"), dict) else None,
                    )
                )
            else:
                breakdown.append(
                    QuestionReportItem(
                        question_id=qid,
                        question_text=str(q.get("question_text", "")),
                        target_topic=q.get("target_topic"),
                        category=q.get("category"),
                        difficulty=q.get("difficulty"),
                        status="unanswered",
                        transcript=None,
                        relevance_score=None,
                        coverage_score=None,
                        covered_concepts=[],
                        missing_concepts=q.get("expected_key_concepts", []),
                    )
                )
    else:
        for ev in evaluations:
            qid = str(ev.get("question_id", ""))
            cov = ev.get("concept_coverage", {})
            rel = ev.get("relevance", {})
            meta = ev.get("transcript_metadata", {})
            deliv = ev.get("delivery_metrics", {}) or {}
            vis = ev.get("visual_metrics", {}) or {}
            sq = ev.get("semantic_quality", {}) or {}

            sem_cov = float(sq["semantic_coverage_score"]) if "semantic_coverage_score" in sq else None
            sem_sim = float(sq["avg_similarity"]) if "avg_similarity" in sq else None
            sem_covered = sq.get("semantically_covered", [])

            breakdown.append(
                QuestionReportItem(
                    question_id=qid,
                    question_text=str(ev.get("question_text", "")),
                    target_topic=ev.get("target_topic"),
                    status="answered",
                    transcript=meta.get("transcript", ""),
                    relevance_score=float(rel.get("relevance_score", 0.0)) if "relevance_score" in rel else None,
                    coverage_score=float(cov.get("coverage_score", 0.0)) if "coverage_score" in cov else None,
                    semantic_coverage_score=sem_cov,
                    semantic_similarity=sem_sim,
                    covered_concepts=cov.get("covered_concepts", []),
                    missing_concepts=cov.get("missing_concepts", []),
                    semantically_covered=sem_covered,
                    words_per_minute=float(deliv.get("words_per_minute")) if deliv.get("words_per_minute") is not None else None,
                    filler_word_count=int(deliv.get("total_filler_words", 0)) if "total_filler_words" in deliv else None,
                    extended_pause_count=int(deliv.get("extended_pause_count", 0)) if "extended_pause_count" in deliv else None,
                    face_presence_ratio=float(vis.get("face_presence_ratio")) if vis.get("face_presence_ratio") is not None else None,
                    face_centering_ratio=float(vis.get("face_centering_ratio")) if vis.get("face_centering_ratio") is not None else None,
                )
            )

    return SessionReportResponse(
        session_id=session_id,
        profile_id=profile_id,
        candidate_name=candidate_name or "Candidate",
        target_role=target_role or "Software Engineer",
        total_questions=total_q_count,
        answered_questions=answered_count,
        completion_rate=completion_rate,
        overall_readiness_score=overall_readiness,
        readiness_level=readiness_tier,
        average_relevance_score=avg_relevance,
        average_concept_coverage=avg_coverage,
        average_semantic_coverage=avg_sem_coverage,
        average_semantic_similarity=avg_sem_similarity,
        sbert_model_used=sbert_model_used,
        total_concepts_covered=total_covered_concepts,
        total_concepts_missing=total_missing_concepts,
        average_words_per_minute=avg_wpm,
        overall_pace_rating=overall_pace,
        total_filler_words=total_fillers,
        overall_filler_percentage=overall_filler_pct,
        top_filler_words=sorted_fillers,
        total_extended_pauses=total_extended_pauses,
        total_speaking_duration_seconds=round(total_speaking_duration, 1),
        video_sessions_count=video_answers_count,
        average_face_presence_ratio=avg_face_presence,
        average_face_centering_ratio=avg_face_centering,
        visual_stability_summary=visual_summary,
        key_strengths=strengths,
        areas_for_improvement=improvements,
        actionable_recommendations=recommendations,
        questions_breakdown=breakdown,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )
