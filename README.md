# AI-Powered Placement Interview & Speaking Assistant
## Module 1: Resume & Job Description (JD) Intelligence

> **Person 1 Subsystem:** Automated Resume & JD Parsing, Taxonomy-Driven Skill Extraction, Gap & Match Scoring, and Ranked Interview Topic Generation.

---

## 📌 1. Module Overview

Module 1 serves as the foundational intelligence engine for the 4-member NLP mini-project. It extracts structured information from candidate resumes (PDF/DOCX) and target job descriptions (JDs), identifies skill overlaps and missing competencies, and produces prioritized interview topics for downstream modules (Module 2: Question Generation, Module 3: Audio & Speech Analysis, Module 4: Answer Evaluation).

### Key Features
- **Multi-format Document Ingestion:** PyMuPDF (`fitz`) and `python-docx` extraction with text cleaning and section segmentation (Skills, Projects, Experience, Education, Certifications).
- **Taxonomy & Alias Resolution:** 100+ technical skills normalized with alias dictionary (`js` → `JavaScript`, `postgres` → `PostgreSQL`, `sklearn` → `scikit-learn`).
- **Target Role Parsing:** Identifies target job titles, required vs. preferred skills, and core responsibilities from unstructured JD text.
- **Transparent Match Scoring:** Formula-weighted coverage ($80\%$ required skills $+ 20\%$ preferred skills) with project-to-responsibility relevance mapping.
- **Dynamic Interview Topic Builder:** Generates 8–12 ranked topics tailored by interview mode (**Technical**, **HR**, **Resume-Based**, **JD-Based**, or **Mixed**).
- **Interactive Review & Corrections:** Lets candidates modify extracted skills, projects, and target role specs, recalculating gap metrics on the fly.
- **Zero Paid API Dependencies:** 100% runnable offline on local machine using spaCy and scikit-learn.

---

## 🏗️ 2. Architecture & Directory Structure

```text
placement-prep-ai/
├── backend/
│   ├── main.py                  # FastAPI entry point & CORS configuration
│   ├── schemas.py               # Pydantic models for shared JSON contract
│   ├── db.py                    # SQLAlchemy database models & SQLite session
│   ├── pytest.ini               # Pytest configuration (pythonpath = .)
│   ├── requirements.txt         # Backend Python dependencies
│   ├── routers/
│   │   └── profile.py           # REST endpoints (/api/profile, /api/health, etc.)
│   ├── module1/
│   │   ├── pipeline.py          # End-to-end extraction & recalculation pipeline
│   │   ├── parsing/
│   │   │   ├── extract_text.py  # PDF & DOCX text extraction
│   │   │   ├── clean.py         # Whitespace and unicode normalization
│   │   │   └── sections.py      # Resume section segmentation
│   │   ├── taxonomy/
│   │   │   ├── skills.json      # Categorized skills taxonomy
│   │   │   └── aliases.json     # Skill acronyms & alternate spellings
│   │   ├── jd/
│   │   │   └── jd_parser.py     # JD title, skill and responsibility extractor
│   │   ├── matching/
│   │   │   ├── normalize.py     # Skill canonicalization
│   │   │   ├── gap.py           # Match/gap analysis & 80/20 scoring
│   │   │   └── project_links.py # TF-IDF project-to-job relevance
│   │   ├── context/
│   │   │   └── topic_builder.py # 8-12 ranked interview topics builder
│   │   ├── ner/
│   │   │   ├── labels.py        # NER label sets (SKILL, TECH, ORG, ROLE, DEGREE)
│   │   │   ├── infer.py         # Transformer NER inference with spaCy fallback
│   │   │   └── train.py         # Colab/Kaggle fine-tuning scaffold
│   │   └── eval/
│   │       └── metrics.py       # Precision, Recall & F1 evaluation harness
│   └── tests/                   # 19 comprehensive pytest tests
│
└── mobile/
    ├── App.js                   # React Navigation root
    ├── app.json                 # Expo configuration
    ├── package.json             # React Native dependencies
    └── src/
        ├── api/
        │   └── client.js        # Reusable fetch client with timeout & multipart handling
        ├── config/
        │   └── apiConfig.js     # Configurable API base URL (iOS/Android/Web/LAN)
        ├── store/
        │   └── profileStore.js  # Zustand store with AsyncStorage persistence
        ├── components/
        │   ├── SkillChip.js     # Tag chip (matched/missing/extra/editable)
        │   ├── ScoreRing.js     # Circular SVG match progress ring
        │   ├── SectionCard.js   # Dark-mode glassmorphic container
        │   └── ErrorBanner.js   # Inline dismissible error banner
        └── screens/
            ├── HomeScreen.js    # Dashboard, stats, and profile list
            ├── UploadScreen.js  # File picker, sample JDs, mode selector
            ├── ProcessingScreen.js # Real-time pipeline step tracker
            ├── ReviewProfileScreen.js # Interactive skill & project editor
            ├── MatchSummaryScreen.js  # Score ring, gaps & project links
            ├── TopicsScreen.js  # Ranked interview topics (Module 2 handoff)
            └── HistoryScreen.js # Saved profiles with delete functionality
```

