/**
 * PrepAI - LLM Service
 * Handles calling LLM providers (OpenAI, Gemini, Anthropic, Ollama, or Mock/Local Heuristics)
 * with strict JSON output validation and automatic single retry on failure.
 */

function sanitizeJsonString(str) {
  if (!str) return '';
  // Remove markdown code blocks if present
  let cleaned = str.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

function validateFeedbackSchema(data) {
  if (!data || typeof data !== 'object') return false;
  if (typeof data.coach_reply !== 'string' || !data.coach_reply.trim()) return false;
  if (!Array.isArray(data.scores) || data.scores.length === 0) return false;
  for (const s of data.scores) {
    if (!s || typeof s.label !== 'string' || typeof s.value !== 'number') return false;
    if (s.value < 0 || s.value > 100) return false;
  }
  if (!Array.isArray(data.tips) || data.tips.length === 0) return false;
  for (const t of data.tips) {
    if (typeof t !== 'string' || !t.trim()) return false;
  }
  return true;
}

/**
 * Intelligent Local Heuristic Interview Evaluation Engine
 * Used when LLM_PROVIDER=mock or when an external API key is absent / offline.
 * Analyzes word count, STAR methodology, metrics, clarity, and tone.
 */
function generateHeuristicFeedback(questionText, answerText) {
  const words = answerText.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const lower = answerText.toLowerCase();

  // Metrics detection (numbers, percentages, metrics)
  const hasNumbers = /\d+%|\d+\s*(percent|users|x|times|months|years|k|m|million|dollars|rs|projects)/i.test(answerText);
  // STAR keywords
  const hasSituation = /(when|during|while|at my previous|in my last|situation|task|project|team)/i.test(lower);
  const hasAction = /(i led|i created|i built|i initiated|i resolved|i researched|i implemented|i chose|i reached out)/i.test(lower);
  const hasResult = /(result|outcome|improved|reduced|increased|boosted|learned|saved|delivered|succeeded)/i.test(lower);
  const hasReflective = /(learned|growth|improve|feedback|better|realized|perspective)/i.test(lower);

  // Scoring logic
  let clarityScore = 70;
  let relevanceScore = 72;
  let confidenceScore = 68;
  let structureScore = 70;

  if (wordCount >= 20 && wordCount <= 180) {
    clarityScore += 12;
    confidenceScore += 10;
  } else if (wordCount > 180) {
    clarityScore += 5; // Good detail, but might be slightly long
    relevanceScore += 12;
  } else {
    clarityScore -= 15; // Too brief
    confidenceScore -= 15;
  }

  if (hasNumbers) {
    relevanceScore += 10;
    structureScore += 8;
  }
  if (hasAction) {
    confidenceScore += 10;
  }
  if (hasResult) {
    structureScore += 10;
  }
  if (hasReflective) {
    confidenceScore += 6;
  }

  // Bound scores between 50 and 96
  clarityScore = Math.max(52, Math.min(95, clarityScore));
  relevanceScore = Math.max(55, Math.min(94, relevanceScore));
  confidenceScore = Math.max(50, Math.min(92, confidenceScore));
  structureScore = Math.max(54, Math.min(96, structureScore));

  let coachReply = '';
  const tips = [];

  const isIntro = /tell me about yourself|intro/i.test(questionText);
  const isStrengthWeakness = /strength|weakness/i.test(questionText);
  const isConflict = /conflict|disagree|difficult/i.test(questionText);
  const isMotivation = /why.*(work here|join|company|role)|motivat/i.test(questionText);

  if (isIntro) {
    if (wordCount < 25) {
      coachReply = "Good starting thought, but your intro is quite brief for a placement interview. Frame your story around: (1) who you are today, (2) your most impressive engineering or product win, and (3) why this company aligns with your next step.";
      tips.push("Aim for 60 to 90 seconds (approx. 100-140 words).");
      tips.push("Mention a concrete project with an outcome or impact metric.");
      tips.push("End with an enthusiastic pivot toward the target role.");
    } else {
      coachReply = "Strong, engaging self-introduction! You communicated your core identity and gave the interviewer a clear hook. To make it unforgettable, ensure your primary accomplishment includes a concrete metric (e.g., latency cut or user scale) and finishes with why this exact team excites you.";
      tips.push("Highlight 1 flagship project and mention the tech stack used.");
      tips.push("Quantify your impact (e.g. 'improved performance by 30%').");
      tips.push("Keep the delivery concise so the interviewer has room to ask follow-up questions.");
    }
  } else if (isStrengthWeakness) {
    coachReply = "Thoughtful response! You handled a delicate question with self-awareness. When discussing your weakness, avoid disguised strengths (like 'I'm a perfectionist'). Instead, name a genuine growth area and spotlight the active systems you've built to overcome it.";
    tips.push("Back your strength with a rapid 30-second proof story.");
    tips.push("Frame your weakness as an active learning curve with measurable progress.");
    tips.push("Emphasize receptive feedback habits.");
  } else if (isConflict) {
    coachReply = "Solid composure on a classic behavioral test. The best answers clearly separate the interpersonal emotion from the technical or operational disagreement, demonstrate active listening, and conclude with a positive team outcome.";
    tips.push("Follow the STAR method: Situation, Task, Action, Result.");
    tips.push("Showcase empathetic listening before proposing compromises.");
    tips.push("State what you and your teammate learned from the experience.");
  } else if (isMotivation) {
    coachReply = "Compelling motivation! You connected your skills to the opportunity. To make this answer truly top-tier, weave in a recent company milestone, engineering blog post, or product feature to show you've done in-depth homework.";
    tips.push("Reference specific values or products of the company.");
    tips.push("Articulate what unique value you will deliver in your first 90 days.");
    tips.push("Keep your enthusiasm authentic and grounded in practical goals.");
  } else {
    coachReply = "Great attempt! You addressed the core of the question directly. With structured signposting ('First...', 'Second...') and quantified results, this answer will stand out in technical and HR rounds.";
    tips.push("Structure your points with clear transitions.");
    tips.push("Include a real-world scenario to substantiate your claims.");
    tips.push("Conclude with an outcome-focused summary.");
  }

  return {
    coach_reply: coachReply,
    scores: [
      { label: "Clarity & Structure", value: clarityScore },
      { label: "Relevance & Depth", value: relevanceScore },
      { label: "Confidence & Tone", value: confidenceScore },
      { label: "STAR Alignment", value: structureScore }
    ],
    tips: tips.slice(0, 3)
  };
}

/**
 * Call External LLM API with strict prompt instructions
 */
async function callExternalLlm(provider, apiKey, model, questionText, answerText) {
  const systemPrompt = `You are PrepAI, an expert, encouraging, and sharp executive interview coach.
Analyze the candidate's answer for the given interview question.
You MUST respond with ONLY a strict valid JSON object (no markdown fences, no explanatory prefix).
The JSON object must have this exact shape:
{
  "coach_reply": "2-3 sentences of constructive, encouraging, high-impact interview coaching feedback directly addressing the candidate's answer.",
  "scores": [
    { "label": "Clarity & Structure", "value": <integer 0-100> },
    { "label": "Relevance & Depth", "value": <integer 0-100> },
    { "label": "Confidence & Tone", "value": <integer 0-100> },
    { "label": "STAR Alignment", "value": <integer 0-100> }
  ],
  "tips": [
    "Specific actionable tip 1",
    "Specific actionable tip 2",
    "Specific actionable tip 3"
  ]
}`;

  const userPrompt = `Interview Question: "${questionText}"
Candidate's Spoken/Typed Answer: "${answerText}"

Return the JSON feedback object now:`;

  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.4,
        response_format: { type: 'json_object' }
      })
    });
    if (!res.ok) {
      throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    return JSON.parse(sanitizeJsonString(content));
  }

  if (provider === 'gemini') {
    const geminiModel = model || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }
        ],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: 'application/json'
        }
      })
    });
    if (!res.ok) {
      throw new Error(`Gemini API error: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return JSON.parse(sanitizeJsonString(content));
  }

  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model || 'claude-3-5-haiku-20241022',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });
    if (!res.ok) {
      throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    const content = data.content?.[0]?.text;
    return JSON.parse(sanitizeJsonString(content));
  }

  if (provider === 'ollama') {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'llama3.2',
        prompt: `${systemPrompt}\n\n${userPrompt}`,
        format: 'json',
        stream: false
      })
    });
    if (!res.ok) {
      throw new Error(`Ollama API error: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    return JSON.parse(sanitizeJsonString(data.response));
  }

  throw new Error(`Unsupported LLM provider: ${provider}`);
}

