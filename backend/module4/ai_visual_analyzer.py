"""
AI-powered real-time visual analysis for mock interviews.
Dual-mode:
  1. Uses Gemini Vision API when GEMINI_API_KEY is available for multi-modal behavioral assessment.
  2. Built-in Computer Vision heuristics (PIL + NumPy) fallback for offline/local detection:
     - Detects lying down / horizontal posture / resting on pillow
     - Detects poor camera centering & head alignment
     - Detects very low ambient lighting / sleeping in dark
     - Detects extra people / multiple skin clusters
"""
import base64
import io
import json
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

GEMINI_VISION_MODEL = "gemini-1.5-flash-latest"

VISUAL_ANALYSIS_PROMPT = """You are an expert mock interview evaluator analyzing a single video frame from a live job interview session.

Carefully analyze this image and provide a JSON-only response with NO markdown, no explanation, just raw JSON.

Evaluate the following criteria strictly:

1. POSTURE: Is the candidate sitting upright in an interview-appropriate posture?
   - "upright": Sitting straight, professional posture
   - "slouching": Leaning back or hunched
   - "lying_down": Person is clearly lying down or reclined horizontally (very serious violation)
   - "not_visible": Cannot determine (person not visible or frame unclear)

2. ATTIRE: What is the candidate wearing?
   - "formal": Business formal or business casual (shirt, blazer, professional wear)
   - "semi_formal": Smart casual, presentable but not fully formal
   - "informal": T-shirt, casual wear, pajamas, sportswear
   - "not_visible": Cannot determine clothing

3. EYE_CONTACT: Is the candidate looking at the camera (screen)?
   - "good": Looking directly at camera/screen
   - "poor": Eyes clearly averted, looking away, closed eyes
   - "not_visible": Cannot determine

4. BACKGROUND: What is in the background?
   - "clean": Clean, neutral, professional background
   - "cluttered": Messy or unprofessional background
   - "extra_people": Other people visible in frame
   - "acceptable": Slightly messy but acceptable

5. OVERALL_ALERT: (boolean) Should a warning be shown to the candidate right now?
   True if ANY of these are detected:
   - lying_down posture
   - informal attire
   - eyes clearly closed or looking far away
   - extra people visible in background

6. ALERT_MESSAGE: If overall_alert is true, a SHORT (max 12 words) actionable warning message to show the candidate. Otherwise empty string.
   Examples:
   - "Please sit upright — you appear to be lying down."
   - "Informal attire detected — please wear formal clothing."
   - "Another person visible in your background."
   - "Please look at the camera for eye contact."

Respond with ONLY this JSON structure (no markdown fences):
{
  "posture": "upright|slouching|lying_down|not_visible",
  "attire": "formal|semi_formal|informal|not_visible",
  "eye_contact": "good|poor|not_visible",
  "background": "clean|cluttered|extra_people|acceptable",
  "overall_alert": true|false,
  "alert_message": "...",
  "confidence": 0.0-1.0
}"""


