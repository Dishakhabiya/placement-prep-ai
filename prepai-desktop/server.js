require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 8085;
const HISTORY_FILE = path.join(__dirname, 'history.json');

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Standard Questions
const QUESTIONS = [
  {
    id: "q1",
    label: "Q1",
    tag: "Intro",
    tagColor: "var(--mint)",
    text: "Tell me about yourself."
  },
  {
    id: "q2",
    label: "Q2",
    tag: "Self-awareness",
    tagColor: "var(--sun)",
    text: "What are your biggest strengths and weaknesses?"
  },
  {
    id: "q3",
    label: "Q3",
    tag: "Your turn",
    tagColor: "#c9b8f5",
    text: "Why should I hire you over other candidates?"
  }
];

// Pool of 10 extra questions for the "Surprise me" dice
const QUESTION_POOL = [
  { id: "pool-1", tag: "Conflict", text: "Describe a time you handled conflict at work." },
  { id: "pool-2", tag: "Vision", text: "Where do you see yourself in five years?" },
  { id: "pool-3", tag: "Projects", text: "Tell me about a technical project you are proud of." },
  { id: "pool-4", tag: "Motivation", text: "Why do you want this role specifically?" },
  { id: "pool-5", tag: "Deadlines", text: "How do you handle tight deadlines and high pressure?" },
  { id: "pool-6", tag: "Achievement", text: "What is your greatest professional achievement so far?" },
  { id: "pool-7", tag: "Resilience", text: "Describe a time you failed or made a mistake, and how you handled it." },
  { id: "pool-8", tag: "Prioritization", text: "How do you prioritize competing tasks when everything feels urgent?" },
  { id: "pool-9", tag: "Learning", text: "What is your approach to rapidly learning a new technology or domain?" },
  { id: "pool-10", tag: "Leadership", text: "Tell me about a time you took initiative or demonstrated leadership." }
];

// Helper to read history
function readHistory() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) {
      fs.writeFileSync(HISTORY_FILE, '[]', 'utf8');
      return [];
    }
    const data = fs.readFileSync(HISTORY_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Error reading history file:', err);
    return [];
  }
}

// Helper to write history
function writeHistory(historyList) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(historyList.slice(-20), null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing history file:', err);
  }
}

// -------------------------------------------------------------
// 1. GET /api/questions
// -------------------------------------------------------------
app.get('/api/questions', (req, res) => {
  res.json(QUESTIONS);
});

// -------------------------------------------------------------
// 2. GET /api/random-question
// -------------------------------------------------------------
app.get('/api/random-question', (req, res) => {
  const index = Math.floor(Math.random() * QUESTION_POOL.length);
  const picked = QUESTION_POOL[index];
  res.json({
    id: picked.id,
    label: "Random",
    tag: picked.tag,
    text: picked.text
  });
});

// -------------------------------------------------------------
// 3. POST /api/coach
// -------------------------------------------------------------
app.post('/api/coach', async (req, res) => {
  const { question, answer } = req.body;

  if (!question || !answer || typeof answer !== 'string' || !answer.trim()) {
    return res.status(400).json({ error: 'Question and answer are both required.' });
  }

  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();

  // If Anthropic API key is provided, call Claude
  if (apiKey) {
    try {
      const systemPrompt = `You are a friendly, encouraging, and sharp interview coach.
Your job is to evaluate the candidate's answer to the given interview question.
You MUST reply with JSON ONLY. Do not include markdown code block formatting (no \`\`\`json or \`\`\`).
The JSON structure must be:
{
  "score": <number between 1 and 10>,
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<actionable improvement 1>", "<actionable improvement 2>"],
  "sampleAnswer": "<a polished, professional model answer to this question in 2-3 sentences>"
}`;

      const userMessage = `Interview Question: "${question}"\nCandidate's Answer: "${answer}"`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Anthropic API error:', response.status, errorText);
        return res.status(502).json({
          error: "Couldn't reach the coach. Check your API key and try again."
        });
      }

      const data = await response.json();
      let rawText = data.content?.[0]?.text || '';

      // Strip any ```json fences before parsing as required
      rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

      let parsed;
      try {
        parsed = JSON.parse(rawText);
      } catch (parseErr) {
        console.error('JSON parsing failed for text:', rawText);
        return res.status(500).json({
          error: "Received an invalid format from the coach. Please try again."
        });
      }

      // Save to history automatically
      const history = readHistory();
      const entry = {
        id: Date.now().toString(),
        question,
        answer: answer.trim(),
        score: parsed.score || 8,
        strengths: parsed.strengths || [],
        improvements: parsed.improvements || [],
        sampleAnswer: parsed.sampleAnswer || '',
        timestamp: new Date().toISOString()
      };
      history.push(entry);
      writeHistory(history);

      return res.json(parsed);
    } catch (err) {
      console.error('Error calling Anthropic:', err);
      return res.status(502).json({
        error: "Couldn't reach the coach. Check your API key and try again."
      });
    }
  }

  // Fallback demo heuristic if ANTHROPIC_API_KEY is not set yet
  // Ensures user can test UI immediately while giving clear guidance
  const wordCount = answer.trim().split(/\s+/).length;
  let score = 7;
  if (wordCount >= 25 && wordCount <= 120) score = 8;
  if (wordCount > 120) score = 9;
  if (wordCount < 15) score = 5;

  const mockFeedback = {
    score,
    strengths: [
      "Direct answer that addressed the core intent of the question.",
      "Clear tone with positive personal ownership."
    ],
    improvements: [
      "Consider backing your answer with 1 quantified metric or project outcome.",
      "Anchor your response using the STAR method (Situation, Task, Action, Result)."
    ],
    sampleAnswer: `Start by framing the situation clearly, describe the specific technical or strategic action you took, and conclude with the measurable positive outcome for your team or customer.`
  };

  // Save to history
  const history = readHistory();
  const entry = {
    id: Date.now().toString(),
    question,
    answer: answer.trim(),
    score: mockFeedback.score,
    strengths: mockFeedback.strengths,
    improvements: mockFeedback.improvements,
    sampleAnswer: mockFeedback.sampleAnswer,
    timestamp: new Date().toISOString()
  };
  history.push(entry);
  writeHistory(history);

  return res.json(mockFeedback);
});

// -------------------------------------------------------------
// 4. GET /api/history and POST /api/history
// -------------------------------------------------------------
app.get('/api/history', (req, res) => {
  const history = readHistory();
  res.json(history.slice(-20).reverse());
});

app.post('/api/history', (req, res) => {
  const { question, answer, score, strengths, improvements, sampleAnswer } = req.body;
  if (!question || !answer) {
    return res.status(400).json({ error: 'Question and answer are required.' });
  }

  const history = readHistory();
  const newEntry = {
    id: Date.now().toString(),
    question,
    answer: answer.trim(),
    score: score || 7,
    strengths: strengths || [],
    improvements: improvements || [],
    sampleAnswer: sampleAnswer || '',
    timestamp: new Date().toISOString()
  };

  history.push(newEntry);
  writeHistory(history);
  res.status(201).json(newEntry);
});

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`  PrepAI Desktop App running on port ${PORT}`);
  console.log(`  Open in browser: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