/**
 * Main evaluation entry point
 * Attempts external API if configured; validates schema; retries once on failure;
 * falls back cleanly to the heuristic engine if no API key is provided or errors persist.
 */
async function evaluateInterviewAnswer(questionText, answerText) {
  const provider = (process.env.LLM_PROVIDER || 'mock').toLowerCase();
  const apiKey = (process.env.LLM_API_KEY || '').trim();
  const model = process.env.LLM_MODEL || '';

  // If mock or no API key, use intelligent heuristics directly
  if (provider === 'mock' || !apiKey) {
    return generateHeuristicFeedback(questionText, answerText);
  }

  // Attempt 1
  try {
    const result = await callExternalLlm(provider, apiKey, model, questionText, answerText);
    if (validateFeedbackSchema(result)) {
      return result;
    }
    console.warn('[LLM] Output failed schema validation on attempt 1. Retrying once...');
  } catch (err) {
    console.warn('[LLM] Attempt 1 failed:', err.message);
  }

  // Attempt 2 (Retry once on failure as required)
  try {
    const retryResult = await callExternalLlm(provider, apiKey, model, questionText, answerText);
    if (validateFeedbackSchema(retryResult)) {
      return retryResult;
    }
  } catch (retryErr) {
    console.warn('[LLM] Attempt 2 retry failed:', retryErr.message);
  }

  // Graceful fallback to guaranteed valid schema heuristic evaluation
  console.log('[LLM] Falling back to intelligent heuristic evaluation.');
  return generateHeuristicFeedback(questionText, answerText);
}

module.exports = {
  evaluateInterviewAnswer,
  generateHeuristicFeedback,
  validateFeedbackSchema
};
