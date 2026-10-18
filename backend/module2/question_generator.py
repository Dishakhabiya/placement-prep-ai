import json
import uuid
import random
import re
import logging
from typing import List, Dict, Any, Optional

from schemas import ProfileResponse, QuestionItem, QuestionSetResponse
from module2.llm_client import LLMClient

logger = logging.getLogger(__name__)

# Expanded question database with multiple variations per skill & difficulty
SKILL_QUESTION_BANK: Dict[str, Dict[str, Any]] = {
    "Python": {
        "questions": [
            {
                "difficulty": "medium",
                "text": "Explain how Python handles memory management, garbage collection, and reference counting.",
                "concepts": ["garbage collection", "reference counting", "GIL", "memory management"],
            },
            {
                "difficulty": "hard",
                "text": "Discuss the impact of Python's Global Interpreter Lock (GIL) on multi-threading vs. multi-processing, and when you would choose asyncio instead.",
                "concepts": ["GIL", "multi-threading", "multi-processing", "asyncio", "concurrency"],
            },
            {
                "difficulty": "easy",
                "text": "How do Python lists differ from tuples in memory allocation, mutability, and performance?",
                "concepts": ["immutability", "memory allocation", "tuples", "lists"],
            },
            {
                "difficulty": "hard",
                "text": "How do Python generators and the `yield` keyword manage execution state without loading entire datasets into memory?",
                "concepts": ["generators", "yield", "lazy evaluation", "memory efficiency"],
            },
        ],
        "default_concepts": ["memory management", "GIL", "asyncio", "generators", "data structures"],
    },
    "FastAPI": {
        "questions": [
            {
                "difficulty": "medium",
                "text": "How does FastAPI achieve asynchronous request handling using Python `async` and `await`, and when should you avoid async handlers?",
                "concepts": ["async/await", "ASGI", "event loop", "blocking IO"],
            },
            {
                "difficulty": "hard",
                "text": "Explain dependency injection in FastAPI and how you would manage database session lifecycles and authentication across routes.",
                "concepts": ["dependency injection", "session lifecycle", "Depends", "middleware"],
            },
            {
                "difficulty": "easy",
                "text": "What role do Pydantic schemas play in FastAPI for request validation, serialization, and OpenAPI documentation?",
                "concepts": ["Pydantic validation", "serialization", "OpenAPI", "type hints"],
            },
            {
                "difficulty": "hard",
                "text": "How would you handle background tasks, WebSocket connections, or streaming responses in a production FastAPI service?",
                "concepts": ["BackgroundTasks", "WebSockets", "streaming", "ASGI concurrency"],
            },
        ],
        "default_concepts": ["async/await", "Pydantic validation", "dependency injection", "OpenAPI", "ASGI"],
    },
    "React": {
        "questions": [
            {
                "difficulty": "medium",
                "text": "Explain the React component lifecycle and how hooks like `useEffect` manage side effects, cleanup, and dependency arrays.",
                "concepts": ["useEffect", "cleanup function", "dependency array", "lifecycle"],
            },
            {
                "difficulty": "hard",
                "text": "How do you optimize render performance in large React applications using `useMemo`, `useCallback`, virtualized lists, or code splitting?",
                "concepts": ["useMemo", "useCallback", "virtualization", "re-rendering", "code splitting"],
            },
            {
                "difficulty": "easy",
                "text": "What is the difference between state and props in React, and how does unidirectional data flow simplify state debugging?",
                "concepts": ["state vs props", "unidirectional data flow", "immutability"],
            },
            {
                "difficulty": "medium",
                "text": "Compare React Context API with state management libraries like Redux or Zustand for global application state.",
                "concepts": ["Context API", "global state", "re-render overhead", "Zustand/Redux"],
            },
        ],
        "default_concepts": ["Virtual DOM", "hooks", "component props", "re-rendering", "state management"],
    },
    "PostgreSQL": {
        "questions": [
            {
                "difficulty": "medium",
                "text": "Explain how B-Tree indexes work in PostgreSQL and how you use `EXPLAIN ANALYZE` to diagnose slow queries.",
                "concepts": ["B-Tree indexes", "EXPLAIN ANALYZE", "sequential scan", "index scan"],
            },
            {
                "difficulty": "hard",
                "text": "Discuss ACID properties in PostgreSQL transactions and how isolation levels prevent dirty reads, non-repeatable reads, or phantom reads.",
                "concepts": ["ACID compliance", "isolation levels", "dirty reads", "phantom reads", "MVCC"],
            },
            {
                "difficulty": "easy",
                "text": "What is the difference between `INNER JOIN`, `LEFT JOIN`, and `FULL OUTER JOIN` in SQL, and when would you use indexing on foreign keys?",
                "concepts": ["JOIN types", "foreign keys", "table relationships", "query optimization"],
            },
            {
                "difficulty": "hard",
                "text": "How does PostgreSQL handle connection pooling, and what strategies would you use for database partitioning in high-write systems?",
                "concepts": ["connection pooling", "PgBouncer", "table partitioning", "sharding"],
            },
        ],
        "default_concepts": ["ACID compliance", "indexes", "EXPLAIN ANALYZE", "transactions", "JOINs"],
    },
    "Docker": {
        "questions": [
            {
                "difficulty": "medium",
                "text": "Explain how multi-stage builds in Docker reduce final image size and improve security for production deployments.",
                "concepts": ["multi-stage builds", "image optimization", "attack surface", "build layers"],
            },
            {
                "difficulty": "hard",
                "text": "How do you manage container networking, persistent data volumes, and health checks in Docker Compose setups?",
                "concepts": ["bridge networks", "named volumes", "health checks", "container isolation"],
            },
            {
                "difficulty": "easy",
                "text": "What is the difference between a Docker image and a running container, and how do layered file systems (UnionFS) work?",
                "concepts": ["images vs containers", "layered file system", "copy-on-write", "Dockerfile"],
            },
        ],
        "default_concepts": ["containerization", "Dockerfile", "volumes", "multi-stage builds", "networking"],
    },
    "Kubernetes": {
        "questions": [
            {
                "difficulty": "medium",
                "text": "Explain the difference between a Kubernetes Pod, Deployment, and Service, and how Services route traffic to Pods.",
                "concepts": ["Pod", "Deployment", "ClusterIP Service", "labels and selectors"],
            },
            {
                "difficulty": "hard",
                "text": "How would you configure Horizontal Pod Autoscaling (HPA) and zero-downtime rolling updates for microservices in Kubernetes?",
                "concepts": ["HPA", "rolling update", "readiness probe", "liveness probe", "resource limits"],
            },
        ],
        "default_concepts": ["Deployments", "Services", "Pods", "probes", "autoscaling"],
    },
    "Redis": {
        "questions": [
            {
                "difficulty": "medium",
                "text": "What data structures does Redis support beyond key-value strings, and how would you implement a distributed cache with TTL and eviction policies?",
                "concepts": ["hashes and sets", "TTL expiration", "LRU eviction", "cache invalidation"],
            },
            {
                "difficulty": "hard",
                "text": "Explain how Redis handles persistence via RDB snapshots and AOF logs, and how you would prevent cache stampede/thundering herd issues.",
                "concepts": ["RDB vs AOF", "cache stampede", "distributed locks", "persistence"],
            },
        ],
        "default_concepts": ["in-memory caching", "TTL", "LRU", "RDB/AOF", "pub/sub"],
    },
    "AWS": {
        "questions": [
            {
                "difficulty": "medium",
                "text": "How do you architect a scalable, fault-tolerant web application on AWS utilizing EC2/ECS, S3, RDS, and an Application Load Balancer?",
                "concepts": ["ALB", "Auto Scaling Group", "multi-AZ RDS", "S3 storage", "security groups"],
            },
            {
                "difficulty": "hard",
                "text": "Explain the difference between serverless architectures (AWS Lambda + API Gateway) and containerized microservices (ECS/EKS) regarding cold starts, state, and cost.",
                "concepts": ["Lambda cold starts", "API Gateway", "event-driven", "cost modeling", "statelessness"],
            },
        ],
        "default_concepts": ["cloud architecture", "IAM roles", "serverless", "load balancing", "multi-AZ"],
    },
    "Git": {
        "questions": [
            {
                "difficulty": "medium",
                "text": "How do you resolve complex merge conflicts when collaborating on a shared feature branch, and what are the tradeoffs of merge vs. rebase?",
                "concepts": ["merge vs rebase", "conflict resolution", "fast-forward", "commit history"],
            },
            {
                "difficulty": "hard",
                "text": "Explain how you would recover accidentally deleted commits using `git reflog`, and how interactive rebasing (`git rebase -i`) organizes pull requests.",
                "concepts": ["git reflog", "interactive rebase", "squashing commits", "detached HEAD"],
            },
            {
                "difficulty": "easy",
                "text": "What is the difference between `git pull` and `git fetch`, and how do remote-tracking branches keep your local repo synchronized?",
                "concepts": ["fetch vs pull", "remote tracking", "origin", "upstream branches"],
            },
        ],
        "default_concepts": ["branching", "merge vs rebase", "conflict resolution", "commit history"],
    },
    "DSA": {
        "questions": [
            {
                "difficulty": "medium",
                "text": "Explain the difference between Dynamic Programming (memoization/tabulation) and Divide-and-Conquer algorithms with concrete examples.",
                "concepts": ["memoization", "tabulation", "overlapping subproblems", "optimal substructure"],
            },
            {
                "difficulty": "hard",
                "text": "How would you design a Least Recently Used (LRU) cache achieving O(1) time complexity for both `get` and `put` operations?",
                "concepts": ["HashMap + Doubly LinkedList", "O(1) time complexity", "eviction policy", "node pointers"],
            },
            {
                "difficulty": "easy",
                "text": "What is the Big-O time and space complexity of searching in a balanced Binary Search Tree vs. an unsorted Array and a Hash Map?",
                "concepts": ["Big-O notation", "BST search O(log N)", "Hash Map O(1)", "worst-case collision"],
            },
        ],
        "default_concepts": ["Big-O complexity", "data structures", "algorithms", "hash tables", "trees"],
    },
}

