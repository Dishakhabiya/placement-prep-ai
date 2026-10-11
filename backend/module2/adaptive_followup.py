import uuid
from typing import List, Optional
from schemas import FollowupRequest, FollowupResponse
from module2.llm_client import LLMClient

def generate_adaptive_followup(req: FollowupRequest) -> FollowupResponse:
    """
    Generates a targeted follow-up question when a candidate's answer is partial,
    vague, or missing essential key concepts.
    """
    followup_id = f"fol_{uuid.uuid4().hex[:8]}"
    missing_concepts = req.missing_concepts or []
    candidate_answer = req.candidate_answer.strip()

    # Attempt to query Llama 3 via LLMClient if available
    system_prompt = (
        "You are an expert technical interviewer. Given an original interview question, "
        "the candidate's answer, and a list of missing technical concepts, generate a concise, "
        "probing follow-up question that asks the candidate to clarify their answer and cover the missing concepts."
    )
    user_prompt = (
        f"Original Question: {req.original_question}\n"
        f"Target Topic: {req.target_topic}\n"
        f"Candidate Answer: {candidate_answer}\n"
        f"Missing Concepts: {', '.join(missing_concepts)}\n"
        "Generate a polite but probing follow-up question:"
    )

    llm_result = LLMClient.generate_with_prompt(system_prompt, user_prompt)
    if llm_result and len(llm_result.strip()) > 15:
        return FollowupResponse(
            followup_id=followup_id,
            parent_question_id=req.question_id,
            followup_question=llm_result.strip(),
            focus_area=", ".join(missing_concepts) if missing_concepts else req.target_topic,
            expected_key_concepts=missing_concepts
        )

    # Deterministic NLP Fallback Generator
    if missing_concepts:
        primary_missing = missing_concepts[0]
        secondary_missing = missing_concepts[1] if len(missing_concepts) > 1 else None
        
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
        followup_text = (
            f"Could you expand a bit more on your answer regarding {req.target_topic or 'this topic'}? "
            f"Specifically, can you share a concrete code example or scenario where you implemented this?"
        )
        focus = "Answer Depth & Practical Example"
    else:
        followup_text = (
            f"Great explanation. Building on what you just shared about {req.target_topic or 'this concept'}, "
            f"what potential tradeoffs or edge cases would you consider in a production environment?"
        )
        focus = "Tradeoffs & Production Considerations"

    return FollowupResponse(
        followup_id=followup_id,
        parent_question_id=req.question_id,
        followup_question=followup_text,
        focus_area=focus,
        expected_key_concepts=missing_concepts
    )
