/**
 * PrepAI - Standard Interview Questions Data
 */

const QUESTIONS = [
  {
    id: "q1",
    emoji: "👤",
    category: "Intro",
    question: "Tell me about yourself.",
    defaultGuide: "Start with who you are now, then your key wins, then why this role. For example: “I'm a developer with three years in fintech. I recently led a payments revamp that cut failures by 30%, and I'd love to bring that focus on reliability here.” Keep it under 90 seconds.",
    defaultScores: [
      { label: "Clarity & Structure", value: 88 },
      { label: "Confidence & Tone", value: 74 },
      { label: "Relevance & Impact", value: 82 }
    ],
    defaultTips: [
      "Keep your narrative under 90 seconds",
      "Lead with your current role and 1 flagship project",
      "Mention a quantified metric or performance improvement"
    ]
  },
  {
    id: "q2",
    emoji: "💪",
    category: "Self-awareness",
    question: "What are your biggest strengths and weaknesses?",
    defaultGuide: "Pick a real strength and back it with a short story. For the weakness, choose something genuine that you are actively fixing and name the step you took. Avoid disguised strengths like “I work too hard.”",
    defaultScores: [
      { label: "Self-Awareness", value: 84 },
      { label: "Specific Examples", value: 68 },
      { label: "Growth Mindset", value: 80 }
    ],
    defaultTips: [
      "Back your key strength with a 30-second proof story",
      "Choose a genuine weakness with an active remediation plan",
      "Show how you proactively seek feedback"
    ]
  },
  {
    id: "q3",
    emoji: "🤝",
    category: "Behavioural",
    question: "Describe a time you handled conflict at work.",
    defaultGuide: "Use STAR: Situation, Task, Action, Result. Stay calm and factual, focus on how you listened and found common ground, and finish with the outcome and what you learned.",
    defaultScores: [
      { label: "STAR Alignment", value: 90 },
      { label: "Empathy & Listening", value: 76 },
      { label: "Team Outcome", value: 72 }
    ],
    defaultTips: [
      "Explicitly separate personal emotions from the technical issue",
      "Show how you actively listened to the opposing perspective",
      "Finish with the positive business or team outcome"
    ]
  },
  {
    id: "q4",
    emoji: "🚀",
    category: "Motivation",
    question: "Why do you want to work here?",
    defaultGuide: "Link something specific about the company, like a product, value or engineering milestone, to your own goals and skills. Show you have done your homework and say what you would add in your first six months.",
    defaultScores: [
      { label: "Company Research", value: 82 },
      { label: "Role & Value Fit", value: 86 },
      { label: "Energy & Vision", value: 78 }
    ],
    defaultTips: [
      "Reference specific products, engineering blogs, or company values",
      "Articulate how your skillset solves their current challenges",
      "Share what you hope to accomplish in your first 90 days"
    ]
  },
  {
    id: "q5",
    emoji: "⚡",
    category: "Problem Solving",
    question: "Tell me about a complex technical problem or bug you investigated and fixed.",
    defaultGuide: "Walk the interviewer through your systematic debugging process: how you reproduced it, isolated root cause, benchmarked alternatives, and verified the fix in production.",
    defaultScores: [
      { label: "Diagnostic Method", value: 85 },
      { label: "Technical Depth", value: 80 },
      { label: "Prevention & Testing", value: 78 }
    ],
    defaultTips: [
      "Describe your systematic hypothesis testing",
      "Explain trade-offs considered during the fix",
      "Mention automated tests added to prevent regressions"
    ]
  },
  {
    id: "q6",
    emoji: "🎯",
    category: "Leadership",
    question: "Describe a project where you took initiative or led without formal authority.",
    defaultGuide: "Demonstrate ownership, cross-functional collaboration, and how you persuaded stakeholders or unblocked peers.",
    defaultScores: [
      { label: "Ownership & Drive", value: 86 },
      { label: "Persuasion & Collab", value: 82 },
      { label: "Measurable Impact", value: 75 }
    ],
    defaultTips: [
      "Clarify why you stepped up and identified the gap",
      "Explain how you aligned teammates with differing opinions",
      "Quantify the project outcome for the organization"
    ]
  },
  {
    id: "q7",
    emoji: "🧭",
    category: "Career Vision",
    question: "Where do you see yourself professionally in three to five years?",
    defaultGuide: "Frame realistic ambition: mastery of core domain, taking on broader architectural or mentorship responsibilities, and long-term commitment to high impact.",
    defaultScores: [
      { label: "Clarity of Goals", value: 80 },
      { label: "Realistic Path", value: 84 },
      { label: "Company Alignment", value: 78 }
    ],
    defaultTips: [
      "Focus on skill progression and scope of impact",
      "Express interest in mentoring or technical leadership",
      "Connect your personal growth to the company's expansion"
    ]
  },
  {
    id: "q8",
    emoji: "🙋",
    category: "Your turn",
    question: "What questions do you have for the interviewer?",
    defaultGuide: "Asking smart, reverse-interview questions signals curiosity and seniority. Ask about engineering culture, deployment velocity, and team success metrics.",
    defaultScores: [
      { label: "Intellectual Curiosity", value: 88 },
      { label: "Strategic Perspective", value: 85 },
      { label: "Culture Relevance", value: 82 }
    ],
    defaultTips: [
      "Ask what separates top performers on this specific team",
      "Inquire about technical debt vs new feature balance",
      "Ask about team feedback loops and 1-on-1 cadence"
    ]
  }
];

function getAllQuestions() {
  return QUESTIONS;
}

function getQuestionById(id) {
  return QUESTIONS.find(q => q.id === id) || null;
}

function getRandomQuestion() {
  const index = Math.floor(Math.random() * QUESTIONS.length);
  return QUESTIONS[index];
}

module.exports = {
  QUESTIONS,
  getAllQuestions,
  getQuestionById,
  getRandomQuestion
};
