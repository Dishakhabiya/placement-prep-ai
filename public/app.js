/**
 * PrepAI - AI Interview Coach
 * Frontend logic: Speech Recognition, Avatar State Machine, SSE Streaming,
 * Audio synthesis, History management, and responsive micro-interactions.
 */

(function () {
  'use strict';

  // DOM Elements
  const $ = id => document.getElementById(id);
  const app = $('app');
  const face = $('face');
  const live = $('live');
  const list = $('list');
  const qbox = $('qbox');
  const h1 = $('h1');
  const fb = $('fb');
  const mic = $('mic');
  const inp = $('inp');
  const send = $('send');
  const ti = $('ti');
  const dice = $('dice');
  const toast = $('toast');
  const statusLabel = $('st');
  const rtPill = $('rt-pill');
  const rtActions = $('rt-actions');
  const btnRetry = $('btn-retry-q');
  const btnNext = $('btn-next-q');
  const historyBadge = $('history-badge');
  const btnHistoryToggle = $('btn-history-toggle');
  const historyModal = $('history-modal');
  const historyList = $('history-list');
  const btnCloseHistory = $('btn-close-history');
  const btnCloseHistoryBottom = $('btn-close-history-bottom');
  const btnClearHistory = $('btn-clear-history');
  const btnTtsToggle = $('btn-tts-toggle');
  const ttsIcon = $('tts-icon');
  const speechNotice = $('speech-support-notice');

  // State definitions
  const STATES = {
    IDLE: 'idle',
    LISTENING: 'listening',
    THINKING: 'thinking',
    ANSWERING: 'answering',
    DONE: 'done'
  };

  const FACES = {
    idle: '😊',
    listening: '🎧',
    thinking: '🤔',
    answering: '🗣️',
    done: '🎉'
  };

  const SATELLITES = {
    idle: ['⭐', '💡', '✨'],
    listening: ['🎵', '🎶', '🎵'],
    thinking: ['💭', '💭', '💭'],
    answering: ['💬', '💬', '💬'],
    done: ['⭐', '💡', '✨']
  };

  const LABELS = {
    idle: 'Ready',
    listening: 'Listening…',
    thinking: 'Thinking…',
    answering: 'Coach is answering',
    done: 'Done'
  };

  // Internal state
  let currentState = STATES.IDLE;
  let questions = [];
  let currentQuestion = null;
  let recognition = null;
  let isSpeechSupported = false;
  let speechTranscript = '';
  let timers = [];
  let typingTimer = null;
  let toastTimer = null;
  let ttsEnabled = localStorage.getItem('prepai_tts') === 'true';

  // Helper timers
  const later = (fn, ms) => {
    const t = setTimeout(fn, ms);
    timers.push(t);
    return t;
  };

  const clearTimers = () => {
    timers.forEach(clearTimeout);
    timers = [];
  };

  // Toast notifications
  function showToast(message, isError = false) {
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast show' + (isError ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  }

  // ==========================================================================
  // Avatar & App State Machine
  // ==========================================================================
  function setState(state) {
    currentState = state;
    app.className = 'app s-' + state;
    if (statusLabel) statusLabel.textContent = LABELS[state] || 'Ready';
    if (rtPill) rtPill.textContent = state.toUpperCase();

    // Emoji face swap
    if (face) {
      face.textContent = FACES[state] || '😊';
      face.classList.remove('swap');
      void face.offsetWidth;
      face.classList.add('swap');
    }

    // Satellites
    const sats = SATELLITES[state] || SATELLITES.idle;
    ['s1', 's2', 's3'].forEach((id, i) => {
      const el = $(id);
      if (el) el.textContent = sats[i] || '✨';
    });
  }

  // ==========================================================================
  // Web Speech API Initialization
  // ==========================================================================
  function initSpeechRecognition() {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      isSpeechSupported = false;
      if (speechNotice) speechNotice.style.display = 'flex';
      if (mic) {
        mic.title = 'Speech recognition not supported in this browser';
        mic.style.opacity = '0.6';
      }
      return;
    }

    isSpeechSupported = true;
    try {
      recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        speechTranscript = '';
        renderListeningStage();
      };

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += trans + ' ';
          } else {
            interim += trans;
          }
        }

        speechTranscript = (final + interim).trim();
        const trEl = $('tr');
        if (trEl) {
          trEl.innerHTML = (speechTranscript || 'Listening...') + ' <em>…</em>';
        }
      };

      recognition.onerror = (event) => {
        console.warn('[Speech Error]', event.error);
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          showToast('Mic access denied. Please allow microphone permissions or type below.', true);
        } else if (event.error === 'no-speech') {
          showToast('No speech detected. Speak closer to the mic or type your answer.', false);
        } else {
          showToast(`Speech error: ${event.error}. You can also type below.`, true);
        }
        stopListening(false);
      };

      recognition.onend = () => {
        if (currentState === STATES.LISTENING) {
          if (speechTranscript && speechTranscript.trim().length >= 3) {
            submitAnswer(speechTranscript.trim());
          } else {
            resetToIdle('No speech was captured. Please try speaking again or type your answer.');
          }
        }
      };
    } catch (e) {
      console.error('[Speech Init Error]', e);
      isSpeechSupported = false;
    }
  }

  // Start speech listening
  function startListening() {
    clearTimers();
    speechTranscript = '';
    setState(STATES.LISTENING);

    if (recognition) {
      try {
        recognition.start();
      } catch (err) {
        // Recognition might already be running
        console.warn('Recognition start error:', err);
      }
    } else {
      // Fallback simulation for testing environments without speech hardware
      renderListeningStage();
      const mockWords = "I'm a software engineer passionate about scalable systems. Recently I led an API migration that reduced checkout latency by 35%.".split(' ');
      let idx = 0;
      const simulate = () => {
        if (currentState !== STATES.LISTENING) return;
        if (idx < mockWords.length) {
          speechTranscript = mockWords.slice(0, ++idx).join(' ');
          const trEl = $('tr');
          if (trEl) trEl.innerHTML = speechTranscript + ' <em>…</em>';
          later(simulate, 170);
        } else {
          later(() => submitAnswer(speechTranscript), 700);
        }
      };
      later(simulate, 200);
    }
  }

  // Stop listening
  function stopListening(submit = true) {
    if (recognition) {
      try {
        recognition.stop();
      } catch (e) {}
    }

    if (submit && speechTranscript && speechTranscript.trim().length >= 3) {
      submitAnswer(speechTranscript.trim());
    } else if (submit && (!speechTranscript || speechTranscript.trim().length < 3)) {
      resetToIdle('Answer was too brief. Tap mic again or type your response below.');
    } else {
      resetToIdle();
    }
  }

  // Render live waveform & transcript container
  function renderListeningStage() {
    const waveBars = Array.from({ length: 31 }, (_, i) => {
      const height = Math.round(16 + Math.abs(Math.sin(i * 1.15)) * 48);
      const delay = (i * 0.04).toFixed(2);
      return `<span style="--h:${height}px; animation-delay:${delay}s"></span>`;
    }).join('');

    live.innerHTML = `
      <div class="wave" aria-label="Audio waveform">${waveBars}</div>
      <div class="tr" id="tr"><em>Listening carefully… speak your answer out loud</em></div>
    `;
  }

  // ==========================================================================
  // Submitting Answers & AI Feedback
  // ==========================================================================
  async function submitAnswer(answerText) {
    clearTimers();
    if (!answerText || answerText.trim().length < 3) {
      showToast('Please provide a complete answer before submitting.', true);
      return;
    }

    const trimmed = answerText.trim();
    setState(STATES.THINKING);

    // Show rotating thinking status messages
    const thinkingMessages = [
      'Reading your response…',
      'Checking structure & STAR format…',
      'Evaluating clarity & impact…',
      'Formulating actionable tips…'
    ];

    live.innerHTML = `
      <div class="dots" aria-label="Thinking indicator">
        <span></span><span></span><span></span>
      </div>
      <div class="step" id="step">${thinkingMessages[0]}</div>
    `;

    thinkingMessages.forEach((msg, i) => {
      later(() => {
        const stepEl = $('step');
        if (stepEl && currentState === STATES.THINKING) {
          stepEl.textContent = msg;
        }
      }, i * 650);
    });

    const activeQ = currentQuestion || {
      id: 'q1',
      question: qbox.textContent || 'Tell me about yourself.',
      category: 'General'
    };

    // Attempt SSE streaming first, falling back to standard POST
    try {
      const useStreaming = true; // Streaming requested in feature 5

      if (useStreaming && typeof EventSource !== 'undefined') {
        streamFeedback(activeQ, trimmed);
      } else {
        await postFeedback(activeQ, trimmed);
      }
    } catch (err) {
      console.error('[Feedback Submission Error]', err);
      showToast('Network error analyzing answer. Trying fallback…', true);
      await postFeedback(activeQ, trimmed);
    }
  }

  // Server-Sent Events (SSE) Streaming
  function streamFeedback(questionObj, answerText) {
    const streamUrl = `/api/feedback/stream?questionId=${encodeURIComponent(questionObj.id)}&answer=${encodeURIComponent(answerText)}`;
    const eventSource = new EventSource(streamUrl);
    let streamedText = '';
    let completedData = null;

    eventSource.addEventListener('chunk', (e) => {
      if (currentState !== STATES.ANSWERING) {
        setState(STATES.ANSWERING);
        live.innerHTML = `
          <div class="ans">
            <div class="ans-header"><span>🗣️</span> Coach Feedback</div>
            <span id="at"></span><span class="caret"></span>
          </div>
        `;
      }
      try {
        const data = JSON.parse(e.data);
        streamedText += data.text || '';
        const atEl = $('at');
        if (atEl) atEl.textContent = streamedText;
      } catch (err) {}
    });

    eventSource.addEventListener('complete', (e) => {
      try {
        completedData = JSON.parse(e.data);
      } catch (err) {}
      eventSource.close();
      const caret = document.querySelector('.caret');
      if (caret) caret.remove();

      if (completedData) {
        finishFeedbackFlow(completedData);
      } else {
        finishFeedbackFlow({
          coach_reply: streamedText,
          scores: questionObj.defaultScores || [{ label: 'Overall', value: 80 }],
          tips: questionObj.defaultTips || ['Keep practising!']
        });
      }
    });

    eventSource.addEventListener('error', () => {
      eventSource.close();
      // If error occurs before completing, fallback to POST
      if (!completedData && !streamedText) {
        postFeedback(questionObj, answerText);
      }
    });
  }

  // Standard POST fallback
  async function postFeedback(questionObj, answerText) {
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: questionObj.id,
          question: questionObj.question,
          answer: answerText
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Network error occurred');
      }

      const data = await response.json();
      animateCoachAnswer(data);
    } catch (err) {
      console.error('[POST Feedback Error]', err);
      showToast(err.message || 'Error getting feedback', true);
      resetToIdle();
    }
  }

  // Typewriter animation when streaming is simulated or delivered via POST
  function animateCoachAnswer(data) {
    setState(STATES.ANSWERING);
    live.innerHTML = `
      <div class="ans">
        <div class="ans-header"><span>🗣️</span> Coach Feedback</div>
        <span id="at"></span><span class="caret"></span>
      </div>
    `;

    const text = data.coach_reply || '';
    let charIdx = 0;

    function step() {
      if (currentState !== STATES.ANSWERING) return;
      if (charIdx < text.length) {
        charIdx += 2;
        const atEl = $('at');
        if (atEl) atEl.textContent = text.slice(0, charIdx);
        later(step, 18);
      } else {
        const caret = document.querySelector('.caret');
        if (caret) caret.remove();
        finishFeedbackFlow(data);
      }
    }
    step();
  }

  // Completion sequence: Done state, Confetti, Counting score bars, Tip chips, and TTS Voice
  function finishFeedbackFlow(data) {
    setState(STATES.DONE);
    triggerConfetti();

    // Render Right Panel with Score Bars and Tips
    const scores = data.scores || [];
    const tips = data.tips || [];

    const colorClasses = ['', 'y', 'o']; // mint, yellow, orange
    const scoresHtml = scores.map((s, i) => `
      <div class="m">
        <div>
          <span>${s.label}</span>
          <b class="n" data-target="${s.value}">0%</b>
        </div>
        <div class="bar ${colorClasses[i % colorClasses.length]}">
          <i data-w="${s.value}"></i>
        </div>
      </div>
    `).join('');

    const tipsHtml = tips.length ? `
      <div class="chips-title">Actionable Tips</div>
      <div class="chips">
        ${tips.map((tip, i) => `
          <span class="chip" style="animation-delay: ${0.5 + i * 0.14}s">✓ ${tip}</span>
        `).join('')}
      </div>
    ` : '';

    fb.className = '';
    fb.innerHTML = scoresHtml + tipsHtml;
    if (rtActions) rtActions.style.display = 'flex';

    // Animate score counters and bars counting up smoothly
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.querySelectorAll('.bar i').forEach((barEl, i) => {
          const targetVal = parseInt(barEl.dataset.w, 10) || 0;
          barEl.style.width = targetVal + '%';

          const numberEl = document.querySelectorAll('.m .n')[i];
          if (!numberEl) return;

          let count = 0;
          const interval = setInterval(() => {
            count += 2;
            if (count >= targetVal) {
              count = targetVal;
              clearInterval(interval);
            }
            numberEl.textContent = count + '%';
          }, 20);
        });
      });
    });

    // Optional TTS read aloud
    if (ttsEnabled && data.coach_reply && window.speechSynthesis) {
      speakCoachReply(data.coach_reply);
    }

    // Refresh history counter
    loadHistoryCount();

    // Auto-transition back to idle after review time
    later(() => {
      if (currentState === STATES.DONE) {
        setState(STATES.IDLE);
      }
    }, 6000);
  }

  // ==========================================================================
  // Confetti Particle Explosion
  // ==========================================================================
  function triggerConfetti() {
    if (!face) return;
    const rect = face.getBoundingClientRect();
    const emojis = ['🎉', '⭐', '✨', '🎊', '💫', '🌟'];

    for (let i = 0; i < 24; i++) {
      const confEl = document.createElement('div');
      confEl.className = 'conf';
      confEl.textContent = emojis[i % emojis.length];
      confEl.style.left = (rect.left + rect.width / 2) + 'px';
      confEl.style.top = (rect.top + rect.height / 2) + 'px';
      confEl.style.setProperty('--x', (Math.random() * 520 - 260) + 'px');
      confEl.style.setProperty('--y', (Math.random() * -320 - 50) + 'px');
      confEl.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
      document.body.appendChild(confEl);

      setTimeout(() => {
        confEl.remove();
      }, 2200);
    }
  }

  // ==========================================================================
  // Text-to-Speech (TTS) Browser SpeechSynthesis
  // ==========================================================================
  function speakCoachReply(text) {
    if (!window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('[TTS Error]', e);
    }
  }

  function toggleTts() {
    ttsEnabled = !ttsEnabled;
    localStorage.setItem('prepai_tts', ttsEnabled);
    if (ttsIcon) ttsIcon.textContent = ttsEnabled ? '🔊' : '🔇';
    showToast(ttsEnabled ? 'Coach voice read aloud enabled' : 'Coach voice muted');
    if (!ttsEnabled && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  // ==========================================================================
  // Question Picking & UI Population
  // ==========================================================================
  function selectQuestion(qItem) {
    clearTimers();
    currentQuestion = qItem;

    // Highlight sidebar active item
    document.querySelectorAll('.qi').forEach(b => {
      b.classList.toggle('on', b.dataset.id === qItem.id);
    });

    if (qbox) qbox.textContent = qItem.question;
    if (h1) h1.textContent = 'Your turn';

    // Reset feedback panel to placeholder
    if (fb) {
      fb.className = 'empty';
      fb.innerHTML = 'Answer this question and your scores will fill in here. 📈';
    }
    if (rtActions) rtActions.style.display = 'none';

    // Reset live interaction area
    live.innerHTML = '<div class="tr"><em>Tap the mic and answer out loud, or type below.</em></div>';
    // Ensure avatar displays the idle smiling face emoji 😊 per state machine
    setState(STATES.IDLE);
  }

  function resetToIdle(customHint) {
    clearTimers();
    setState(STATES.IDLE);
    if (live) {
      live.innerHTML = `<div class="tr"><em>${customHint || 'Tap the mic and answer out loud, or type below.'}</em></div>`;
    }
  }

  // Surprise Me / Random Question
  async function pickRandomQuestion() {
    if (dice) {
      dice.classList.remove('roll');
      void dice.offsetWidth;
      dice.classList.add('roll');
    }

    try {
      const res = await fetch('/api/questions/random');
      if (res.ok) {
        const randomQ = await res.json();
        selectQuestion(randomQ);
        showToast(`Random picked: “${randomQ.question}”`);
        return;
      }
    } catch (e) {}

    // Fallback if offline
    if (questions.length) {
      const randomIndex = Math.floor(Math.random() * questions.length);
      selectQuestion(questions[randomIndex]);
    }
  }

  // Fetch Questions from API
  async function loadQuestions() {
    try {
      const res = await fetch('/api/questions');
      if (res.ok) {
        questions = await res.json();
      }
    } catch (e) {
      console.warn('Questions API unavailable, using defaults');
    }

    // Default questions if network failure
    if (!questions || !questions.length) {
      questions = [
        { id: 'q1', emoji: '👤', category: 'Intro', question: 'Tell me about yourself.' },
        { id: 'q2', emoji: '💪', category: 'Self-awareness', question: 'What are your biggest strengths and weaknesses?' },
        { id: 'q3', emoji: '🤝', category: 'Behavioural', question: 'Describe a time you handled conflict at work.' },
        { id: 'q4', emoji: '🚀', category: 'Motivation', question: 'Why do you want to work here?' }
      ];
    }

    renderQuestionList();
    if (questions.length) {
      selectQuestion(questions[0]);
    }
  }

  function renderQuestionList() {
    if (!list) return;
    list.innerHTML = questions.map((q, i) => `
      <button class="qi ${i === 0 ? 'on' : ''}" data-id="${q.id}" aria-label="Question ${i + 1}: ${q.question}">
        <span class="e">${q.emoji || '📌'}</span>
        <span>
          <b>${q.question}</b>
          <small>${q.category || 'Interview'}</small>
        </span>
      </button>
    `).join('');

    document.querySelectorAll('.qi').forEach(b => {
      b.onclick = () => {
        const found = questions.find(q => q.id === b.dataset.id);
        if (found) selectQuestion(found);
      };
    });

    const countEl = $('q-count');
    if (countEl) countEl.textContent = `${questions.length} questions`;
  }

  // ==========================================================================
  // Practice History Modal & API
  // ==========================================================================
  async function loadHistoryCount() {
    try {
      const res = await fetch('/api/history?limit=100');
      if (res.ok) {
        const items = await res.json();
        if (historyBadge) historyBadge.textContent = items.length;
      }
    } catch (e) {}
  }

  async function openHistoryModal() {
    if (!historyModal) return;
    historyModal.classList.add('open');
    historyModal.setAttribute('aria-hidden', 'false');

    if (historyList) {
      historyList.innerHTML = '<div class="empty-history">Loading practice history…</div>';
    }

    try {
      const res = await fetch('/api/history');
      if (!res.ok) throw new Error('Failed to load history');
      const items = await res.json();

      if (!items || !items.length) {
        historyList.innerHTML = '<div class="empty-history">No practice sessions yet. Start your first answer! 🚀</div>';
        return;
      }

      historyList.innerHTML = items.map(item => {
        const formattedDate = new Date(item.created_at).toLocaleDateString(undefined, {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        const scores = Array.isArray(item.scores) ? item.scores : [];

        return `
          <div class="history-card" data-id="${item.id}">
            <div class="history-card-top">
              <div class="history-q">${item.question}</div>
              <div class="history-date">${formattedDate}</div>
            </div>
            <div class="history-ans">“${item.answer}”</div>
            <div class="history-scores-preview">
              ${scores.map(s => `<span class="score-pill">${s.label}: ${s.value}%</span>`).join('')}
            </div>
            <div style="font-size: 13.5px; color: var(--cream); opacity: 0.9; margin-top: 4px;">
              <b>Coach:</b> ${item.coach_reply}
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      if (historyList) {
        historyList.innerHTML = '<div class="empty-history">Unable to load history. Please try again.</div>';
      }
    }
  }

  function closeHistoryModal() {
    if (!historyModal) return;
    historyModal.classList.remove('open');
    historyModal.setAttribute('aria-hidden', 'true');
  }

  async function handleClearHistory() {
    if (!confirm('Are you sure you want to clear your practice history?')) return;
    try {
      const res = await fetch('/api/history', { method: 'DELETE' });
      if (res.ok) {
        showToast('Practice history cleared.');
        if (historyBadge) historyBadge.textContent = '0';
        if (historyList) {
          historyList.innerHTML = '<div class="empty-history">No practice sessions yet. Start your first answer! 🚀</div>';
        }
      }
    } catch (e) {
      showToast('Failed to clear history', true);
    }
  }

  // ==========================================================================
  // Event Bindings
  // ==========================================================================
  function setupEventListeners() {
    // Mic button toggle
    if (mic) {
      mic.onclick = () => {
        if (currentState === STATES.LISTENING) {
          stopListening(true);
        } else if (currentState === STATES.IDLE || currentState === STATES.DONE || currentState === STATES.ANSWERING) {
          startListening();
        }
      };
    }

    // Typed input bar & typing indicator
    if (inp) {
      inp.oninput = () => {
        if (ti) ti.classList.add('on');
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
          if (ti) ti.classList.remove('on');
        }, 900);
      };

      inp.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitTypedAnswer();
        }
      };
    }

    // Send button
    if (send) {
      send.onclick = () => {
        submitTypedAnswer();
      };
    }

    function submitTypedAnswer() {
      if (!inp) return;
      const val = inp.value.trim();
      if (!val) {
        showToast('Please type an answer first.', true);
        return;
      }
      inp.value = '';
      if (ti) ti.classList.remove('on');
      submitAnswer(val);
    }

    // Surprise Me dice
    if (dice) {
      dice.onclick = pickRandomQuestion;
    }

    // Retry Question & Next Question buttons
    if (btnRetry) {
      btnRetry.onclick = () => {
        if (currentQuestion) selectQuestion(currentQuestion);
      };
    }
    if (btnNext) {
      btnNext.onclick = pickRandomQuestion;
    }

    // History modal
    if (btnHistoryToggle) btnHistoryToggle.onclick = openHistoryModal;
    if (btnCloseHistory) btnCloseHistory.onclick = closeHistoryModal;
    if (btnCloseHistoryBottom) btnCloseHistoryBottom.onclick = closeHistoryModal;
    if (btnClearHistory) btnClearHistory.onclick = handleClearHistory;
    if (historyModal) {
      historyModal.onclick = (e) => {
        if (e.target === historyModal) closeHistoryModal();
      };
    }

    // TTS toggle
    if (btnTtsToggle) {
      btnTtsToggle.onclick = toggleTts;
      if (ttsIcon) ttsIcon.textContent = ttsEnabled ? '🔊' : '🔇';
    }

    // Keyboard navigation (ESC closes modal)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && historyModal && historyModal.classList.contains('open')) {
        closeHistoryModal();
      }
    });
  }

  // ==========================================================================
  // App Bootstrapping
  // ==========================================================================
  function bootstrap() {
    initSpeechRecognition();
    setupEventListeners();
    loadQuestions();
    loadHistoryCount();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

})();
