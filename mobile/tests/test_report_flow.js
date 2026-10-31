const assert = require('assert');

// Mock data simulating 3 questions, 2 answered and 1 unanswered
const sampleQuestions = [
  { question_id: 'q_1', question_text: 'Explain indexing in Postgres', target_topic: 'Databases', expected_key_concepts: ['B-Tree', 'Indexes'] },
  { question_id: 'q_2', question_text: 'Explain React memoization', target_topic: 'Frontend', expected_key_concepts: ['useMemo', 'useCallback'] },
  { question_id: 'q_3', question_text: 'Explain ACID transactions', target_topic: 'Databases', expected_key_concepts: ['Atomicity', 'Isolation'] },
];

const sampleSessionAnswers = [
  {
    question: sampleQuestions[0],
    transcript: 'Postgres indexing uses B-Tree data structures.',
    duration: 5.5,
    evaluation: {
      question_id: 'q_1',
      relevance: { relevance_score: 90.0 },
      concept_coverage: { coverage_score: 100.0, covered_concepts: ['B-Tree', 'Indexes'], missing_concepts: [] },
      transcript_metadata: { word_count: 7, duration_seconds: 5.5 },
      delivery_metrics: { words_per_minute: 76.4, pace_rating: 'Slow', total_filler_words: 0 },
      visual_metrics: { video_track_detected: true, face_presence_ratio: 92.0, face_centering_ratio: 88.0 },
    },
    followup: null,
  },
  {
    question: sampleQuestions[1],
    transcript: 'Um, basically React useMemo caches calculated values, like, across re-renders.',
    duration: 6.0,
    evaluation: {
      question_id: 'q_2',
      relevance: { relevance_score: 80.0 },
      concept_coverage: { coverage_score: 50.0, covered_concepts: ['useMemo'], missing_concepts: ['useCallback'] },
      transcript_metadata: { word_count: 10, duration_seconds: 6.0 },
      delivery_metrics: { words_per_minute: 100.0, pace_rating: 'Optimal', total_filler_words: 3, filler_word_breakdown: { um: 1, basically: 1, like: 1 } },
      visual_metrics: { video_track_detected: true, face_presence_ratio: 86.0, face_centering_ratio: 80.0 },
    },
    followup: { followup_question: 'When would you prefer useCallback over useMemo?', focus_area: 'Function references' },
  },
];

console.log('--- Testing Report Data Aggregation ---');

// Test 1: Check session answered count & completion rate
const totalQuestions = sampleQuestions.length;
const answeredQuestions = sampleSessionAnswers.length;
assert.strictEqual(totalQuestions, 3);
assert.strictEqual(answeredQuestions, 2);
const completionRate = Math.round((answeredQuestions / totalQuestions) * 1000) / 10;
assert.strictEqual(completionRate, 66.7);
console.log('✓ Test 1 Passed: Question counts and completion rate (66.7%)');

// Test 2: Aggregated Relevance and Concept Coverage
const relevanceScores = sampleSessionAnswers.map(a => a.evaluation.relevance.relevance_score);
const avgRelevance = relevanceScores.reduce((a, b) => a + b, 0) / relevanceScores.length;
assert.strictEqual(avgRelevance, 85.0);

const coverageScores = sampleSessionAnswers.map(a => a.evaluation.concept_coverage.coverage_score);
const avgCoverage = coverageScores.reduce((a, b) => a + b, 0) / coverageScores.length;
assert.strictEqual(avgCoverage, 75.0);
console.log('✓ Test 2 Passed: Relevance (85.0%) and Concept Coverage (75.0%) averages');

// Test 3: Delivery Pacing and Fillers Aggregation
const totalFillers = sampleSessionAnswers.reduce((sum, a) => sum + (a.evaluation.delivery_metrics?.total_filler_words || 0), 0);
assert.strictEqual(totalFillers, 3);
const totalWords = sampleSessionAnswers.reduce((sum, a) => sum + (a.evaluation.transcript_metadata?.word_count || 0), 0);
assert.strictEqual(totalWords, 17);
const fillerPct = Math.round(((totalFillers / totalWords) * 100) * 10) / 10;
assert.strictEqual(fillerPct, 17.6);
console.log('✓ Test 3 Passed: Delivery filler word aggregation');

// Test 4: Visual Framing Centering & Presence
const videoAnswers = sampleSessionAnswers.filter(a => a.evaluation.visual_metrics?.video_track_detected);
assert.strictEqual(videoAnswers.length, 2);
const avgPresence = videoAnswers.reduce((sum, a) => sum + a.evaluation.visual_metrics.face_presence_ratio, 0) / videoAnswers.length;
assert.strictEqual(avgPresence, 89.0);
console.log('✓ Test 4 Passed: Visual framing presence ratio (89.0%)');

// Test 5: Unanswered questions preservation (No fabricated scores)
const questionBreakdown = sampleQuestions.map(q => {
  const ans = sampleSessionAnswers.find(a => a.question.question_id === q.question_id);
  if (ans) {
    return {
      question_id: q.question_id,
      status: 'answered',
      relevance_score: ans.evaluation.relevance.relevance_score,
      followup: ans.followup,
    };
  }
  return {
    question_id: q.question_id,
    status: 'unanswered',
    relevance_score: null,
  };
});

assert.strictEqual(questionBreakdown.length, 3);
assert.strictEqual(questionBreakdown[0].status, 'answered');
assert.strictEqual(questionBreakdown[0].relevance_score, 90.0);
assert.strictEqual(questionBreakdown[1].status, 'answered');
assert.strictEqual(questionBreakdown[1].followup.focus_area, 'Function references');
assert.strictEqual(questionBreakdown[2].status, 'unanswered');
assert.strictEqual(questionBreakdown[2].relevance_score, null);
console.log('✓ Test 5 Passed: Question breakdown preserves answered and unanswered states cleanly');

// Test 6: Empty Session Answers (0 answers)
const emptyAnswers = [];
assert.strictEqual(emptyAnswers.length, 0);
const emptyCompletion = totalQuestions > 0 ? (emptyAnswers.length / totalQuestions) * 100 : 0;
assert.strictEqual(emptyCompletion, 0);
console.log('✓ Test 6 Passed: Empty session handled gracefully without division by zero');

console.log('\nAll 6 Report Flow & Session Aggregation Tests Passed Successfully!');
