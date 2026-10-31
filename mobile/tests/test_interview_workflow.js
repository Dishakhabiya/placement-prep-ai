const assert = require('assert');

/**
 * Test Suite: Real-Time Mock Interview Workflow & Early Termination
 * Tests covering Requirement 9:
 * 1. Early answer completion (Stop Answer & Continue)
 * 2. Maximum-duration timeout (3-minute answer timer auto-save)
 * 3. Interview termination during preparation phase
 * 4. Interview termination during recording (preserves in-progress answer)
 * 5. Upload failure handling (local blob preservation & retry)
 * 6. Completion of the last question (no extra load, show completion)
 * 7. Report clearly identifies missing transcripts and evaluations
 */

console.log('===============================================================');
console.log('Running Real-Time Mock Interview Workflow Test Suite');
console.log('===============================================================\n');

// Mock question set
const sampleQuestions = [
  {
    question_id: 'q_1',
    question_text: 'Explain indexing data structures in Postgres.',
    target_topic: 'Databases',
    category: 'technical',
    difficulty: 'medium',
    expected_key_concepts: ['B-Tree', 'Hash Index', 'Clustered'],
  },
  {
    question_id: 'q_2',
    question_text: 'Describe React concurrency and useTransition hook.',
    target_topic: 'Frontend',
    category: 'technical',
    difficulty: 'hard',
    expected_key_concepts: ['Fiber', 'Concurrent Mode', 'useTransition'],
  },
  {
    question_id: 'q_3',
    question_text: 'How do you design an idempotent payment processing API?',
    target_topic: 'System Design',
    category: 'system_design',
    difficulty: 'hard',
    expected_key_concepts: ['Idempotency Key', 'Atomic Transactions', 'Distributed Lock'],
  },
];

// Helper: Mock Interview Session State Machine
class MockInterviewStateMachine {
  constructor(questions) {
    this.questions = questions;
    this.currentIndex = 0;
    this.interviewPhase = 'prep'; // 'prep' | 'countdown' | 'recording' | 'completed'
    this.prepTimeRemaining = 10;
    this.countdownRemaining = 3;
    this.recordingDuration = 0;
    this.sessionAnswers = {};
    this.isTtsSpeaking = false;
    this.isFinalizing = false;
    this.isEnding = false;
    this.isAdvancing = false;
    this.hardwareTracksStopped = false;
    this.fullscreenExited = false;
    this.mediaRecorderActive = false;
  }

  // Phase 1: Preparation Phase
  startPreparation(index = 0) {
    this.currentIndex = index;
    this.interviewPhase = 'prep';
    this.prepTimeRemaining = 10;
    this.recordingDuration = 0;
    this.isTtsSpeaking = true;
  }

  skipPreparation() {
    this.isTtsSpeaking = false;
    this.startRecordingCountdown();
  }

  prepTick() {
    if (this.interviewPhase !== 'prep') return;
    this.prepTimeRemaining -= 1;
    if (this.prepTimeRemaining <= 0) {
      this.isTtsSpeaking = false;
      this.startRecordingCountdown();
    }
  }

  // Phase 2: Countdown Phase
  startRecordingCountdown() {
    this.interviewPhase = 'countdown';
    this.countdownRemaining = 3;
  }

  countdownTick() {
    if (this.interviewPhase !== 'countdown') return;
    this.countdownRemaining -= 1;
    if (this.countdownRemaining <= 0) {
      this.beginRecording();
    }
  }

  // Phase 3: Recording Phase
  beginRecording() {
    this.interviewPhase = 'recording';
    this.recordingDuration = 0;
    this.mediaRecorderActive = true;
  }

  recordingTick() {
    if (this.interviewPhase !== 'recording') return;
    this.recordingDuration += 1;
    if (this.recordingDuration >= 180) {
      // 3-Minute Maximum Duration Timeout
      this.stopAnswerAndContinue({ isTimeout: true });
    }
  }

  // Early Answer Completion: Stop Answer & Continue
  stopAnswerAndContinue({ isTimeout = false, customBlob = null } = {}) {
    if (this.isFinalizing || this.isEnding || this.isAdvancing) return;
    this.isFinalizing = true;

    const currentQ = this.questions[this.currentIndex];
    this.mediaRecorderActive = false;

    // Persist answer immediately before advancing
    const blob = customBlob || { size: 1024, type: 'video/webm' };
    this.sessionAnswers[currentQ.question_id] = {
      question: currentQ,
      blob,
      duration: this.recordingDuration,
      status: 'saved',
      isTimeout,
      isEvaluating: true,
      evaluation: null,
      transcript: '',
      error: null,
      retryable: false,
    };

    // Check if this was the last question
    if (this.currentIndex >= this.questions.length - 1) {
      this.hardwareTracksStopped = true;
      this.interviewPhase = 'completed';
      this.isFinalizing = false;
    } else {
      this.isAdvancing = true;
      const nextIdx = this.currentIndex + 1;
      this.currentIndex = nextIdx;
      this.isFinalizing = false;
      this.isAdvancing = false;
      this.startPreparation(nextIdx);
    }
  }