EXPANDED_HR_QUESTIONS = [
    {
        "topic": "Career Goals & Motivation",
        "question": "What specifically attracted you to this role, and how does it align with your long-term career aspirations?",
        "concepts": ["role alignment", "company background", "long-term vision", "enthusiasm"],
    },
    {
        "topic": "Conflict Resolution & Technical Disagreement",
        "question": "Describe a situation where you had a technical disagreement with a team member or lead. How did you resolve it?",
        "concepts": ["active listening", "compromise", "data-driven justification", "professionalism"],
    },
    {
        "topic": "Handling Deadlines & High-Pressure Scenarios",
        "question": "Tell me about a time when a project deadline was at risk. What steps did you take to prioritize tasks and deliver on time?",
        "concepts": ["prioritization", "stakeholder communication", "problem breakdown", "ownership"],
    },
    {
        "topic": "Learning Agility & Adapting to New Tech",
        "question": "Can you describe a situation where you had to quickly learn an unfamiliar technology or framework to deliver a feature?",
        "concepts": ["learning curve", "documentation", "rapid prototyping", "resourcefulness"],
    },
    {
        "topic": "Ownership & Dealing with Production Incidents",
        "question": "Walk me through a time when a bug or failure made it into production. How did you diagnose, resolve, and prevent it from recurring?",
        "concepts": ["root cause analysis", "incident response", "post-mortem", "system monitoring"],
    },
    {
        "topic": "Collaboration Across Cross-Functional Teams",
        "question": "How do you coordinate with product managers, designers, and other engineers when functional requirements are ambiguous?",
        "concepts": ["clarifying requirements", "iterative feedback", "cross-functional alignment", "empathy"],
    },
]