---

## 🚀 3. Quickstart & Installation

### Prerequisites
- **Python 3.10+** (Python 3.12 verified)
- **Node.js 18+** & **npm 9+**

---

### A. Run the Backend (FastAPI)

```bash
# 1. Navigate to backend directory
cd backend

# 2. Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Download spaCy linguistic model
python -m spacy download en_core_web_sm

# 5. Start the FastAPI server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

* Backend API will run at: `http://localhost:8000`
* Interactive Swagger Docs: `http://localhost:8000/docs`
* Health Check: `http://localhost:8000/api/health`

---

### B. Run the Mobile App (Expo / React Native)

```bash
# 1. Open a new terminal and navigate to mobile directory
cd mobile

# 2. Install dependencies
npm install

# 3. Start Expo development server
npx expo start
```

* Press `w` to open in **Web Browser**
* Press `i` to open in **iOS Simulator**
* Press `a` to open in **Android Emulator**
* Scan the QR code with **Expo Go** on your physical phone (Ensure your phone and computer are on the same Wi-Fi network and update `EXPO_PUBLIC_API_URL` or `mobile/src/config/apiConfig.js`).

---

## 🧪 4. Running Backend Tests

Run the complete test suite verifying text extraction, section splitting, JD parsing, gap scoring, topic ranking, API endpoints, persistence, and evaluation:

```bash
cd backend
./.venv/bin/pytest -v
```

### Test Suite Summary
| Test Module | Coverage Area | Status |
| :--- | :--- | :--- |
| `tests/test_api.py` | Health check, POST upload, GET profile, PUT update, DELETE, error validation | ✅ PASSED |
| `tests/test_parsing.py` | PDF/DOCX bytes extraction, section segmentation, text cleaning | ✅ PASSED |
| `tests/test_matching.py` | Skill normalization, alias resolution, 80/20 score math, project links | ✅ PASSED |
| `tests/test_jd.py` | JD parser title, required/preferred skills, responsibilities | ✅ PASSED |
| `tests/test_topics.py` | Topic ranking across Technical, HR, and Mixed interview modes | ✅ PASSED |
| `tests/test_eval.py` | Entity-level Precision, Recall, and F1 evaluation harness | ✅ PASSED |
| `tests/test_module2.py` | Question generation engine, adaptive followup generator & API | ✅ PASSED |
| `tests/test_module3.py` | Whisper audio transcription, expected-concept coverage, relevance scoring, validation | ✅ PASSED (22 tests) |

---

## 🎙️ 5. Module 3: Speech Transcription & NLP Answer Evaluation

> **Member 3 Subsystem:** Spoken response ingestion, local Whisper speech-to-text transcription, transcript normalization, answer relevance estimation, and expected-concept coverage tracking.

