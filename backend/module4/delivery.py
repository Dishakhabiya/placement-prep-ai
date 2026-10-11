import re
from typing import Dict, Any, List, Optional
from module4.schemas import SpeakingDeliveryMetrics

# Standard filler words and hesitation vocalizations common in spoken English
FILLER_PATTERNS = [
    r"\bum\b",
    r"\buh\b",
    r"\ber\b",
    r"\bah\b",
    r"\blike\b",
    r"\byou know\b",
    r"\bbasically\b",
    r"\bactually\b",
    r"\bliterally\b",
    r"\bi mean\b",
    r"\bkind of\b",
    r"\bsort of\b",
]


def extract_filler_words(text: str) -> Dict[str, int]:
    """
    Extracts counts of common filler words and hesitation phrases from transcript text.
    """
    if not text or not text.strip():
        return {}

    lowered = text.lower()
    counts: Dict[str, int] = {}
    for pattern in FILLER_PATTERNS:
        clean_word = pattern.replace(r"\b", "")
        matches = re.findall(pattern, lowered)
        if matches:
            counts[clean_word] = len(matches)
    return counts


def calculate_words_per_minute(word_count: int, duration_seconds: float) -> float:
    """
    Computes words per minute (WPM).
    Formula: (word_count / duration_seconds) * 60.
    """
    if duration_seconds <= 0 or word_count <= 0:
        return 0.0
    return round((word_count / duration_seconds) * 60.0, 1)


def rate_speaking_pace(wpm: float) -> str:
    """
    Rates speaking rate based on standard professional interview benchmarks:
    - Below 110 WPM: Slow
    - 110 to 165 WPM: Optimal / Natural
    - Above 165 WPM: Fast
    """
    if wpm <= 0:
        return "Not Applicable"
    if wpm < 110:
        return "Slow"
    if wpm <= 165:
        return "Optimal"
    return "Fast"


def compute_extended_pauses(segments: Optional[List[Dict[str, Any]]], total_duration: float) -> Dict[str, Any]:
    """
    Calculates extended pauses (silences >= 1.5 seconds) between speech segments.
    """
    if not segments or len(segments) < 2:
        return {"extended_pause_count": 0, "total_pause_duration_seconds": 0.0}

    pause_count = 0
    total_pause_sec = 0.0

    for i in range(len(segments) - 1):
        end_curr = segments[i].get("end", 0.0)
        start_next = segments[i + 1].get("start", 0.0)
        gap = start_next - end_curr
        if gap >= 1.5:
            pause_count += 1
            total_pause_sec += gap

    return {
        "extended_pause_count": pause_count,
        "total_pause_duration_seconds": round(total_pause_sec, 2),
    }


def analyze_speaking_delivery(
    transcript: str,
    duration_seconds: Optional[float] = None,
    segments: Optional[List[Dict[str, Any]]] = None,
) -> SpeakingDeliveryMetrics:
    """
    Computes speaking delivery metrics including pace (WPM), filler word frequency, and pauses.
    """
    clean_text = (transcript or "").strip()
    words = clean_text.split() if clean_text else []
    total_words = len(words)
    dur = float(duration_seconds or 0.0)

    # 1. Speaking Pace
    wpm = calculate_words_per_minute(total_words, dur)
    pace_rating = rate_speaking_pace(wpm)

    # 2. Filler Words
    fillers = extract_filler_words(clean_text)
    total_fillers = sum(fillers.values())
    filler_pct = round((total_fillers / total_words) * 100.0, 1) if total_words > 0 else 0.0

    # 3. Pauses
    pause_info = compute_extended_pauses(segments, dur)

    # 4. Actionable Coaching Tip
    tip_parts = []
    if pace_rating == "Slow":
        tip_parts.append(f"Your speaking pace ({wpm} WPM) is on the slower side. Aim for a slightly brisker cadence around 130-150 WPM.")
    elif pace_rating == "Fast":
        tip_parts.append(f"Your speaking pace ({wpm} WPM) is quite rapid. In technical interviews, slowing down to 130-150 WPM gives the interviewer time to absorb key points.")
    else:
        tip_parts.append(f"Your speaking rate ({wpm} WPM) is within the optimal interview range (110-165 WPM).")

    if total_fillers > 0:
        common_filler = max(fillers.items(), key=lambda x: x[1])[0]
        tip_parts.append(f"You used {total_fillers} filler words ({filler_pct}% of total speech), most frequently '{common_filler}'. Try replacing fillers with a brief silence.")
    else:
        tip_parts.append("No filler words detected—crisp and clear delivery.")

    if pause_info["extended_pause_count"] > 2:
        tip_parts.append(f"Detected {pause_info['extended_pause_count']} extended silences totaling {pause_info['total_pause_duration_seconds']}s.")

    coaching_tip = " ".join(tip_parts)

    return SpeakingDeliveryMetrics(
        words_per_minute=wpm,
        pace_rating=pace_rating,
        total_filler_words=total_fillers,
        filler_word_breakdown=fillers,
        filler_percentage=filler_pct,
        extended_pause_count=pause_info["extended_pause_count"],
        total_pause_duration_seconds=pause_info["total_pause_duration_seconds"],
        speaking_duration_seconds=round(dur, 2),
        speaking_coaching_tip=coaching_tip,
    )