def _analyze_frame_heuristics(image_base64: str) -> dict:
    """
    Local Computer Vision fallback analyzing video frames with PIL and NumPy.
    Runs in <15ms with zero external API calls or API keys required.
    """
    try:
        import numpy as np
        from PIL import Image

        raw_bytes = base64.b64decode(image_base64)
        img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
        img.thumbnail((320, 240))
        arr = np.array(img)
        H, W, _ = arr.shape

        # 1. Luminance / Dark room check
        mean_brightness = float(np.mean(arr))
        if mean_brightness < 20.0:
            return {
                "posture": "not_visible",
                "attire": "not_visible",
                "eye_contact": "poor",
                "background": "acceptable",
                "overall_alert": True,
                "alert_message": "Low lighting detected. Please illuminate your face.",
                "confidence": 0.85,
                "error": None,
                "source": "cv_heuristics",
            }

        # 2. Skin tone segmentation in YCbCr color space
        r = arr[:, :, 0].astype(float)
        g = arr[:, :, 1].astype(float)
        b = arr[:, :, 2].astype(float)
        y = 0.299 * r + 0.587 * g + 0.114 * b
        cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
        cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
        skin_mask = (y > 35) & (cb >= 77) & (cb <= 127) & (cr >= 133) & (cr <= 173)

        skin_count = int(np.sum(skin_mask))
        total_pixels = H * W
        skin_ratio = skin_count / total_pixels

        if skin_ratio < 0.02:
            return {
                "posture": "not_visible",
                "attire": "not_visible",
                "eye_contact": "poor",
                "background": "acceptable",
                "overall_alert": True,
                "alert_message": "Face not detected in frame. Please center yourself.",
                "confidence": 0.75,
                "error": None,
                "source": "cv_heuristics",
            }

        y_coords, x_coords = np.where(skin_mask)
        center_y = float(np.mean(y_coords)) / H
        center_x = float(np.mean(x_coords)) / W
        spread_y = float(np.std(y_coords)) / H
        spread_x = float(np.std(x_coords)) / W
        aspect_ratio = spread_x / (spread_y + 1e-5)

        # 3. Background & Multi-Person Check (computed first to prevent wide bounding box being mistaken for lying down)
        left_skin = float(np.sum(skin_mask[:, :int(W * 0.33)]))
        right_skin = float(np.sum(skin_mask[:, int(W * 0.67):]))
        center_skin = float(np.sum(skin_mask[:, int(W * 0.33):int(W * 0.67)]))

        # Multi-person / Extra people detection:
        # 1. Significant skin in left or right third while candidate is in center
        has_person_on_left = (left_skin > 0.16 * skin_count and center_skin > 0.22 * skin_count)
        has_person_on_right = (right_skin > 0.16 * skin_count and center_skin > 0.22 * skin_count)
        # 2. People flanking both sides or two people on left & right
        has_two_flanks = (left_skin > 0.18 * skin_count and right_skin > 0.18 * skin_count)
        # 3. Wide horizontal dispersion (two people separated horizontally)
        has_wide_dispersion = (spread_x > 0.21 and skin_ratio > 0.035)

        has_extra_person = has_person_on_left or has_person_on_right or has_two_flanks or has_wide_dispersion
        background = "extra_people" if has_extra_person else "acceptable"

        # 4. Posture Evaluation:
        # Upright sitting face is in upper 20%-55% and taller than wide.
        # Lying down on bed / pillow: face centroid is very low (center_y > 0.66) or horizontally elongated (aspect_ratio > 1.45 and center_y > 0.50)
        posture = "upright"
        is_lying_down = False
        if center_y > 0.66 or (aspect_ratio > 1.45 and not has_extra_person and center_y > 0.50):
            posture = "lying_down"
            is_lying_down = True
        elif center_y > 0.52:
            posture = "slouching"

        # 5. Eye contact quality:
        # Centered face attentive to webcam: 0.36 <= center_x <= 0.64 and 0.20 <= center_y <= 0.48
        eye_contact = "good"
        eye_issue_detail = ""
        if abs(center_x - 0.5) > 0.14:
            eye_contact = "poor"
            eye_issue_detail = "sideways"
        elif center_y > 0.50:
            eye_contact = "poor"
            eye_issue_detail = "down"
        elif center_y < 0.18:
            eye_contact = "poor"
            eye_issue_detail = "up"

        # 6. Attire check (lower 25% of frame)
        lower_region = arr[int(H * 0.75):, :]
        lower_std = float(np.mean(np.std(lower_region, axis=2)))
        attire = "formal"
        if lower_std > 48.0:
            attire = "semi_formal"

        # Generate alert (Prioritize security/integrity violations first: extra people -> lying down -> eye contact)
        overall_alert = False
        alert_message = ""
        if has_extra_person:
            overall_alert = True
            alert_message = "Multiple people detected in frame. Please maintain a private setting."
        elif is_lying_down:
            overall_alert = True
            alert_message = "Please sit upright — you appear to be lying down."
        elif eye_contact == "poor":
            overall_alert = True
            if eye_issue_detail == "down":
                alert_message = "Please look at the camera — avoid looking down or reading notes."
            else:
                alert_message = "Please look directly at the camera to maintain eye contact."
        elif posture == "slouching":
            overall_alert = True
            alert_message = "Please sit upright with good interview posture."

        return {
            "posture": posture,
            "attire": attire,
            "eye_contact": eye_contact,
            "background": background,
            "overall_alert": overall_alert,
            "alert_message": alert_message,
            "confidence": 0.85,
            "error": None,
            "source": "cv_heuristics",
        }
    except Exception as e:
        logger.warning(f"Local CV heuristic error: {e}")
        return {
            "posture": "not_visible",
            "attire": "not_visible",
            "eye_contact": "not_visible",
            "background": "acceptable",
            "overall_alert": False,
            "alert_message": "",
            "confidence": 0.0,
            "error": str(e),
            "source": "cv_heuristics",
        }


