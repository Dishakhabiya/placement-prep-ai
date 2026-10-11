import uuid
from typing import List, Dict, Any, Optional
from schemas import ProfileResponse, QuestionItem, QuestionSetResponse
from module2.llm_client import LLMClient

# Comprehensive concept database mapping skills/topics to expected key concepts & question templates
SKILL_QUESTION_BANK = {
    "Python": {
        "easy": "How do Python lists differ from tuples in memory allocation and immutability?",
        "medium": "Explain how Python handles memory management, garbage collection, and reference counting.",
        "hard": "Discuss the impact of Python's Global Interpreter Lock (GIL) on multi-threading vs. multi-processing.",
        "concepts": ["immutability", "garbage collection", "reference counting", "GIL", "generators", "decorators"]
    },
    "FastAPI": {
        "easy": "What are Pydantic schemas in FastAPI and why are they used for request validation?",
        "medium": "How does FastAPI achieve asynchronous request handling using Python `async` and `await`?",
        "hard": "Explain dependency injection in FastAPI and how you would manage database session lifecycles across routes.",
        "concepts": ["async/await", "Pydantic validation", "dependency injection", "OpenAPI docs", "ASGI server"]
    },
    "React": {
        "easy": "What is the difference between state and props in React components?",
        "medium": "Explain the React component lifecycle and how hooks like `useEffect` manage side effects.",
        "hard": "How do you optimize render performance in large React applications using `useMemo`, `useCallback`, or virtualized lists?",
        "concepts": ["Virtual DOM", "useState & useEffect", "component props", "re-rendering", "state management"]
    },
    "PostgreSQL": {
        "easy": "What is the difference between `INNER JOIN` and `LEFT JOIN` in SQL queries?",
        "medium": "Explain how indexes work in PostgreSQL (B-Tree) and how they improve query performance.",
        "hard": "Discuss ACID properties in PostgreSQL transactions and how isolation levels prevent dirty reads or phantom reads.",
        "concepts": ["ACID compliance", "B-Tree indexes", "JOIN types", "query execution plan", "transactions"]
    },
    "Docker": {
        "easy": "What is the difference between a Docker image and a Docker container?",
        "medium": "Explain how multi-stage builds in Docker reduce final image size for production deployments.",
        "hard": "How do you handle container networking and persistent data volumes in Docker Compose setups?",
        "concepts": ["containerization", "Dockerfile", "volumes & binding", "multi-stage builds", "port mapping"]
    },
    "Git": {
        "easy": "What is the difference between `git merge` and `git rebase`?",
        "medium": "How do you resolve merge conflicts when collaborating on a shared feature branch?",
        "hard": "Explain git commit history manipulation using `git rebase -i` and cherry-picking commits safely.",
        "concepts": ["branching", "merge vs rebase", "conflict resolution", "commit history", "pull requests"]
    },
    "DSA": {
        "easy": "What is the Big-O time complexity of searching in a balanced Binary Search Tree vs. an unsorted Array?",
        "medium": "Explain the difference between Dynamic Programming (memoization) and Divide-and-Conquer algorithms with examples.",
        "hard": "How would you design a LRU (Least Recently Used) cache achieving O(1) get and put operations?",
        "concepts": ["Big-O notation", "HashMap + Doubly LinkedList", "Recursion & Memoization", "Tree traversals"]
    }
}

GENERIC_HR_QUESTIONS = [
    {
        "topic": "Career Goals & Motivation",
        "question": "What specifically attracted you to this role, and how does it align with your long-term career aspirations?",
        "concepts": ["role alignment", "company background", "long-term vision", "enthusiasm"]
    },
    {
        "topic": "Conflict Resolution & Communication",
        "question": "Describe a situation where you had a technical disagreement with a team member. How did you resolve it?",
        "concepts": ["active listening", "compromise", "data-driven justification", "professionalism"]
    },
    {
        "topic": "Handling Deadlines & Pressure",
        "question": "Tell me about a time when a project deadline was at risk. What steps did you take to deliver on time?",
        "concepts": ["prioritization", "stakeholder communication", "problem breakdown", "ownership"]
    }
]


