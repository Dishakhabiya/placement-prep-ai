import re
import uuid
from typing import List, Optional
from schemas import FollowupRequest, FollowupResponse
from module2.llm_client import LLMClient


def _extract_candidate_mention(answer: str, missing_concepts: List[str]) -> Optional[str]:
    """
    Extracts a meaningful specific phrase, technology, or clause from the candidate's answer
    so the follow-up directly acknowledges what the candidate actually stated.
    """
    if not answer or len(answer.strip()) < 5:
        return None

    clean_ans = answer.strip()
    # Remove leading conversational fillers
    cleaned = re.sub(
        r"^(well|basically|i think|in my opinion|so|actually|like)\s*,?\s*",
        "",
        clean_ans,
        flags=re.IGNORECASE,
    ).strip()

    # Match specific technical action phrases: "used X", "implemented X", "worked with X", etc.
    action_match = re.search(
        r"(?:used|utiliz(?:ed|ing)|implement(?:ed|ing)?|built|designed|worked with|focus(?:ed|ing)? on|leverag(?:ed|ing))\s+([A-Za-z0-9_\-\.\s]{3,35})(?:[\.,;]|$)",
        cleaned,
        re.IGNORECASE,
    )
    if action_match:
        mention = action_match.group(1).strip()
        words = mention.split()
        if 1 <= len(words) <= 5:
            return f"using {mention}"

    # Take the first concise clause if it has substance
    sentences = re.split(r"[.!?\n]+", cleaned)
    first_sentence = sentences[0].strip() if sentences else cleaned
    words = first_sentence.split()
    if 3 <= len(words) <= 8:
        return f"'{first_sentence}'"
    elif len(words) > 8:
        # Extract prominent keywords not in missing_concepts
        missing_lower = {m.lower() for m in missing_concepts}
        stopwords = {
            "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
            "is", "was", "are", "were", "it", "this", "that", "i", "we", "my", "our", "you",
            "have", "has", "had", "do", "did", "so", "as", "by", "from", "be", "been"
        }
        prominent = [w for w in words if w.lower() not in stopwords and w.lower() not in missing_lower and len(w) > 3]
        if prominent:
            return f"your point on '{' '.join(prominent[:3])}'"

    return None