async def analyze_frame_with_gemini(
    image_base64: str,
    mime_type: str = "image/jpeg",
) -> dict:
    """
    Sends a base64-encoded video frame to Gemini Vision for interview behavioral analysis.
    If GEMINI_API_KEY is not configured or errors, falls back to local CV heuristics.
    """
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        return _analyze_frame_heuristics(image_base64)

    if not image_base64 or len(image_base64) < 100:
        return _analyze_frame_heuristics(image_base64)

    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(GEMINI_VISION_MODEL)

        image_data = {
            "mime_type": mime_type,
            "data": image_base64,
        }

        response = model.generate_content(
            [VISUAL_ANALYSIS_PROMPT, image_data],
            generation_config={
                "temperature": 0.1,
                "max_output_tokens": 256,
            },
        )

        raw_text = response.text.strip() if response.text else ""

        if raw_text.startswith("```"):
            lines = raw_text.split("\n")
            raw_text = "\n".join(
                line for line in lines
                if not line.strip().startswith("```")
            ).strip()

        parsed = json.loads(raw_text)

        valid_postures = {"upright", "slouching", "lying_down", "not_visible"}
        valid_attires = {"formal", "semi_formal", "informal", "not_visible"}
        valid_eye = {"good", "poor", "not_visible"}
        valid_bg = {"clean", "cluttered", "extra_people", "acceptable"}

        result = {
            "posture": parsed.get("posture", "not_visible") if parsed.get("posture") in valid_postures else "not_visible",
            "attire": parsed.get("attire", "not_visible") if parsed.get("attire") in valid_attires else "not_visible",
            "eye_contact": parsed.get("eye_contact", "not_visible") if parsed.get("eye_contact") in valid_eye else "not_visible",
            "background": parsed.get("background", "acceptable") if parsed.get("background") in valid_bg else "acceptable",
            "overall_alert": bool(parsed.get("overall_alert", False)),
            "alert_message": str(parsed.get("alert_message", ""))[:120],
            "confidence": float(parsed.get("confidence", 0.8)),
            "error": None,
            "source": "gemini_vision",
        }

        # Enforce safety overrides if any violation detected by Gemini
        if result["background"] == "extra_people":
            result["overall_alert"] = True
            if not result.get("alert_message"):
                result["alert_message"] = "Multiple people detected in frame. Please maintain a private setting."
        elif result["eye_contact"] == "poor":
            result["overall_alert"] = True
            if not result.get("alert_message"):
                result["alert_message"] = "Please look directly at the camera to maintain eye contact."
        elif result["posture"] == "lying_down":
            result["overall_alert"] = True
            if not result.get("alert_message"):
                result["alert_message"] = "Please sit upright — you appear to be lying down."

        return result

    except Exception as e:
        logger.warning(f"Gemini visual analysis failed ({e}), using local CV heuristic fallback.")
        return _analyze_frame_heuristics(image_base64)