def _extract_json_array(text: str) -> Optional[List[Dict[str, Any]]]:
    """Safely extracts a JSON array from LLM output, ignoring surrounding markdown or commentary."""
    if not text or not text.strip():
        return None

    cleaned = text.strip()

    # Handle ```json ... ``` code fence
    fence_match = re.search(r"```(?:json)?\s*(\[\s*\{.*?\}\s*\])\s*```", cleaned, re.DOTALL)
    if fence_match:
        try:
            parsed = json.loads(fence_match.group(1))
            if isinstance(parsed, list):
                return parsed
        except json.JSONDecodeError:
            pass

    # Handle raw bracketed JSON array
    start_idx = cleaned.find("[")
    end_idx = cleaned.rfind("]")
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        candidate_json = cleaned[start_idx : end_idx + 1]
        try:
            parsed = json.loads(candidate_json)
            if isinstance(parsed, list):
                return parsed
        except json.JSONDecodeError:
            pass

    return None


def _generate_questions_with_llm(
    profile_data: ProfileResponse,
    num_questions: int,
    mode: str,
) -> Optional[List[QuestionItem]]:
    """
    Queries LLM (Nemotron/Ollama) to dynamically synthesize interview questions directly tailored
    to the target job description responsibilities, required skills, and candidate profile background.
    """
    job_title = profile_data.job.title if profile_data.job and profile_data.job.title else "Software Engineer"
    required_skills = profile_data.job.required_skills or []
    preferred_skills = profile_data.job.preferred_skills or []
    responsibilities = profile_data.job.responsibilities or []

    candidate_skills = profile_data.candidate.skills or []
    matched_skills = profile_data.match.matched or []
    missing_skills = profile_data.match.missing or []
    projects = profile_data.candidate.projects or []

    project_summaries = []
    for p in projects[:3]:
        tech_str = ", ".join(p.tech[:4]) if p.tech else "not specified"
        project_summaries.append(f"{p.title} (Tech: {tech_str})")
    proj_str = "; ".join(project_summaries) if project_summaries else "None listed"

    resp_str = "; ".join(responsibilities[:4]) if responsibilities else "Design and build software features"

    # Build mode-specific instruction so the LLM strictly respects the interview type
    MODE_INSTRUCTIONS: Dict[str, str] = {
        "hr": (
            "STRICT MODE — HR / Behavioural Interview ONLY.\n"
            "You MUST generate ONLY HR and behavioural questions. "
            "These are soft-skill, culture-fit, and situational questions (STAR-format: Situation, Task, Action, Result). "
            "Do NOT generate any technical, coding, system-design, or algorithm questions. "
            "All category fields MUST be 'hr' or 'behavioral'. "
            "Topics include: teamwork, conflict resolution, leadership, time management, motivation, adaptability, communication, ownership."
        ),
        "technical": (
            "STRICT MODE — Technical Interview ONLY.\n"
            "You MUST generate ONLY technical questions: coding concepts, system design, algorithms, "
            "data structures, language-specific internals, architecture tradeoffs, and debugging scenarios. "
            "Do NOT include HR, culture-fit, or general behavioural questions. "
            "All category fields MUST be 'technical' or 'jd-based'."
        ),
        "jd-based": (
            "STRICT MODE — Job Description Focused Interview.\n"
            "Every question MUST map directly to the JD responsibilities or required/preferred skills listed below. "
            "Each question must cite or probe a specific JD requirement. "
            "Categories may be 'technical' or 'jd-based'. Do not drift into generic trivia."
        ),
        "resume-based": (
            "STRICT MODE — Resume / Portfolio Interview.\n"
            "Every question MUST reference the candidate's actual projects, claimed skills, or past experience. "
            "Probe for depth: architecture decisions, personal contribution, production challenges. "
            "Categories should be 'resume-based' or 'technical'. Do not ask generic theoretical questions."
        ),
        "mixed": (
            "BALANCED MODE — Mixed Interview.\n"
            "Generate a balanced mix: roughly 40% technical questions, 30% JD-responsibilities questions, "
            "20% resume/project-based questions, and 10% behavioural/HR questions. "
            "Vary category fields accordingly across the full array."
        ),
    }
    mode_instruction = MODE_INSTRUCTIONS.get(mode.lower(), MODE_INSTRUCTIONS["mixed"])

    system_prompt = f"""You are an elite senior interview examiner at a leading technology firm.
Your goal is to generate an adaptive, high-quality set of {num_questions} interview questions customized specifically for:
Target Role: {job_title}
Interview Mode: {mode.upper()}

{mode_instruction}

Additional constraints:
- Generate exactly {num_questions} distinct, insightful, non-generic questions.
- Every question must test a concrete concept, scenario, or tradeoff directly relevant to the role.
- Never use markdown asterisks (**word** or *word*) in any field. Plain text only.
- Output ONLY a valid JSON array of objects. No introductory text, no conversational banter.
Each object in the array MUST contain:
  - "category": one of ["technical", "jd-based", "resume-based", "hr", "behavioral"]
  - "question_text": The clear, professional interview question (no asterisks)
  - "target_topic": The specific subject or area being tested
  - "target_skill": The specific technology, skill, or behavioural competency being probed
  - "difficulty": one of ["easy", "medium", "hard"]
  - "expected_key_concepts": a JSON array of 3 to 5 crucial keywords/concepts expected in a competent answer
  - "context_reason": Brief reason explaining how this question connects to the mode, JD, or candidate profile
"""

    user_prompt = f"""Candidate Data:
- Skills on Resume: {', '.join(candidate_skills[:12]) if candidate_skills else 'General'}
- Missing Skills (JD gaps to probe): {', '.join(missing_skills[:5]) if missing_skills else 'None'}
- Matched Skills: {', '.join(matched_skills[:8]) if matched_skills else 'None'}
- Stated Projects: {proj_str}

Job Description:
- Role: {job_title}
- Required Skills: {', '.join(required_skills[:8]) if required_skills else 'Software Engineering'}
- Preferred Skills: {', '.join(preferred_skills[:5]) if preferred_skills else 'None'}
- Key Responsibilities: {resp_str}

Generate the {num_questions} interview questions in the required JSON array format:"""

    try:
        raw_response = LLMClient.generate_with_prompt(system_prompt, user_prompt)
        if not raw_response or raw_response == "quota_exceeded":
            logger.info("LLM unavailable for question generation, using diversified fallback.")
            return None

        parsed_items = _extract_json_array(raw_response)
        if not parsed_items or len(parsed_items) < min(3, num_questions):
            logger.warning("LLM generated invalid or insufficient question array: %s", raw_response[:200])
            return None

        valid_questions: List[QuestionItem] = []
        for idx, item in enumerate(parsed_items[:num_questions]):
            if not isinstance(item, dict):
                continue
            q_text = str(item.get("question_text", "")).strip().replace("**", "").replace("* ", "- ")
            if not q_text or len(q_text) < 15:
                continue

            category = str(item.get("category", "technical")).lower()
            if category not in ["technical", "jd-based", "resume-based", "hr", "behavioral"]:
                category = "technical"

            target_topic = str(item.get("target_topic", "Technical Evaluation")).strip()
            target_skill = item.get("target_skill")
            if target_skill:
                target_skill = str(target_skill).strip()

            difficulty = str(item.get("difficulty", "medium")).lower()
            if difficulty not in ["easy", "medium", "hard"]:
                difficulty = "medium"

            raw_concepts = item.get("expected_key_concepts", [])
            if isinstance(raw_concepts, list):
                concepts = [str(c).strip() for c in raw_concepts if str(c).strip()]
            else:
                concepts = [str(raw_concepts).strip()]
            if not concepts:
                concepts = [target_topic, "problem solving", "best practices"]

            context_reason = str(item.get("context_reason", "Tailored to candidate profile and JD requirements.")).strip()

            valid_questions.append(
                QuestionItem(
                    question_id=f"q_{idx + 1}",
                    category=category,
                    question_text=q_text,
                    target_topic=target_topic,
                    target_skill=target_skill,
                    difficulty=difficulty,
                    expected_key_concepts=concepts[:5],
                    context_reason=context_reason,
                )
            )

        if len(valid_questions) >= min(3, num_questions):
            return valid_questions

    except Exception as e:
        logger.warning("Exception during LLM question generation: %s", e)

    return None