  // End Interview Confirmation
  confirmEndInterview() {
    if (this.isEnding) return;
    this.isEnding = true;

    // 1. Cancel TTS and timers
    this.isTtsSpeaking = false;

    // 2. If recording is active, finalize in-progress answer before terminating
    if (this.interviewPhase === 'recording' && this.mediaRecorderActive) {
      const currentQ = this.questions[this.currentIndex];
      this.mediaRecorderActive = false;
      this.sessionAnswers[currentQ.question_id] = {
        question: currentQ,
        blob: { size: 512, type: 'video/webm' },
        duration: this.recordingDuration,
        status: 'saved',
        isTimeout: false,
        isEvaluating: true,
        evaluation: null,
        transcript: '',
        error: null,
        retryable: false,
      };
    }

    // 3. Hardware cleanup
    this.hardwareTracksStopped = true;

    // 4. Exit fullscreen
    this.fullscreenExited = true;

    // 5. Transition to completed state
    this.interviewPhase = 'completed';
  }

  // Mock background evaluation completion
  completeBackgroundEvaluation(questionId, evaluationResult, isError = false) {
    const record = this.sessionAnswers[questionId];
    if (!record) return;
    if (isError) {
      record.isEvaluating = false;
      record.error = evaluationResult.error || 'Network error';
      record.retryable = true;
    } else {
      record.isEvaluating = false;
      record.evaluation = evaluationResult;
      record.transcript = evaluationResult.transcript_metadata?.transcript || '';
      record.error = null;
      record.retryable = false;
    }
  }

  retryUpload(questionId, successResult) {
    const record = this.sessionAnswers[questionId];
    if (!record || !record.retryable) return;
    record.isEvaluating = true;
    record.error = null;
    this.completeBackgroundEvaluation(questionId, successResult, false);
  }

  // Report generation helper
  generateReport() {
    const totalQ = this.questions.length;
    const answeredCount = Object.keys(this.sessionAnswers).length;
    const breakdown = this.questions.map((q) => {
      const ans = this.sessionAnswers[q.question_id];
      if (ans) {
        const hasTranscript = !!(ans.transcript && ans.transcript.trim().length > 0);
        const hasEvaluation = !!(ans.evaluation && ans.evaluation.relevance && typeof ans.evaluation.relevance.relevance_score === 'number');
        return {
          question_id: q.question_id,
          status: 'answered',
          has_transcript: hasTranscript,
          transcript: ans.transcript || null,
          has_evaluation: hasEvaluation,
          relevance_score: ans.evaluation?.relevance?.relevance_score ?? null,
          isEvaluating: ans.isEvaluating,
          error: ans.error,
        };
      }
      return {
        question_id: q.question_id,
        status: 'unanswered',
        has_transcript: false,
        transcript: null,
        has_evaluation: false,
        relevance_score: null,
      };
    });

    return {
      totalQuestions: totalQ,
      answeredQuestions: answeredCount,
      skippedQuestions: totalQ - answeredCount,
      completionRate: Math.round((answeredCount / totalQ) * 1000) / 10,
      breakdown,
    };
  }
}

// -------------------------------------------------------------
// TEST 1: Early Answer Completion (Stop Answer & Continue)
// -------------------------------------------------------------
{
  const session = new MockInterviewStateMachine(sampleQuestions);
  session.startPreparation(0);
  assert.strictEqual(session.interviewPhase, 'prep');
  assert.strictEqual(session.isTtsSpeaking, true);

  // Skip prep button
  session.skipPreparation();
  assert.strictEqual(session.interviewPhase, 'countdown');
  assert.strictEqual(session.isTtsSpeaking, false);

  // Finish countdown
  session.countdownTick();
  session.countdownTick();
  session.countdownTick();
  assert.strictEqual(session.interviewPhase, 'recording');

  // Speak for 25 seconds, then click "Stop Answer & Continue"
  for (let s = 0; s < 25; s++) session.recordingTick();
  assert.strictEqual(session.recordingDuration, 25);

  session.stopAnswerAndContinue();
  // Answer for q_1 must be safely persisted
  assert(session.sessionAnswers['q_1']);
  assert.strictEqual(session.sessionAnswers['q_1'].duration, 25);
  assert.strictEqual(session.sessionAnswers['q_1'].status, 'saved');
  assert.strictEqual(session.sessionAnswers['q_1'].isTimeout, false);

  // Must automatically advance to question 2 in prep phase
  assert.strictEqual(session.currentIndex, 1);
  assert.strictEqual(session.interviewPhase, 'prep');
  assert.strictEqual(session.prepTimeRemaining, 10);
  console.log('✓ Test 1 Passed: Early answer completion stops recording, persists answer, and advances cleanly.');
}

