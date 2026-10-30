/**
 * PrepAI - Server
 * Node.js 20 + Express server serving API endpoints & static frontend on port 8083.
 */
require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { getAllQuestions, getQuestionById, getRandomQuestion } = require('./questions');
const { evaluateInterviewAnswer } = require('./llm');
const { saveAttempt, getHistory, deleteAttempt, clearHistory } = require('./database');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 8083;

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static frontend from /public
app.use(express.static(path.join(__dirname, 'public')));

// Rate Limiting for LLM feedback to prevent abuse
const feedbackLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // limit each IP to 20 feedback requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many feedback requests. Please wait a moment before trying again.'
  }
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', apiLimiter);

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

/**
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'PrepAI Interview Coach',
    port: PORT,
    provider: process.env.LLM_PROVIDER || 'mock',
    model: process.env.LLM_MODEL || 'default',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/questions
 * Returns standard question list
 */
app.get('/api/questions', (req, res) => {
  try {
    const questions = getAllQuestions();
    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load questions.' });
  }
});

/**
 * GET /api/questions/random
 * Returns a single random question
 */
app.get('/api/questions/random', (req, res) => {
  try {
    const question = getRandomQuestion();
    res.json(question);
  } catch (err) {
    res.status(500).json({ error: 'Failed to pick random question.' });
  }
});

/**
 * POST /api/feedback
 * Body: { questionId, question, answer }
 * Returns validated JSON: { coach_reply, scores, tips }
 */
app.post('/api/feedback', feedbackLimiter, async (req, res) => {
  try {
    const { questionId, question: clientQuestion, answer } = req.body;

    // Validation
    if (!answer || typeof answer !== 'string') {
      return res.status(400).json({
        error: 'Answer is required and must be text.'
      });
    }

    const trimmedAnswer = answer.trim();
    if (trimmedAnswer.length < 3) {
      return res.status(400).json({
        error: 'Answer is too short. Please provide a more complete response.'
      });
    }

    if (trimmedAnswer.length > 5000) {
      return res.status(400).json({
        error: 'Answer exceeds the 5,000 character limit. Please shorten your response.'
      });
    }

    let questionItem = null;
    if (questionId) {
      questionItem = getQuestionById(questionId);
    }

    const questionText = questionItem ? questionItem.question : (clientQuestion || 'Tell me about yourself.');
    const category = questionItem ? questionItem.category : 'General';

    // Evaluate answer with LLM / heuristic engine (with automatic retry)
    const feedback = await evaluateInterviewAnswer(questionText, trimmedAnswer);

    // Save to SQLite history
    const savedId = saveAttempt({
      questionId: questionItem ? questionItem.id : (questionId || 'custom'),
      question: questionText,
      category,
      answer: trimmedAnswer,
      coach_reply: feedback.coach_reply,
      scores: feedback.scores,
      tips: feedback.tips
    });

    res.json({
      success: true,
      attemptId: savedId,
      questionId: questionItem ? questionItem.id : 'custom',
      question: questionText,
      category,
      answer: trimmedAnswer,
      coach_reply: feedback.coach_reply,
      scores: feedback.scores,
      tips: feedback.tips
    });
  } catch (err) {
    console.error('[Error /api/feedback]', err);
    res.status(500).json({
      error: 'Failed to analyze answer. Please try again.',
      details: err.message
    });
  }
});

/**
 * GET /api/feedback/stream (SSE)
 * Streams the coach reply word-by-word with Server-Sent Events,
 * then sends the final scores and tips.
 */
app.get('/api/feedback/stream', async (req, res) => {
  const { questionId, question: queryQuestion, answer } = req.query;

  if (!answer || typeof answer !== 'string' || answer.trim().length < 3) {
    return res.status(400).send('Answer must be at least 3 characters.');
  }

  // Setup SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    let questionItem = null;
    if (questionId) questionItem = getQuestionById(questionId);
    const questionText = questionItem ? questionItem.question : (queryQuestion || 'Tell me about yourself.');
    const category = questionItem ? questionItem.category : 'General';

    sendEvent('status', { message: 'Analyzing response…' });

    // Evaluate answer
    const feedback = await evaluateInterviewAnswer(questionText, answer.trim());

    // Save to database
    const savedId = saveAttempt({
      questionId: questionItem ? questionItem.id : 'custom',
      question: questionText,
      category,
      answer: answer.trim(),
      coach_reply: feedback.coach_reply,
      scores: feedback.scores,
      tips: feedback.tips
    });

    // Stream words of coach reply
    const words = feedback.coach_reply.split(' ');
    for (let i = 0; i < words.length; i++) {
      sendEvent('chunk', {
        text: words[i] + (i < words.length - 1 ? ' ' : '')
      });
      // slight delay for fluid streaming experience
      await new Promise(r => setTimeout(r, 28));
    }

    // Send complete event with scores and tips
    sendEvent('complete', {
      attemptId: savedId,
      coach_reply: feedback.coach_reply,
      scores: feedback.scores,
      tips: feedback.tips
    });

    res.end();
  } catch (err) {
    sendEvent('error', { message: err.message || 'Stream processing failed' });
    res.end();
  }
});

/**
 * GET /api/history
 * Returns past practice attempts
 */
app.get('/api/history', (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 50);
    const history = getHistory(limit);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve history.' });
  }
});

/**
 * DELETE /api/history/:id
 */
app.delete('/api/history/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    deleteAttempt(id);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete history item.' });
  }
});

/**
 * DELETE /api/history
 * Clears all practice history
 */
app.delete('/api/history', (req, res) => {
  try {
    clearHistory();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear history.' });
  }
});

// Fallback for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start listening
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`  PrepAI Interview Coach Server running on port ${PORT}`);
  console.log(`  Open in browser: http://localhost:${PORT}`);
  console.log(`  LLM Provider: ${process.env.LLM_PROVIDER || 'mock'}`);
  console.log(`======================================================\n`);
});
