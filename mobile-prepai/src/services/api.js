/**
 * PrepAI Backend API Service (Stubs)
 * Ready for future connection with FastAPI backend on http://localhost:8000
 */

const BACKEND_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Evaluate spoken or typed interview answer
 * TODO: Wire with POST /api/interview/evaluate
 */
export async function evaluateAnswer({
  questionId,
  questionText,
  textAnswer,
  audioUri,
}) {
  console.log('[PrepAI API] evaluateAnswer stub called:', {
    questionId,
    questionText,
    textAnswer,
    audioUri,
  });

  await new Promise((resolve) => setTimeout(resolve, 800));

  return {
    score: 85,
    feedback:
      'Strong structure and clear impact. Consider quantifying results with metrics.',
    keywords: ['teamwork', 'leadership', 'impact'],
    strengths: ['Clear delivery', 'STAR format adherence'],
    areasToImprove: ['Add measurable outcome'],
  };
}

/**
 * Transcribe recorded speech audio
 * TODO: Wire with POST /api/interview/transcribe or Whisper endpoint
 */
export async function transcribeAudio(audioUri) {
  console.log('[PrepAI API] transcribeAudio stub called:', audioUri);

  await new Promise((resolve) => setTimeout(resolve, 600));

  return {
    transcript: 'I worked on scaling a real-time event pipeline using Kafka.',
    confidence: 0.94,
  };
}

/**
 * Fetch a random surprise practice question
 * TODO: Wire with GET /api/interview/questions/random
 */
export async function getRandomQuestion() {
  console.log('[PrepAI API] getRandomQuestion stub called');

  await new Promise((resolve) => setTimeout(resolve, 300));

  return {
    id: `rand-${Date.now()}`,
    question: 'How do you handle disagreement with a technical decision?',
    category: 'Behavioral',
    difficulty: 'Medium',
  };
}

/**
 * Fetch user streak and daily goal status
 * TODO: Wire with GET /api/profiles/active/streak
 */
export async function getStreakStatus() {
  console.log('[PrepAI API] getStreakStatus stub called');

  return {
    streakDays: 3,
    hasPracticedToday: false,
    questionsCompletedToday: 1,
    dailyGoal: 3,
  };
}

/**
 * Save / bookmark a question
 * TODO: Wire with POST /api/interview/saved
 */
export async function saveQuestion(questionId) {
  console.log('[PrepAI API] saveQuestion stub called:', questionId);

  return {
    success: true,
    questionId,
  };
}