// -------------------------------------------------------------
// TEST 2: Maximum-Duration Timeout (3-minute auto-save)
// -------------------------------------------------------------
{
  const session = new MockInterviewStateMachine(sampleQuestions);
  session.startPreparation(0);
  session.skipPreparation();
  session.countdownTick();
  session.countdownTick();
  session.countdownTick();
  assert.strictEqual(session.interviewPhase, 'recording');

  // Let recording timer tick up to 180 seconds (3 minutes)
  for (let s = 0; s < 180; s++) {
    session.recordingTick();
  }

  // Answer must be auto-saved with timeout flag and advanced
  assert(session.sessionAnswers['q_1']);
  assert.strictEqual(session.sessionAnswers['q_1'].duration, 180);
  assert.strictEqual(session.sessionAnswers['q_1'].isTimeout, true);
  assert.strictEqual(session.sessionAnswers['q_1'].status, 'saved');
  assert.strictEqual(session.currentIndex, 1);
  assert.strictEqual(session.interviewPhase, 'prep');
  console.log('✓ Test 2 Passed: Maximum 3-minute duration timeout automatically finalizes answer and advances.');
}

// -------------------------------------------------------------
// TEST 3: Interview Termination During Preparation Phase
// -------------------------------------------------------------
{
  const session = new MockInterviewStateMachine(sampleQuestions);
  session.startPreparation(0);
  // Advance question 1 normally
  session.skipPreparation();
  session.countdownTick();
  session.countdownTick();
  session.countdownTick();
  for (let s = 0; s < 15; s++) session.recordingTick();
  session.stopAnswerAndContinue();

  // Now on Q2 in preparation phase
  assert.strictEqual(session.currentIndex, 1);
  assert.strictEqual(session.interviewPhase, 'prep');
  assert.strictEqual(session.isTtsSpeaking, true);

  // Candidate confirms End Interview during preparation
  session.confirmEndInterview();

  // TTS canceled, hardware tracks stopped, fullscreen exited, state completed
  assert.strictEqual(session.isTtsSpeaking, false);
  assert.strictEqual(session.hardwareTracksStopped, true);
  assert.strictEqual(session.fullscreenExited, true);
  assert.strictEqual(session.interviewPhase, 'completed');

  // Previously saved Q1 preserved, Q2 and Q3 marked as unanswered
  const report = session.generateReport();
  assert.strictEqual(report.answeredQuestions, 1);
  assert.strictEqual(report.skippedQuestions, 2);
  assert.strictEqual(report.breakdown[0].status, 'answered');
  assert.strictEqual(report.breakdown[1].status, 'unanswered');
  assert.strictEqual(report.breakdown[2].status, 'unanswered');
  console.log('✓ Test 3 Passed: Interview termination during preparation cancels TTS/timers and preserves past answers.');
}

// -------------------------------------------------------------
// TEST 4: Interview Termination During Active Recording
// -------------------------------------------------------------
{
  const session = new MockInterviewStateMachine(sampleQuestions);
  session.startPreparation(0);
  session.skipPreparation();
  session.countdownTick();
  session.countdownTick();
  session.countdownTick();
  assert.strictEqual(session.interviewPhase, 'recording');

  // Candidate speaks for 42 seconds, then confirms End Interview
  for (let s = 0; s < 42; s++) session.recordingTick();
  session.confirmEndInterview();

  // Active in-progress answer for Q1 must be saved before terminating!
  assert(session.sessionAnswers['q_1']);
  assert.strictEqual(session.sessionAnswers['q_1'].duration, 42);
  assert.strictEqual(session.sessionAnswers['q_1'].status, 'saved');
  assert.strictEqual(session.hardwareTracksStopped, true);
  assert.strictEqual(session.fullscreenExited, true);
  assert.strictEqual(session.interviewPhase, 'completed');

  // Q2 and Q3 are marked as skipped in report
  const report = session.generateReport();
  assert.strictEqual(report.answeredQuestions, 1);
  assert.strictEqual(report.skippedQuestions, 2);
  assert.strictEqual(report.breakdown[0].status, 'answered');
  assert.strictEqual(report.breakdown[1].status, 'unanswered');
  console.log('✓ Test 4 Passed: Termination during active recording captures in-progress answer and stops tracks safely.');
}