def generate_interview_questions(
    profile_data: ProfileResponse,
    num_questions: int = 5,
    override_mode: Optional[str] = None
) -> QuestionSetResponse:
    """
    Generates a personalized set of 5-15 interview questions using candidate skills,
    target job description, match gaps, candidate projects, and interview topics.
    """
    mode = override_mode or profile_data.mode or "mixed"
    session_id = f"sess_{uuid.uuid4().hex[:10]}"
    profile_id = profile_data.profile_id

    questions: List[QuestionItem] = []
    q_counter = 1

    candidate_skills = profile_data.candidate.skills or []
    required_skills = profile_data.job.required_skills or []
    missing_skills = profile_data.match.missing or []
    projects = profile_data.candidate.projects or []
    responsibilities = profile_data.job.responsibilities or []
    topics = profile_data.interview_topics or []

    # 1. Missing Skill Questions (Address Gaps identified by Module 1)
    for skill in missing_skills:
        if len(questions) >= num_questions:
            break
        
        bank_data = SKILL_QUESTION_BANK.get(skill)
        if bank_data:
            q_text = bank_data["medium"]
            expected_concepts = bank_data["concepts"]
        else:
            q_text = f"The job description highlights '{skill}'. What is your experience with {skill}, or how would you quickly ramp up on it?"
            expected_concepts = [skill, "learning curve", "core principles", "practical application"]

        questions.append(QuestionItem(
            question_id=f"q_{q_counter}",
            category="jd-based" if mode in ["jd-based", "mixed"] else "technical",
            question_text=q_text,
            target_topic=f"Skill Gap: {skill}",
            target_skill=skill,
            difficulty="medium",
            expected_key_concepts=expected_concepts,
            context_reason=f"Candidate resume does not list required skill '{skill}' from JD."
        ))
        q_counter += 1

    # 2. Confirmed Technical Skill Questions (Probe depth of candidate's claimed skills)
    matched_skills = profile_data.match.matched or candidate_skills
    for skill in matched_skills:
        if len(questions) >= num_questions:
            break
        
        bank_data = SKILL_QUESTION_BANK.get(skill)
        if bank_data:
            q_text = bank_data["medium"]
            expected_concepts = bank_data["concepts"]
        else:
            q_text = f"You mentioned proficiency in {skill}. Can you explain how you have applied {skill} in a real-world project or application?"
            expected_concepts = [skill, "architecture", "best practices", "problem solving"]

        questions.append(QuestionItem(
            question_id=f"q_{q_counter}",
            category="technical",
            question_text=q_text,
            target_topic=f"Technical Competency: {skill}",
            target_skill=skill,
            difficulty="medium",
            expected_key_concepts=expected_concepts,
            context_reason=f"Candidate lists '{skill}' which matches target job requirements."
        ))
        q_counter += 1

    # 3. Project-Based Questions (Resume-Based Mode & Mixed Mode)
    for proj in projects:
        if len(questions) >= num_questions:
            break

        proj_title = proj.title or "Recent Project"
        proj_tech = ", ".join(proj.tech) if proj.tech else "stated technologies"
        
        questions.append(QuestionItem(
            question_id=f"q_{q_counter}",
            category="resume-based",
            question_text=f"In your project '{proj_title}', you utilized {proj_tech}. Can you walk me through the overall system architecture, your individual role, and a key technical challenge you solved?",
            target_topic=f"Project Architecture: {proj_title}",
            target_skill=proj.tech[0] if proj.tech else "Software Architecture",
            difficulty="medium",
            expected_key_concepts=["architecture overview", "individual contribution", "technical tradeoff", "scaling"],
            context_reason=f"Evaluates hands-on project experience mentioned on candidate's resume."
        ))
        q_counter += 1

    # 4. HR & Behavioral Questions (HR Mode & Mixed Mode)
    if mode in ["hr", "mixed"] or len(questions) < num_questions:
        for hr_q in GENERIC_HR_QUESTIONS:
            if len(questions) >= num_questions:
                break

            questions.append(QuestionItem(
                question_id=f"q_{q_counter}",
                category="hr",
                question_text=hr_q["question"],
                target_topic=hr_q["topic"],
                target_skill="Behavioral & Soft Skills",
                difficulty="medium",
                expected_key_concepts=hr_q["concepts"],
                context_reason="Assesses behavioral competency, teamwork, and alignment with target role."
            ))
            q_counter += 1

    # 5. Fill remaining with Topic-based fallback questions if needed
    for top in topics:
        if len(questions) >= num_questions:
            break

        questions.append(QuestionItem(
            question_id=f"q_{q_counter}",
            category="technical" if "Core" in top.topic else "behavioral",
            question_text=f"Regarding '{top.topic}': Can you discuss your practical experience and approach to solving problems in this area?",
            target_topic=top.topic,
            target_skill=None,
            difficulty="medium",
            expected_key_concepts=["problem-solving framework", "domain knowledge", "practical execution"],
            context_reason=top.reason or "Priority interview topic from profile analysis."
        ))
        q_counter += 1

    return QuestionSetResponse(
        session_id=session_id,
        profile_id=profile_id,
        mode=mode,
        questions=questions,
        total_questions=len(questions)
    )
