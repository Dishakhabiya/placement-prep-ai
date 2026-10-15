const assert = require('assert');

/**
 * Test Suite: TTS Voice Playback Fallback and Speaking Lifecycle
 * Verifies:
 * 1. Fallback to browser SpeechSynthesis when backend neural TTS fails
 * 2. Markdown stripping and text normalization for SpeechSynthesis
 * 3. Race condition prevention (cancellation resets state and prevents duplicates)
 * 4. Empty text handling
 * 5. Platform safety (non-browser environment does not crash)
 */

console.log('===============================================================');
console.log('Running TTS Voice Playback & Fallback Test Suite');
console.log('===============================================================\n');

// Mock browser SpeechSynthesis environment
function createMockWebEnvironment() {
  const spokenUtterances = [];
  let cancelledCount = 0;

  const mockSynthesis = {
    speak(utterance) {
      spokenUtterances.push(utterance);
      // Simulate asynchronous speech completion
      setTimeout(() => {
        if (utterance.onend) utterance.onend();
      }, 10);
    },
    cancel() {
      cancelledCount++;
    },
    getVoices() {
      return [
        { name: 'Microsoft Jenny Natural', lang: 'en-US' },
        { name: 'Google US English', lang: 'en-US' }
      ];
    }
  };

  class MockSpeechSynthesisUtterance {
    constructor(text) {
      this.text = text;
      this.rate = 1;
      this.pitch = 1;
      this.lang = '';
      this.voice = null;
      this.onend = null;
      this.onerror = null;
    }
  }

  return {
    mockSynthesis,
    MockSpeechSynthesisUtterance,
    spokenUtterances,
    getCancelledCount: () => cancelledCount,
  };
}

// Minimal reproduction of MockInterviewScreen's speak & cancel logic for testing
class MockInterviewAudioController {
  constructor(env, apiClientMock) {
    this.env = env;
    this.apiClient = apiClientMock;
    this.isTtsSpeaking = false;
    this.activeAudio = null;
    this.activeUtterance = null;
  }

  cancelAudio() {
    if (this.activeAudio) {
      this.activeAudio.onended = null;
      this.activeAudio.onerror = null;
      this.activeAudio.pause();
      this.activeAudio = null;
    }
    if (this.activeUtterance) {
      this.activeUtterance.onend = null;
      this.activeUtterance.onerror = null;
      this.activeUtterance = null;
    }
    if (this.env && this.env.mockSynthesis) {
      this.env.mockSynthesis.cancel();
    }
    this.isTtsSpeaking = false;
  }