def generate_adaptive_followup(req: FollowupRequest) -> FollowupResponse:
    """
    Generates a targeted follow-up question when a candidate's answer is partial,
    vague, or missing essential key concepts.
    Actively listens to what the candidate specifically stated and bridges to the missing concepts.
    """
    followup_id = f"fol_{uuid.uuid4().hex[:8]}"
    missing_concepts = req.missing_concepts or []
    candidate_answer = req.candidate_answer.strip()
    job_ctx = req.job_context.strip() if req.job_context and req.job_context.strip() else ""

    # Attempt to query LLM (Nemotron/Ollama) via LLMClient if available
    job_instruction = f" and the job context '{job_ctx}'" if job_ctx else ""
    system_prompt = (
        "You are an expert interviewer actively listening to a candidate. "
        "The candidate provided an answer to an interview question but omitted key concepts or could go deeper. "
        "CRITICAL INSTRUCTIONS:\n"
        "1. ACTIVE LISTENING: Directly acknowledge what the candidate specifically mentioned in their answer "
        "(their stated tools, approach, scenario, or reasoning). Never ignore what they said to blindly repeat job descriptions.\n"
        "2. BRIDGE & PROBE: Connect their specific mention to probe the missing concepts"
        f"{job_instruction}. Formulate a concise, direct follow-up question.\n"
        "3. You must explicitly include the exact phrase of at least one of the missing concepts in your question.\n"
        "4. Do not use markdown asterisks or bold formatting. Keep the tone conversational, professional, and direct."
    )
    user_prompt = (
        f"Job Context: {job_ctx or 'Software Engineering'}\n"
        f"Original Question: {req.original_question}\n"
        f"Target Topic: {req.target_topic}\n"
        f"Candidate Answer: {candidate_answer}\n"
        f"Missing Concepts to probe: {', '.join(missing_concepts)}\n"
        "Generate a targeted follow-up question acknowledging what the candidate stated while probing the missing concepts:"
    )

    llm_result = LLMClient.generate_with_prompt(system_prompt, user_prompt)
    if llm_result and len(llm_result.strip()) > 15:
        cleaned_followup = llm_result.strip().replace("**", "").replace("* ", "- ")
        if missing_concepts and not any(mc.lower() in cleaned_followup.lower() for mc in missing_concepts):
            primary = missing_concepts[0]
            cleaned_followup = f"{cleaned_followup} Specifically, can you elaborate on {primary}?"
        return FollowupResponse(
            followup_id=followup_id,
            parent_question_id=req.question_id,
            followup_question=cleaned_followup,
            focus_area=", ".join(missing_concepts) if missing_concepts else req.target_topic,
            expected_key_concepts=missing_concepts,
        )

    # Deterministic NLP Fallback Generator with Active Listening
    candidate_mention = _extract_candidate_mention(candidate_answer, missing_concepts)

    if missing_concepts:
        primary_missing = missing_concepts[0]
        secondary_missing = missing_concepts[1] if len(missing_concepts) > 1 else None

        if job_ctx:
            if candidate_mention:
                if secondary_missing:
                    followup_text = (
                        f"You mentioned {candidate_mention}. In this role ({job_ctx}), understanding "
                        f"'{primary_missing}' and '{secondary_missing}' is important. How would you apply these two concepts in this scenario?"
                    )
                else:
                    followup_text = (
                        f"You mentioned {candidate_mention}. For the requirements of {job_ctx}, could you dive deeper into "
                        f"'{primary_missing}' and explain how you would implement it?"
                    )
            else:
                if secondary_missing:
                    followup_text = (
                        f"In this role ({job_ctx}), understanding '{primary_missing}' and '{secondary_missing}' "
                        f"is important. How would you apply these two concepts in this scenario?"
                    )
                else:
                    followup_text = (
                        f"For the requirements of {job_ctx}, could you dive deeper into '{primary_missing}' "
                        f"and explain how you would implement it?"
                    )
        else:
            if candidate_mention:
                if secondary_missing:
                    followup_text = (
                        f"You mentioned {candidate_mention}. Could you elaborate on how you would address "
                        f"'{primary_missing}' or '{secondary_missing}' in that scenario?"
                    )
                else:
                    followup_text = (
                        f"You noted {candidate_mention}. Could you dive deeper into '{primary_missing}' "
                        f"and explain how it applies to {req.target_topic or 'this question'}?"
                    )
            else:
                if secondary_missing:
                    followup_text = (
                        f"Thank you. In your response, you discussed the main idea, but didn't explicitly touch upon "
                        f"'{primary_missing}' or '{secondary_missing}'. Could you elaborate on how you would address these aspects?"
                    )
                else:
                    followup_text = (
                        f"You mentioned a good starting point, but could you dive deeper into '{primary_missing}' "
                        f"and explain how it applies to {req.target_topic or 'this question'}?"
                    )
        focus = ", ".join(missing_concepts)
    elif len(candidate_answer.split()) < 15:
        mention_str = f" regarding {candidate_mention}" if candidate_mention else ""
        followup_text = (
            f"Could you expand a bit more on your answer{mention_str} about {req.target_topic or 'this topic'}? "
            f"Specifically, can you share a concrete code example or scenario where you implemented this?"
        )
        focus = "Answer Depth & Practical Example"
    else:
        mention_str = f" regarding {candidate_mention}" if candidate_mention else f" about {req.target_topic or 'this concept'}"
        followup_text = (
            f"Great explanation. Building on what you just shared{mention_str}, "
            f"what potential tradeoffs or edge cases would you consider in a production environment?"
        )
        focus = "Tradeoffs & Production Considerations"

    return FollowupResponse(
        followup_id=followup_id,
        parent_question_id=req.question_id,
        followup_question=followup_text,
        focus_area=focus,
        expected_key_concepts=missing_concepts,
    )

