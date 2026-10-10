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

---

## 📋 5. Shared Profile JSON Contract

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

## 🌐 6. Backend API Reference

| Method | Endpoint | Description | Status Code |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Service health status check | `200 OK` |
| `POST` | `/api/profile` | Upload resume + JD + mode (multipart) | `201 Created` |
| `GET` | `/api/profile/{id}` | Retrieve parsed profile by ID | `200 OK` / `404` |
| `PUT` | `/api/profile/{id}` | Update candidate corrections & recalculate | `200 OK` / `404` |
| `GET` | `/api/profile/{id}/topics` | Get ranked interview topics | `200 OK` / `404` |
| `GET` | `/api/profiles` | List all saved profiles (summary) | `200 OK` |
| `DELETE` | `/api/profile/{id}` | Delete profile record and stored resume file | `200 OK` / `404` |

---

## 🤝 7. Inter-Module Integration (Persons 2, 3, 4)

- **Member 2 (Question Generation Engine):** Consume `interview_topics`, `candidate.projects`, and `job.responsibilities` via `GET /api/profile/{profile_id}/topics` or the client handoff callback.
- **Member 3 (Speech & Audio Transcription):** Link interview transcripts with candidate profile using `profile_id`.
- **Member 4 (Answer Evaluation & Scoring):** Align candidate responses against `job.required_skills` and `job.responsibilities`.

---

## 🔒 8. Security & Privacy
- Uploaded files are validated for size ($\le 10\text{ MB}$) and file extensions (`.pdf`, `.docx`).
- Files are saved with anonymized UUIDs (`prof_xxx.pdf`) in a private server directory.
- `DELETE /api/profile/{profile_id}` securely purges database records and removes physical files from disk.
- Zero resume data is transmitted to external commercial APIs by default.