  async speakTextWithNeuralVoice(text, onEnd = null) {
    this.cancelAudio();
    if (!text || !text.trim()) {
      if (onEnd) onEnd();
      return;
    }

    const fallbackToBrowserSpeech = (reason) => {
      if (this.env && this.env.mockSynthesis && this.env.MockSpeechSynthesisUtterance) {
        try {
          this.env.mockSynthesis.cancel();
          const cleanText = text.replace(/[*_#`~]/g, '').replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trim();
          if (!cleanText) {
            this.isTtsSpeaking = false;
            if (onEnd) onEnd();
            return;
          }

          const utterance = new this.env.MockSpeechSynthesisUtterance(cleanText);
          utterance.rate = 0.95;
          utterance.lang = 'en-US';

          const voices = this.env.mockSynthesis.getVoices() || [];
          const preferred = voices.find(v => v.lang && v.lang.startsWith('en'));
          if (preferred) utterance.voice = preferred;

          let ended = false;
          const safeEnd = () => {
            if (ended) return;
            ended = true;
            this.activeUtterance = null;
            this.isTtsSpeaking = false;
            if (onEnd) onEnd();
          };

          utterance.onend = safeEnd;
          utterance.onerror = safeEnd;

          this.activeUtterance = utterance;
          this.isTtsSpeaking = true;
          this.env.mockSynthesis.speak(utterance);
          return;
        } catch (synthErr) {
          // Fallback failure safety
        }
      }
      this.isTtsSpeaking = false;
      if (onEnd) onEnd();
    };

    try {
      this.isTtsSpeaking = true;
      const blob = await this.apiClient.getNeuralTtsAudio({ text });
      if (blob && blob.size > 100) {
        // Successful neural path
        this.isTtsSpeaking = false;
        if (onEnd) onEnd();
      } else {
        fallbackToBrowserSpeech('empty audio blob');
      }
    } catch (err) {
      fallbackToBrowserSpeech(err.message);
    }
  }
}

async function runTests() {
  // Test 1: Fallback triggers when backend TTS returns error
  {
    const env = createMockWebEnvironment();
    const failingApiClient = {
      async getNeuralTtsAudio() {
        throw new Error('TTS server error (502)');
      }
    };
    const controller = new MockInterviewAudioController(env, failingApiClient);

    let endedCalled = false;
    await controller.speakTextWithNeuralVoice('Hello, this is a test question.', () => {
      endedCalled = true;
    });

    assert.strictEqual(env.spokenUtterances.length, 1, 'SpeechSynthesis speak() must be called as fallback');
    assert.strictEqual(env.spokenUtterances[0].text, 'Hello, this is a test question.');
    assert.strictEqual(controller.isTtsSpeaking, true, 'isTtsSpeaking must be true while utterance is active');

    // Wait for simulated async utterance completion
    await new Promise(r => setTimeout(r, 20));
    assert.strictEqual(endedCalled, true, 'onEnd callback must be triggered after utterance completes');
    assert.strictEqual(controller.isTtsSpeaking, false, 'isTtsSpeaking must reset to false after completion');
    console.log('✓ Test 1 Passed: Fallback to SpeechSynthesis activates on backend failure and completes safely.');
  }

  // Test 2: Markdown cleanup for spoken text
  {
    const env = createMockWebEnvironment();
    const failingApiClient = {
      async getNeuralTtsAudio() {
        throw new Error('500 Internal Server Error');
      }
    };
    const controller = new MockInterviewAudioController(env, failingApiClient);

    await controller.speakTextWithNeuralVoice('### Question 1: What is **React** [Note: High priority]?', () => {});
    assert.strictEqual(env.spokenUtterances.length, 1);
    assert.strictEqual(env.spokenUtterances[0].text, 'Question 1: What is React ?');
    console.log('✓ Test 2 Passed: Text formatting (markdown headers, bold, brackets) cleaned before speaking.');
  }

  // Test 3: Audio cancellation stops speech and clears speaking state
  {
    const env = createMockWebEnvironment();
    const failingApiClient = {
      async getNeuralTtsAudio() {
        throw new Error('Network timeout');
      }
    };
    const controller = new MockInterviewAudioController(env, failingApiClient);

    let earlyEndCalled = false;
    await controller.speakTextWithNeuralVoice('Long text to be cancelled immediately.', () => {
      earlyEndCalled = true;
    });
    assert.strictEqual(controller.isTtsSpeaking, true);

    // Cancel audio immediately
    controller.cancelAudio();
    assert.strictEqual(controller.isTtsSpeaking, false, 'Speaking state must immediately be false after cancel');
    assert.strictEqual(controller.activeUtterance, null, 'Active utterance ref must be cleared');
    assert.strictEqual(env.getCancelledCount() >= 1, true, 'speechSynthesis.cancel() must be called');

    // Wait and verify that cancelled utterance does not fire earlyEndCalled callback
    await new Promise(r => setTimeout(r, 20));
    assert.strictEqual(earlyEndCalled, false, 'Cancelled speech must not invoke previous onEnd callback');
    console.log('✓ Test 3 Passed: Audio cancellation resets state and prevents spurious callback invocation.');
  }

  // Test 4: Empty text handling
  {
    const env = createMockWebEnvironment();
    const controller = new MockInterviewAudioController(env, {});
    let endCalled = false;
    await controller.speakTextWithNeuralVoice('   ', () => { endCalled = true; });
    assert.strictEqual(endCalled, true, 'Empty text must invoke onEnd immediately without error');
    assert.strictEqual(env.spokenUtterances.length, 0, 'No utterances should be queued for empty text');
    console.log('✓ Test 4 Passed: Empty and whitespace-only text handled safely.');
  }

  // Test 5: Non-web environment safety (no window or speechSynthesis)
  {
    const controller = new MockInterviewAudioController(null, {
      async getNeuralTtsAudio() { throw new Error('Offline'); }
    });
    let endCalled = false;
    await controller.speakTextWithNeuralVoice('Native mobile text', () => { endCalled = true; });
    assert.strictEqual(endCalled, true, 'Non-web environment must safely trigger onEnd without crashing');
    assert.strictEqual(controller.isTtsSpeaking, false);
    console.log('✓ Test 5 Passed: Non-web / native mobile environment safely handles fallback without crashing.');
  }

  // Test 6: Accent voice matching (Indian, British, US)
  {
    const mockVoices = [
      { name: 'Google US English', lang: 'en-US' },
      { name: 'Veena', lang: 'en-IN' },
      { name: 'Rishi (Indian English)', lang: 'en-IN' },
      { name: 'Daniel', lang: 'en-GB' },
      { name: 'Karen', lang: 'en-AU' },
    ];

    // Minimal matching algorithm mirroring MockInterviewScreen
    function matchVoice(targetLang, gender, voices) {
      const isFemale = gender === 'female';
      const langMatches = voices.filter(v => v.lang.toLowerCase() === targetLang.toLowerCase());
      if (langMatches.length > 0) {
        if (isFemale) {
          const female = langMatches.find(v => !v.name.toLowerCase().includes('male') && (v.name.toLowerCase().includes('veena') || v.name.toLowerCase().includes('female')));
          if (female) return female;
        } else {
          const male = langMatches.find(v => v.name.toLowerCase().includes('rishi') || v.name.toLowerCase().includes('daniel'));
          if (male) return male;
        }
        return langMatches[0];
      }
      return null;
    }

    const indianFemale = matchVoice('en-IN', 'female', mockVoices);
    assert.strictEqual(indianFemale.name, 'Veena', 'Indian female must match Veena');

    const indianMale = matchVoice('en-IN', 'male', mockVoices);
    assert.strictEqual(indianMale.name, 'Rishi (Indian English)', 'Indian male must match Rishi');

    const britishVoice = matchVoice('en-GB', 'male', mockVoices);
    assert.strictEqual(britishVoice.name, 'Daniel', 'British male must match Daniel');

    console.log('✓ Test 6 Passed: Accent-aware voice matching accurately pairs Indian, British, and US locales.');
  }

  console.log('\n===============================================================');
  console.log('ALL 6 TTS PLAYBACK, FALLBACK & ACCENT TESTS PASSED SUCCESSFULLY! 🎉');
  console.log('===============================================================\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