def _generate_diversified_fallback_questions(
    profile_data: ProfileResponse,
    num_questions: int = 5,
    mode: str = "mixed",
) -> List[QuestionItem]:
    """
    Diversified rule-based generator that strictly respects interview mode.
    HR mode → ONLY HR/behavioural questions.
    Technical mode → ONLY technical/JD-skill questions.
    Resume-based → ONLY project/skill-depth questions.
    JD-based → ONLY JD-responsibility/required-skill questions.
    Mixed → a proportional blend of all categories.
    """
    questions: List[QuestionItem] = []
    q_counter = 1

    candidate_skills = profile_data.candidate.skills or []
    missing_skills = profile_data.match.missing or []
    matched_skills = profile_data.match.matched or candidate_skills
    projects = profile_data.candidate.projects or []
    responsibilities = profile_data.job.responsibilities or []
    topics = profile_data.interview_topics or []
    job_title = profile_data.job.title if profile_data.job and profile_data.job.title else "your target role"

    # Track already used question texts to avoid duplicates
    used_texts: set = set()
    norm_mode = mode.lower()

    # ── Helper: append a QuestionItem safely ─────────────────────────────────
    def _add(q_text, category, target_topic, target_skill, difficulty, concepts, reason):
        nonlocal q_counter
        if q_text in used_texts or len(questions) >= num_questions:
            return
        used_texts.add(q_text)
        questions.append(
            QuestionItem(
                question_id=f"q_{q_counter}",
                category=category,
                question_text=q_text,
                target_topic=target_topic,
                target_skill=target_skill,
                difficulty=difficulty,
                expected_key_concepts=concepts,
                context_reason=reason,
            )
        )
        q_counter += 1

    # ── Section A: HR / Behavioural (ONLY for hr / mixed) ────────────────────
    if norm_mode in ["hr", "mixed"]:
        shuffled_hr = list(EXPANDED_HR_QUESTIONS)
        random.shuffle(shuffled_hr)
        # For pure HR mode, fill ALL slots with HR questions
        hr_budget = num_questions if norm_mode == "hr" else max(1, num_questions // 5)
        for hr_q in shuffled_hr:
            if len(questions) >= hr_budget:
                break
            _add(
                hr_q["question"],
                category="hr" if norm_mode == "hr" else "behavioral",
                target_topic=hr_q["topic"],
                target_skill="Behavioural & Soft Skills",
                difficulty="medium",
                concepts=hr_q["concepts"],
                reason="Assesses teamwork, communication, problem-solving, and culture-fit.",
            )

    # If HR mode is satisfied, return early (no technical content)
    if norm_mode == "hr":
        # Pad with more HR if needed (shuffle again for variety)
        if len(questions) < num_questions:
            extra_hr = list(EXPANDED_HR_QUESTIONS)
            random.shuffle(extra_hr)
            for hr_q in extra_hr:
                if len(questions) >= num_questions:
                    break
                _add(
                    hr_q["question"] + " Please share a specific example from your previous experience.",
                    category="hr",
                    target_topic=hr_q["topic"],
                    target_skill="Behavioural & Soft Skills",
                    difficulty="medium",
                    concepts=hr_q["concepts"],
                    reason="Additional HR behavioural probe aligned with target role culture.",
                )
        return questions[:num_questions]

    # ── Section B: Missing Skill / JD Gap (NOT for hr or resume-based) ───────
    if norm_mode not in ["hr", "resume-based"]:
        shuffled_missing = list(missing_skills)
        random.shuffle(shuffled_missing)
        for skill in shuffled_missing:
            if len(questions) >= num_questions:
                break
            bank_data = SKILL_QUESTION_BANK.get(skill)
            if bank_data and bank_data.get("questions"):
                chosen = random.choice(bank_data["questions"])
                q_text = chosen["text"]
                concepts = chosen["concepts"]
                difficulty = chosen.get("difficulty", "medium")
            else:
                q_text = (
                    f"The job description for {job_title} highlights '{skill}' as a key requirement. "
                    f"What is your practical experience with {skill}, or how would you quickly ramp up on it?"
                )
                concepts = [skill, "learning curve", "core principles", "practical implementation"]
                difficulty = "medium"
            _add(
                q_text,
                category="jd-based" if norm_mode in ["jd-based", "mixed"] else "technical",
                target_topic=f"Skill Gap: {skill}",
                target_skill=skill,
                difficulty=difficulty,
                concepts=concepts,
                reason=f"Candidate resume does not list required skill '{skill}' from the JD.",
            )

    # ── Section C: JD Responsibilities (for jd-based / mixed / technical) ────
    if norm_mode in ["jd-based", "mixed", "technical"]:
        shuffled_resp = list(responsibilities)
        random.shuffle(shuffled_resp)
        anchor_skill = matched_skills[0] if matched_skills else "software engineering"
        for resp in shuffled_resp:
            if len(questions) >= num_questions:
                break
            resp_variants = [
                f"A core responsibility in the job description is: '{resp}'. Based on your experience, how would you approach designing and implementing this?",
                f"Regarding the job responsibility '{resp}', what technical challenges or edge cases would you anticipate, and how would you mitigate them?",
            ]
            _add(
                random.choice(resp_variants),
                category="jd-based",
                target_topic=f"JD Responsibility: {resp[:35]}",
                target_skill=anchor_skill,
                difficulty="medium",
                concepts=["architecture overview", "scalability", "edge cases", "implementation"],
                reason=f"Directly assesses candidate readiness for key JD responsibility: '{resp[:50]}'.",
            )

    # ── Section D: Technical Skill Depth (NOT for hr) ────────────────────────
    if norm_mode != "hr":
        shuffled_matched = list(matched_skills)
        random.shuffle(shuffled_matched)
        for skill in shuffled_matched:
            if len(questions) >= num_questions:
                break
            bank_data = SKILL_QUESTION_BANK.get(skill)
            if bank_data and bank_data.get("questions"):
                available = [q for q in bank_data["questions"] if q["text"] not in used_texts]
                chosen = random.choice(available) if available else random.choice(bank_data["questions"])
                q_text = chosen["text"]
                concepts = chosen["concepts"]
                difficulty = chosen.get("difficulty", "medium")
            else:
                q_variants = [
                    f"You mentioned proficiency in {skill}. Can you walk me through how you applied {skill} in a production project and a key technical tradeoff you made?",
                    f"What are the common performance pitfalls or anti-patterns when using {skill}, and how do you prevent them?",
                ]
                q_text = random.choice(q_variants)
                concepts = [skill, "architecture", "best practices", "tradeoffs"]
                difficulty = "medium"
            _add(
                q_text,
                category="technical",
                target_topic=f"Technical Competency: {skill}",
                target_skill=skill,
                difficulty=difficulty,
                concepts=concepts,
                reason=f"Candidate lists '{skill}' which matches target job requirements.",
            )

    # ── Section E: Project-Based (for resume-based / mixed) ──────────────────
    if norm_mode in ["resume-based", "mixed"]:
        shuffled_projects = list(projects)
        random.shuffle(shuffled_projects)
        for proj in shuffled_projects:
            if len(questions) >= num_questions:
                break
            proj_title = proj.title or "Recent Project"
            proj_tech = ", ".join(proj.tech[:3]) if proj.tech else "stated technologies"
            proj_variants = [
                f"In your project '{proj_title}', you utilized {proj_tech}. Can you walk me through the system architecture, your individual contribution, and a key technical challenge you solved?",
                f"Reflecting on '{proj_title}' built with {proj_tech}, if you were to scale this system to handle 10x user traffic, what architecture bottlenecks would arise and how would you resolve them?",
            ]
            _add(
                random.choice(proj_variants),
                category="resume-based",
                target_topic=f"Project Architecture: {proj_title}",
                target_skill=proj.tech[0] if proj.tech else "Software Architecture",
                difficulty="medium",
                concepts=["architecture overview", "scalability", "tradeoffs", "individual contribution"],
                reason=f"Evaluates hands-on project experience from candidate resume: '{proj_title}'.",
            )

    # ── Section F: Topic-based fill (any remaining slots) ────────────────────
    for top in topics:
        if len(questions) >= num_questions:
            break
        topic_name = top.topic if hasattr(top, "topic") else str(top)
        # For HR mode this is already returned early; for others, pick appropriate category
        cat = "technical" if norm_mode in ["technical", "jd-based"] else "behavioral"
        top_q = f"Regarding '{topic_name}': Can you discuss your practical experience and approach to solving problems in this area?"
        _add(
            top_q,
            category=cat,
            target_topic=topic_name,
            target_skill=None,
            difficulty="medium",
            concepts=["problem-solving framework", "domain knowledge", "practical execution"],
            reason=getattr(top, "reason", "Priority interview topic from profile analysis."),
        )

    return questions[:num_questions]


def generate_interview_questions(
    profile_data: ProfileResponse,
    num_questions: int = 5,
    override_mode: Optional[str] = None,
) -> QuestionSetResponse:
    """
    Generates a personalized set of interview questions using candidate skills,
    target job description, match gaps, candidate projects, and interview topics.

    First attempts dynamic synthesis using Ollama (Nemotron); if unavailable,
    uses the diversified multi-variant rule-based fallback.
    """
    mode = override_mode or profile_data.mode or "mixed"
    session_id = f"sess_{uuid.uuid4().hex[:10]}"
    profile_id = profile_data.profile_id
    total_q = num_questions or 5

    # 1. Attempt Dynamic LLM generation
    llm_questions = _generate_questions_with_llm(profile_data, total_q, mode)
    if llm_questions and len(llm_questions) >= total_q:
        return QuestionSetResponse(
            session_id=session_id,
            profile_id=profile_id,
            mode=mode,
            questions=llm_questions[:total_q],
            total_questions=len(llm_questions[:total_q]),
        )

    # 2. Diversified fallback with varied question pools & JD responsibilities
    fallback_questions = _generate_diversified_fallback_questions(profile_data, total_q, mode)

    # If LLM returned partial questions, combine with fallback to reach total_q
    if llm_questions and len(llm_questions) < total_q:
        combined = list(llm_questions)
        existing_texts = {q.question_text for q in combined}
        for fq in fallback_questions:
            if len(combined) >= total_q:
                break
            if fq.question_text not in existing_texts:
                combined.append(fq)
                existing_texts.add(fq.question_text)
        # Re-index question IDs
        for idx, q in enumerate(combined):
            q.question_id = f"q_{idx + 1}"
        fallback_questions = combined

    return QuestionSetResponse(
        session_id=session_id,
        profile_id=profile_id,
        mode=mode,
        questions=fallback_questions,
        total_questions=len(fallback_questions),
    )