### Key Capabilities
- **Local Speech Transcription:** Integrates Whisper (`faster-whisper` / `openai-whisper`) with lazy-loading model initialization. Runs offline on local CPU without paid external APIs. Default model: `base` (resource-conscious for student laptops).
- **Multipart Audio Upload Validation:** Accepts `.wav`, `.mp3`, `.m4a`, `.webm`, `.ogg`, `.flac`, `.opus` up to 25 MB with magic byte/size verification and safe temporary file lifecycle cleanup.
- **Expected-Concept Coverage Analysis:** Compares candidate answers directly against `expected_key_concepts` generated by Member 2 (`QuestionItem`). Categorizes each concept into **covered** (1.0), **partially covered** (0.5), or **missing** (0.0) using technical term synonym expansion. Missing concepts feed directly into Member 2's `FollowupRequest`.
- **Answer Relevance Estimation:** Computes domain relevance using sub-linear TF-IDF n-gram cosine similarity and morphological root alignment between candidate answers and question contexts.
- **Transcript Metadata Extraction:** Returns word count, character count, detected language, audio duration, processing time, and status.

### Endpoints
| Method | Endpoint | Description | Status Code |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/answers/transcribe` | Multipart form audio upload + question context → transcript & NLP evaluation | `200 OK` |
| `POST` | `/api/answers/analyze` | JSON endpoint evaluating candidate answer text against expected concepts | `200 OK` |

### Sample Answer Evaluation JSON Contract (`/api/answers/transcribe`)
```json
{
  "evaluation_id": "eval_7a9f2b1c4e0d",
  "profile_id": "prof_8f3a9b1c20",
  "session_id": "sess_3e8a1d2f9b",
  "question_id": "q_1",
  "question_text": "Explain how Python handles memory management, garbage collection, and reference counting.",
  "transcript_metadata": {
    "transcript": "Python primarily handles memory management via reference counting. When references drop to zero the object is deallocated. To handle reference cycles it uses cyclic garbage collection.",
    "word_count": 27,
    "char_count": 182,
    "detected_language": "en",
    "language_probability": 0.99,
    "duration_seconds": 6.8,
    "model_used": "whisper-base",
    "processing_time_seconds": 0.42,
    "status": "success"
  },
  "relevance": {
    "relevance_score": 82.5,
    "method": "tfidf_cosine_with_keyword_alignment",
    "interpretation": "High Relevance",
    "key_matching_terms": ["reference", "counting", "garbage", "collection", "memory"],
    "notes": "Calculated using TF-IDF n-gram cosine similarity combined with root/keyword alignment ratio."
  },
  "concept_coverage": {
    "total_expected": 3,
    "covered_count": 2,
    "partially_covered_count": 0,
    "missing_count": 1,
    "coverage_score": 66.7,
    "covered_concepts": ["reference counting", "garbage collection"],
    "partially_covered_concepts": [],
    "missing_concepts": ["GIL"],
    "details": [
      {
        "concept": "reference counting",
        "status": "covered",
        "matched_phrase": "reference counting",
        "score": 1.0,
        "explanation": "Exact match for concept 'reference counting' identified in response."
      },
      {
        "concept": "garbage collection",
        "status": "covered",
        "matched_phrase": "garbage collection",
        "score": 1.0,
        "explanation": "Exact match for concept 'garbage collection' identified in response."
      },
      {
        "concept": "GIL",
        "status": "missing",
        "matched_phrase": null,
        "score": 0.0,
        "explanation": "Concept 'GIL' was not addressed in candidate response."
      }
    ]
  },
  "evaluated_at": "2026-10-11T12:00:00Z"
}
```

---

## 📋 6. Shared Profile JSON Contract

The backend and mobile application strictly adhere to this frozen JSON schema:

```json
{
  "profile_id": "prof_8f3a9b1c20",
  "mode": "mixed",
  "candidate": {
    "skills": ["Python", "FastAPI", "React", "PostgreSQL", "Git"],
    "projects": [
      {
        "title": "Placement Prep Assistant",
        "description": "Built automated NLP intelligence backend with FastAPI.",
        "tech": ["FastAPI", "Python", "PostgreSQL"]
      }
    ],
    "experience": ["Software Engineer Intern at OpenLab (2023)"],
    "education": ["B.Tech in Computer Science, 2024"],
    "certifications": ["AWS Certified Cloud Practitioner"]
  },
  "job": {
    "title": "Backend Software Engineer",
    "required_skills": ["Python", "FastAPI", "PostgreSQL", "DSA"],
    "preferred_skills": ["Docker", "Kubernetes"],
    "responsibilities": [
      "Develop scalable microservices and REST APIs",
      "Optimize SQL database queries"
    ]
  },
  "match": {
    "matched": ["Python", "FastAPI", "PostgreSQL"],
    "missing": ["DSA", "Docker", "Kubernetes"],
    "extra": ["React", "Git"],
    "score": 60.0
  },
  "project_job_links": [
    {
      "project": "Placement Prep Assistant",
      "responsibility": "Develop scalable microservices and REST APIs",
      "similarity": 0.82
    }
  ],
  "interview_topics": [
    {
      "topic": "DSA Competency & Learning Curve",
      "priority": "high",
      "reason": "Candidate resume does not explicitly show 'DSA' which is required for Backend Software Engineer."
    },
    {
      "topic": "Project Architecture & Execution: Placement Prep Assistant",
      "priority": "high",
      "reason": "Verify candidate's hands-on contribution and technical problem solving using FastAPI, Python."
    }
  ]
}
```

---

## 🌐 7. Complete Backend API Reference

| Method | Endpoint | Description | Status Code |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Service health status check | `200 OK` |
| `POST` | `/api/profile` | Upload resume + JD + mode (multipart) | `201 Created` |
| `GET` | `/api/profile/{id}` | Retrieve parsed profile by ID | `200 OK` / `404` |
| `PUT` | `/api/profile/{id}` | Update candidate corrections & recalculate | `200 OK` / `404` |
| `GET` | `/api/profile/{id}/topics` | Get ranked interview topics | `200 OK` / `404` |
| `GET` | `/api/profiles` | List all saved profiles (summary) | `200 OK` |
| `DELETE` | `/api/profile/{id}` | Delete profile record and stored resume file | `200 OK` / `404` |
| `POST` | `/api/questions/generate` | Generate personalized interview questions | `200 OK` |
| `POST` | `/api/questions/followup` | Generate adaptive follow-up probing missing concepts | `200 OK` |
| `POST` | `/api/answers/transcribe` | Transcribe candidate audio recording and evaluate | `200 OK` |
| `POST` | `/api/answers/analyze` | Evaluate candidate text answer against expected concepts | `200 OK` |

---

## 🤝 8. Inter-Module Integration Pipeline (Members 1 - 4)

1. **Member 1 (Resume & JD Intelligence):** Ingests resume & JD, stores candidate profile in SQLite, computes match gaps, and generates ranked interview topics.
2. **Member 2 (Question Generation Engine):** Consumes profile topics and missing skills to generate structured interview questions (`QuestionItem`) with `expected_key_concepts`.
3. **Member 3 (Speech Transcription & Answer Evaluation):** Accepts spoken audio answers, transcribes via local Whisper, analyzes relevance, and tags covered/missing concepts.
4. **Member 2 & 3 Feedback Loop:** Missing concepts identified by Member 3 are passed directly into Member 2's `/api/questions/followup` to probe candidate knowledge gaps adaptively.
5. **Member 4 (Speaking Analysis & Final Performance Report):** Consumes Member 3 transcripts, audio duration, and concept evaluation results to produce holistic delivery metrics.

---

## 🔒 9. Security & Privacy
- Uploaded files are validated for size ($\le 10\text{ MB}$ for resumes, $\le 25\text{ MB}$ for audio recordings) and format whitelist.
- Temporary audio recordings are automatically unlinked and safely deleted from disk immediately after transcription.
- 100% offline local inference available for both Whisper and NLP evaluators without paid third-party API exposure.