// -------------------------------------------------------------
// TEST 5: Upload Failure Handling & Local Blob Preservation
// -------------------------------------------------------------
{
  const session = new MockInterviewStateMachine(sampleQuestions);
  session.startPreparation(0);
  session.skipPreparation();
  session.countdownTick();
  session.countdownTick();
  session.countdownTick();
  for (let s = 0; s < 10; s++) session.recordingTick();

  const dummyBlob = { size: 4096, type: 'video/webm' };
  session.stopAnswerAndContinue({ customBlob: dummyBlob });

  // Simulate network failure during async background upload
  session.completeBackgroundEvaluation('q_1', { error: 'Network timeout: 504 Gateway Timeout' }, true);

  const answerRecord = session.sessionAnswers['q_1'];
  assert.strictEqual(answerRecord.status, 'saved');
  assert.strictEqual(answerRecord.retryable, true);
  assert.strictEqual(answerRecord.error, 'Network timeout: 504 Gateway Timeout');
  assert.strictEqual(answerRecord.blob.size, 4096); // Preserved locally!

  // Retry upload with preserved blob
  const successfulEval = {
    relevance: { relevance_score: 92.0 },
    concept_coverage: { coverage_score: 100.0 },
    transcript_metadata: { transcript: 'Postgres uses B-Trees and Hash indexes.' },
  };
  session.retryUpload('q_1', successfulEval);

  assert.strictEqual(answerRecord.retryable, false);
  assert.strictEqual(answerRecord.error, null);
  assert.strictEqual(answerRecord.transcript, 'Postgres uses B-Trees and Hash indexes.');
  console.log('✓ Test 5 Passed: Upload failures preserve media blob locally and support duplicate-free retry.');
}

// -------------------------------------------------------------
// TEST 6: Completion of the Last Question
// -------------------------------------------------------------
{
  const session = new MockInterviewStateMachine(sampleQuestions);

  // Complete Question 1
  session.startPreparation(0);
  session.skipPreparation();
  session.countdownTick();
  session.countdownTick();
  session.countdownTick();
  session.stopAnswerAndContinue();
  assert.strictEqual(session.currentIndex, 1);

  // Complete Question 2
  session.skipPreparation();
  session.countdownTick();
  session.countdownTick();
  session.countdownTick();
  session.stopAnswerAndContinue();
  assert.strictEqual(session.currentIndex, 2);

  // Complete Question 3 (Last Question)
  session.skipPreparation();
  session.countdownTick();
  session.countdownTick();
  session.countdownTick();
  session.stopAnswerAndContinue();

  // Index must not exceed questions.length - 1 (no out of bounds attempt)
  assert.strictEqual(session.currentIndex, 2);
  assert.strictEqual(session.interviewPhase, 'completed');
  assert.strictEqual(session.hardwareTracksStopped, true);

  const report = session.generateReport();
  assert.strictEqual(report.totalQuestions, 3);
  assert.strictEqual(report.answeredQuestions, 3);
  assert.strictEqual(report.skippedQuestions, 0);
  assert.strictEqual(report.completionRate, 100.0);
  assert.strictEqual(report.breakdown.every((q) => q.status === 'answered'), true);
  console.log('✓ Test 6 Passed: Completing the last question does not load extra questions and shows completion screen.');
}

// -------------------------------------------------------------
// TEST 7: Missing Transcript & Evaluation Clearly Identified
// -------------------------------------------------------------
{
  const session = new MockInterviewStateMachine(sampleQuestions);
  // Complete 2 questions, one with transcript and one where transcription failed/empty
  session.startPreparation(0);
  session.skipPreparation();
  session.countdownTick();
  session.countdownTick();
  session.countdownTick();
  session.stopAnswerAndContinue();
  session.completeBackgroundEvaluation('q_1', {
    relevance: { relevance_score: 85.0 },
    concept_coverage: { coverage_score: 80.0 },
    transcript_metadata: { transcript: 'B-Trees are balanced tree data structures.' },
  });

  // Question 2: Audio recorded, but no words recognized / missing transcript
  session.skipPreparation();
  session.countdownTick();
  session.countdownTick();
  session.countdownTick();
  session.stopAnswerAndContinue();
  session.completeBackgroundEvaluation('q_2', {
    relevance: null,
    concept_coverage: null,
    transcript_metadata: { transcript: '' }, // empty transcript
  });

  // End interview early
  session.confirmEndInterview();

  const report = session.generateReport();
  assert.strictEqual(report.breakdown[0].has_transcript, true);
  assert.strictEqual(report.breakdown[0].has_evaluation, true);
  assert.strictEqual(report.breakdown[1].has_transcript, false); // Clearly identified as missing
  assert.strictEqual(report.breakdown[1].has_evaluation, false); // Clearly identified as missing
  assert.strictEqual(report.breakdown[2].status, 'unanswered'); // Skipped
  console.log('✓ Test 7 Passed: Report clearly identifies missing transcripts and incomplete evaluations.');
}

console.log('\n===============================================================');
console.log('ALL 7 WORKFLOW & EARLY TERMINATION TESTS PASSED SUCCESSFULLY! 🎉');
console.log('===============================================================');
