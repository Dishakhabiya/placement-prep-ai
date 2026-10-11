import os
import logging
from typing import Optional, List, Dict, Any
import numpy as np

from module4.schemas import VisualAnalysisMetrics

logger = logging.getLogger(__name__)

# Cached Haar Cascade Detector instance
_face_cascade = None


def get_face_cascade():
    """
    Lazily initializes the built-in OpenCV Haar Cascade face detector.
    """
    global _face_cascade
    if _face_cascade is None:
        try:
            import cv2
            cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            if os.path.exists(cascade_path):
                _face_cascade = cv2.CascadeClassifier(cascade_path)
                logger.info(f"Loaded OpenCV Haar Cascade face detector from {cascade_path}")
            else:
                logger.warning(f"Haar cascade XML not found at {cascade_path}")
        except Exception as e:
            logger.error(f"Failed to load OpenCV CascadeClassifier: {e}")
    return _face_cascade


def extract_sampled_frames_from_video(video_path: str, max_fps: float = 1.0) -> List[np.ndarray]:
    """
    Samples video frames at approximately 1 frame per second using PyAV.
    Returns a list of RGB numpy arrays (H, W, 3).
    """
    import av
    frames: List[np.ndarray] = []

    try:
        with av.open(video_path, mode="r") as container:
            if not container.streams.video:
                return []

            video_stream = container.streams.video[0]
            # Time interval in stream time base for 1 frame per second
            time_base = float(video_stream.time_base) if video_stream.time_base else 1.0 / 30.0
            step_pts = int(1.0 / (time_base * max_fps)) if (time_base * max_fps) > 0 else 30

            last_pts = -step_pts
            for frame in container.decode(video=0):
                pts = frame.pts if frame.pts is not None else 0
                if pts - last_pts >= step_pts or not frames:
                    rgb_array = frame.to_ndarray(format="rgb24")
                    frames.append(rgb_array)
                    last_pts = pts
    except Exception as e:
        logger.warning(f"Error reading video frames from '{video_path}': {e}")

    return frames


def analyze_video_frames(video_path: str) -> VisualAnalysisMetrics:
    """
    Analyzes sampled video frames for face presence, face centering, and posture stability.
    Uses OpenCV's Haar Cascade classifier for objective face localization.
    Does NOT infer confidence, honesty, or eye gaze.
    """
    try:
        import av
        with av.open(video_path, mode="r") as container:
            has_video = bool(container.streams.video)
    except Exception:
        has_video = False

    if not has_video:
        return VisualAnalysisMetrics(
            video_track_detected=False,
            total_frames_sampled=0,
            face_detected_frames=0,
            face_presence_ratio=0.0,
            face_centered_frames=0,
            face_centering_ratio=0.0,
            head_movement_stability="Not Applicable (Audio Only)",
            upper_body_posture_stability="Not Applicable (Audio Only)",
            detector_model="None",
            visual_coaching_tip="Audio-only response captured. Webcam video stream was not attached.",
            methodology_limitations="No video stream present in container.",
        )

    sampled_frames = extract_sampled_frames_from_video(video_path, max_fps=1.0)
    total_sampled = len(sampled_frames)

    if total_sampled == 0:
        return VisualAnalysisMetrics(
            video_track_detected=True,
            total_frames_sampled=0,
            face_detected_frames=0,
            face_presence_ratio=0.0,
            face_centered_frames=0,
            face_centering_ratio=0.0,
            head_movement_stability="Unknown",
            upper_body_posture_stability="Unknown",
            detector_model="OpenCV-HaarCascade-FrontalFace",
            visual_coaching_tip="Video track detected but no frames could be sampled.",
            methodology_limitations="Video frame decode returned zero frames.",
        )

    import cv2
    cascade = get_face_cascade()
    if cascade is None:
        return VisualAnalysisMetrics(
            video_track_detected=True,
            total_frames_sampled=total_sampled,
            face_detected_frames=0,
            face_presence_ratio=0.0,
            face_centered_frames=0,
            face_centering_ratio=0.0,
            head_movement_stability="Unknown",
            upper_body_posture_stability="Unknown",
            detector_model="Unavailable",
            visual_coaching_tip="Computer vision face detector could not be initialized.",
            methodology_limitations="OpenCV Haar Cascade model unavailable in environment.",
        )

    face_detected_count = 0
    face_centered_count = 0
    centroids_x: List[float] = []
    centroids_y: List[float] = []

    for frame_rgb in sampled_frames:
        h, w = frame_rgb.shape[:2]
        gray = cv2.cvtColor(frame_rgb, cv2.COLOR_RGB2GRAY)
        faces = cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=4,
            minSize=(int(w * 0.1), int(h * 0.1)),
        )

        if len(faces) > 0:
            face_detected_count += 1
            # Select the largest face by area
            largest_face = max(faces, key=lambda f: f[2] * f[3])
            fx, fy, fw, fh = largest_face
            center_x = (fx + fw / 2.0) / float(w)
            center_y = (fy + fh / 2.0) / float(h)

            centroids_x.append(center_x)
            centroids_y.append(center_y)

            # Check if face centroid is centered (within 0.25 to 0.75 horizontal boundary)
            if 0.25 <= center_x <= 0.75:
                face_centered_count += 1

    presence_ratio = round((face_detected_count / total_sampled) * 100.0, 1)
    centering_ratio = round((face_centered_count / total_sampled) * 100.0, 1)

    # Calculate head movement stability from centroid displacement variance
    if len(centroids_x) >= 2:
        std_x = float(np.std(centroids_x))
        std_y = float(np.std(centroids_y))
        combined_std = (std_x + std_y) / 2.0

        if combined_std < 0.05:
            stability = "Steady"
        elif combined_std < 0.12:
            stability = "Moderate Movement"
        else:
            stability = "High Movement"

        # Upper body positioning stability
        mean_y = float(np.mean(centroids_y))
        if 0.20 <= mean_y <= 0.55:
            posture_status = "Centered / Upright"
        else:
            posture_status = "Off-Center Framing"
    else:
        stability = "Steady" if face_detected_count > 0 else "Unknown"
        posture_status = "Centered / Upright" if face_detected_count > 0 else "Unknown"

    # Actionable objective coaching advice
    tips = []
    if presence_ratio < 70.0:
        tips.append(f"Face was detected in {presence_ratio}% of frames. Ensure your webcam is at eye level and your face is well-lit.")
    else:
        tips.append(f"Good camera presence ({presence_ratio}% frame detection).")

    if centering_ratio < 65.0:
        tips.append(f"Face was centered in {centering_ratio}% of frames. Try to stay centered in your webcam view during responses.")
    else:
        tips.append(f"Well-centered framing ({centering_ratio}% centered).")

    if stability == "High Movement":
        tips.append("Frequent movement or shifting detected. Try to maintain a calm, grounded posture.")

    coaching_tip = " ".join(tips)
    limitations = (
        "Objective metrics derived via OpenCV Haar Cascade face detection sampled at 1 fps. "
        "Measures face bounding presence and framing alignment; does NOT track pupil gaze, eye contact, confidence, or emotions."
    )

    return VisualAnalysisMetrics(
        video_track_detected=True,
        total_frames_sampled=total_sampled,
        face_detected_frames=face_detected_count,
        face_presence_ratio=presence_ratio,
        face_centered_frames=face_centered_count,
        face_centering_ratio=centering_ratio,
        head_movement_stability=stability,
        upper_body_posture_stability=posture_status,
        detector_model="OpenCV-HaarCascade-FrontalFace",
        visual_coaching_tip=coaching_tip,
        methodology_limitations=limitations,
    )
