/**
 * Thought Trail - Interactive Goal Journey Prototype
 * Features:
 * - SVG path-following runner using getPointAtLength() with tangent orientation
 * - 8 distinct character animation states with multi-part articulated SVG rigging
 * - Dual-route branching at Review obstacle (Clear & Retry vs. Scenic Detour)
 * - Deterministic, offline-first execution with safe monotonic cancellation
 * - Canvas confetti physics and contextual goal story generation
 */

class ThoughtTrail {
  constructor() {
    this.runId = 0;
    this.animationFrameId = null;
    this.timerIds = [];

    // State machine
    this.currentState = 'idle'; // idle | running | checkpoint | obstacle | retry | detour | failure | celebration
    this.currentGoal = 'Plan my study week';
    this.speedMultiplier = 1.0;
    this.reducedMotion = false;
    this.chosenRoute = null; // 'clear' | 'detour'

    // Character position & mechanics
    this.runnerPos = { x: 90, y: 560 };
    this.facing = 1; // 1 = right, -1 = left
    this.charAnimTime = 0;

    // DOM references
    this.initDomReferences();
    this.initConfetti();
    this.bindEvents();

    // Check system preference for reduced motion
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.setReducedMotion(true);
    }

    // Initialize in Idle state at trailhead
    this.setIdleState();
    this.startGlobalIdleLoop();
  }

  initDomReferences() {
    this.svg = document.getElementById('world-svg');
    this.runner = document.getElementById('runner-character');
    this.charRig = document.getElementById('char-rig');
    this.charShadow = document.getElementById('char-shadow');
    this.charTorso = document.getElementById('char-torso');
    this.charHead = document.getElementById('char-head');
    this.charLegL = document.getElementById('char-leg-l');
    this.charLegR = document.getElementById('char-leg-r');
    this.charArmL = document.getElementById('char-arm-l');
    this.charArmR = document.getElementById('char-arm-r');
    this.charScarf = document.getElementById('char-scarf');
    this.charEmote = document.getElementById('char-emote');
    this.dustContainer = document.getElementById('dust-container');

    // Face elements
    this.eyesNormal = document.getElementById('eyes-normal');
    this.eyesSurprised = document.getElementById('eyes-surprised');
    this.eyesJoy = document.getElementById('eyes-joy');
    this.mouthSmile = document.getElementById('mouth-smile');
    this.mouthOpen = document.getElementById('mouth-open');
    this.mouthGrimace = document.getElementById('mouth-grimace');

    // Emotes
    this.emotes = {
      idea: document.getElementById('icon-idea'),
      quill: document.getElementById('icon-quill'),
      alert: document.getElementById('icon-alert'),
      wrench: document.getElementById('icon-wrench'),
      compass: document.getElementById('icon-compass'),
      uncertain: document.getElementById('icon-uncertain'),
      trophy: document.getElementById('icon-trophy'),
    };

    // Paths
    this.pathMain1 = document.getElementById('trail-main-1');
    this.pathCleared = document.getElementById('trail-cleared');
    this.pathDetour = document.getElementById('trail-detour');
    this.trailGlow = document.getElementById('trail-progress-glow');
    this.obstacleGroup = document.getElementById('obstacle-group');

    // HUD / Modals
    this.goalInput = document.getElementById('goal-input');
    this.goalForm = document.getElementById('goal-form');
    this.narrativeCard = document.getElementById('narrative-card');
    this.narrativeBadge = document.getElementById('narrative-badge');
    this.narrativeTitle = document.getElementById('narrative-title');
    this.narrativeDesc = document.getElementById('narrative-desc');

    this.obstacleModal = document.getElementById('obstacle-modal');
    this.btnChoiceClear = document.getElementById('btn-choice-clear');
    this.btnChoiceDetour = document.getElementById('btn-choice-detour');

    this.victoryModal = document.getElementById('victory-modal');
    this.victoryGoalEcho = document.getElementById('victory-goal-echo');
    this.statRoute = document.getElementById('stat-route');
    this.btnRunAgain = document.getElementById('btn-run-again');
    this.btnCloseVictory = document.getElementById('btn-close-victory');

    this.btnRestart = document.getElementById('btn-restart');
    this.btnSpeed = document.getElementById('btn-speed');
    this.speedLabel = document.getElementById('speed-label');
    this.btnMotionToggle = document.getElementById('btn-motion-toggle');
    this.motionLabel = document.getElementById('motion-label');
    this.activeStateIndicator = document.getElementById('active-state-indicator');

    // Steppers
    this.stepNodes = [
      document.getElementById('step-node-1'),
      document.getElementById('step-node-2'),
      document.getElementById('step-node-3'),
      document.getElementById('step-node-4')
    ];
    this.stepConnectors = [
      document.getElementById('step-conn-1'),
      document.getElementById('step-conn-2'),
      document.getElementById('step-conn-3')
    ];
  }

  bindEvents() {
    // Goal Form Submit
    this.goalForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = this.goalInput.value.trim();
      this.startJourney(val || 'Plan my study week');
    });

    // Quick Example Chips
    document.querySelectorAll('.example-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const goal = chip.getAttribute('data-goal');
        this.goalInput.value = goal;
        this.startJourney(goal);
      });
    });

    // Obstacle choices
    this.btnChoiceClear.addEventListener('click', () => {
      this.closeObstacleModal();
      this.executeObstacleClear();
    });

    this.btnChoiceDetour.addEventListener('click', () => {
      this.closeObstacleModal();
      this.executeObstacleDetour();
    });

    // Restart
    this.btnRestart.addEventListener('click', () => {
      this.restart();
    });

    // Speed Cycle
    this.btnSpeed.addEventListener('click', () => {
      if (this.speedMultiplier === 1.0) {
        this.speedMultiplier = 1.5;
        this.speedLabel.textContent = '1.5x Speed';
      } else if (this.speedMultiplier === 1.5) {
        this.speedMultiplier = 0.75;
        this.speedLabel.textContent = '0.75x Speed';
      } else {
        this.speedMultiplier = 1.0;
        this.speedLabel.textContent = '1.0x Speed';
      }
    });

    // Reduced Motion Toggle
    this.btnMotionToggle.addEventListener('click', () => {
      this.setReducedMotion(!this.reducedMotion);
    });

    // Victory buttons
    this.btnRunAgain.addEventListener('click', () => {
      this.victoryModal.classList.remove('open');
      this.goalInput.focus();
      this.restart();
    });

    this.btnCloseVictory.addEventListener('click', () => {
      this.victoryModal.classList.remove('open');
    });

    // State Inspection Tool Pills (Directly jump to or preview any state)
    document.querySelectorAll('.tool-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const state = btn.getAttribute('data-state');
        this.previewState(state);
      });
    });
  }

  setReducedMotion(enabled) {
    this.reducedMotion = enabled;
    if (enabled) {
      document.body.classList.add('reduced-motion-active');
      this.motionLabel.textContent = 'Motion: Reduced';
    } else {
      document.body.classList.remove('reduced-motion-active');
      this.motionLabel.textContent = 'Motion: Full';
    }
  }

  safeTimeout(fn, ms) {
    const currentRun = this.runId;
    const adjustedMs = ms / this.speedMultiplier;
    const id = setTimeout(() => {
      if (this.runId === currentRun) {
        fn();
      }
    }, adjustedMs);
    this.timerIds.push(id);
    return id;
  }

  clearAllTimers() {
    this.runId++;
    this.timerIds.forEach(id => clearTimeout(id));
    this.timerIds = [];
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  // ================= CHARACTER EXPRESSION & RIGGING =================

  setFace(eyeState = 'normal', mouthState = 'smile') {
    this.eyesNormal.style.display = eyeState === 'normal' ? 'block' : 'none';
    this.eyesSurprised.style.display = eyeState === 'surprised' ? 'block' : 'none';
    this.eyesJoy.style.display = eyeState === 'joy' ? 'block' : 'none';

    this.mouthSmile.style.display = mouthState === 'smile' ? 'block' : 'none';
    this.mouthOpen.style.display = mouthState === 'open' ? 'block' : 'none';
    this.mouthGrimace.style.display = mouthState === 'grimace' ? 'block' : 'none';
  }

  showEmote(emoteType) {
    Object.values(this.emotes).forEach(el => el.style.display = 'none');
    if (emoteType && this.emotes[emoteType]) {
      this.emotes[emoteType].style.display = 'block';
      this.charEmote.classList.add('visible');
    } else {
      this.charEmote.classList.remove('visible');
    }
  }

  hideEmote() {
    this.charEmote.classList.remove('visible');
  }

  setFacing(direction) {
    this.facing = direction >= 0 ? 1 : -1;
    this.charRig.setAttribute('transform', `translate(0, -32) scale(${this.facing * 1.3}, 1.3)`);
  }

  setCharTransform(x, y, angleDeg = 0) {
    this.runnerPos = { x, y };
    this.runner.setAttribute('transform', `translate(${x}, ${y}) rotate(${angleDeg * 0.4})`);
  }

  spawnDustPuff(x, y) {
    if (this.reducedMotion) return;
    const puff = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    puff.setAttribute('cx', -this.facing * 12);
    puff.setAttribute('cy', 2);
    puff.setAttribute('r', (Math.random() * 2 + 2.5).toFixed(1));
    puff.setAttribute('fill', '#d3b692');
    puff.setAttribute('class', 'dust-particle');
    this.dustContainer.appendChild(puff);
    setTimeout(() => {
      if (puff.parentNode) puff.parentNode.removeChild(puff);
    }, 650);
  }

  // ================= ANIMATION STATES =================

  updateStateLabel(stateName) {
    this.currentState = stateName;
    const names = {
      idle: '1. Idle (Breathing & Looking)',
      running: '2. Running (Striding Trail)',
      checkpoint: '3. Checkpoint Arrival',
      obstacle: '4. Obstacle Encounter',
      retry: '5. Retry & Clear Obstacle',
      detour: '6. Scenic Detour Path',
      failure: '7. Uncertainty & Pause',
      celebration: '8. Finish Celebration'
    };
    this.activeStateIndicator.textContent = names[stateName] || stateName;

    // Highlight active pill
    document.querySelectorAll('.tool-pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-state') === stateName);
    });
  }

  // State 1: Idle
  setIdleState() {
    this.updateStateLabel('idle');
    this.setFace('normal', 'smile');
    this.hideEmote();
    this.charRig.setAttribute('transform', `translate(0, -32) scale(${this.facing * 1.3}, 1.3)`);
    this.charLegL.setAttribute('transform', 'rotate(0)');
    this.charLegR.setAttribute('transform', 'rotate(0)');
    this.charArmL.setAttribute('transform', 'rotate(0)');
    this.charArmR.setAttribute('transform', 'rotate(0)');
  }

  // Global background idle loop (breathing, blinks, weight shifts)
  startGlobalIdleLoop() {
    const loop = (timestamp) => {
      if (this.currentState === 'idle') {
        const t = timestamp * 0.003;
        // Breathing motion (torso scale & head bob)
        const breathe = Math.sin(t) * 1.5;
        this.charTorso.setAttribute('transform', `translate(0, ${breathe})`);
        this.charHead.setAttribute('transform', `translate(0, ${breathe * 0.7})`);
        this.charShadow.setAttribute('rx', (16 + breathe * 0.4).toFixed(1));

        // Weight shift & arm relaxation
        const sway = Math.sin(t * 0.7) * 2;
        this.charArmL.setAttribute('transform', `rotate(${-sway + 4})`);
        this.charArmR.setAttribute('transform', `rotate(${sway - 4})`);

        // Periodic eye blink
        const blinkCycle = Math.floor(timestamp / 3200);
        const blinkTime = timestamp % 3200;
        if (blinkTime < 140) {
          this.eyesNormal.style.opacity = '0.1';
        } else {
          this.eyesNormal.style.opacity = '1';
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // State 2: Running Stride Cycle
  applyRunCycle(strideT) {
    // Stride angle oscillation
    const legAngle = Math.sin(strideT) * 34; // degrees
    const armAngle = -legAngle * 0.85;

    this.charLegL.setAttribute('transform', `rotate(${-legAngle})`);
    this.charLegR.setAttribute('transform', `rotate(${legAngle})`);
    this.charArmL.setAttribute('transform', `rotate(${-armAngle})`);
    this.charArmR.setAttribute('transform', `rotate(${armAngle})`);

    // Torso spring bounce (double frequency of stride)
    const bounce = Math.abs(Math.sin(strideT)) * -4;
    this.charTorso.setAttribute('transform', `translate(0, ${bounce})`);
    this.charHead.setAttribute('transform', `translate(0, ${bounce * 0.8}) rotate(${Math.sin(strideT) * 2})`);
    this.charShadow.setAttribute('rx', (16 + bounce * 0.6).toFixed(1));

    // Scarf streaming motion
    const scarfWave = Math.sin(strideT * 1.5) * 12;
    this.charScarf.setAttribute('transform', `rotate(${scarfWave})`);
  }

  // State 3: Checkpoint Arrival Celebration
  arriveAtCheckpoint(checkpointIndex, title, desc, emoteType, onComplete) {
    this.updateStateLabel('checkpoint');
    this.updateStepper(checkpointIndex);
    this.updateNarrative(`Checkpoint ${checkpointIndex}: ${title}`, title, desc);

    // Runner stops, turns slightly toward camera/pedestal, joyful face
    this.setFace('joy', 'smile');
    this.showEmote(emoteType);

    // Cheering posture: arms raised high
    this.charArmL.setAttribute('transform', 'rotate(-130)');
    this.charArmR.setAttribute('transform', 'rotate(120)');
    this.charLegL.setAttribute('transform', 'rotate(0)');
    this.charLegR.setAttribute('transform', 'rotate(0)');

    // Gentle cheering hop
    let hopStep = 0;
    const runCurrent = this.runId;
    const hopInterval = setInterval(() => {
      if (this.runId !== runCurrent) {
        clearInterval(hopInterval);
        return;
      }
      hopStep++;
      const hopY = Math.sin(hopStep * 0.5) * -6;
      this.charRig.setAttribute('transform', `translate(0, ${-32 + hopY}) scale(${this.facing * 1.3}, 1.3)`);
    }, 50);

    this.safeTimeout(() => {
      clearInterval(hopInterval);
      this.charRig.setAttribute('transform', `translate(0, -32) scale(${this.facing * 1.3}, 1.3)`);
      this.hideEmote();
      this.setFace('normal', 'smile');
      if (onComplete) onComplete();
    }, 1800);
  }

  // State 4: Obstacle Encounter
  encounterObstacle(previewQuick = false) {
    this.updateStateLabel('obstacle');
    this.updateStepper(3);
    this.updateNarrative('Quality Bottleneck Ahead', 'Review Checkpoint Obstacle', 'A heavy fallen boulder and crystal bramble blocks the main route. Choose how to proceed!');

    // Sudden skid stop, arms flung up in shock, wide eyes, alert emote
    this.setFace('surprised', 'open');
    this.showEmote('alert');

    // Surprise recoil
    this.charArmL.setAttribute('transform', 'rotate(-90)');
    this.charArmR.setAttribute('transform', 'rotate(-75)');
    this.charLegL.setAttribute('transform', 'rotate(12)');
    this.charLegR.setAttribute('transform', 'rotate(-15)');

    // Skid dust cloud
    this.spawnDustPuff(this.runnerPos.x, this.runnerPos.y);
    this.spawnDustPuff(this.runnerPos.x - 5, this.runnerPos.y);

    // Runner steps back, hesitates, inspects
    const delay = previewQuick ? 300 : 1100;
    this.safeTimeout(() => {
      this.setFace('normal', 'open');
      this.charArmR.setAttribute('transform', 'rotate(45)'); // Hand on chin inspecting
      this.charHead.setAttribute('transform', 'rotate(8)');
      this.openObstacleModal();
    }, delay);
  }

  // State 5: Clear Obstacle & Retry
  executeObstacleClear() {
    this.chosenRoute = 'clear';
    this.updateStateLabel('retry');
    this.updateNarrative('Overcoming Obstacle', 'Clearing the Bottleneck', 'Runner rolls up sleeves, heaves the boulder aside, and resumes the cleared main path.');

    this.showEmote('wrench');
    this.setFace('normal', 'grimace');

    // Step up to boulder
    this.charArmL.setAttribute('transform', 'rotate(-40)');
    this.charArmR.setAttribute('transform', 'rotate(-40)');
    this.charLegL.setAttribute('transform', 'rotate(-10)');
    this.charLegR.setAttribute('transform', 'rotate(15)');

    // Power stance & strain rumble
    this.obstacleGroup.classList.add('blocker-vibe');

    this.safeTimeout(() => {
      // Mighty heave! Obstacle shatters/clears
      this.obstacleGroup.classList.remove('blocker-vibe');
      this.obstacleGroup.classList.add('cleared');
      this.spawnDustPuff(this.runnerPos.x + 25, this.runnerPos.y);

      // Thumbs-up / victory fist pump
      this.setFace('joy', 'smile');
      this.showEmote('idea');
      this.charArmR.setAttribute('transform', 'rotate(-110)');

      this.safeTimeout(() => {
        this.hideEmote();
        // Continue along cleared route to Finish
        this.runAlongPath(this.pathCleared, 3000, () => {
          this.triggerCompletion();
        });
      }, 1000);
    }, 1200);
  }

  // State 6: Take the Detour
  executeObstacleDetour() {
    this.chosenRoute = 'detour';
    this.updateStateLabel('detour');
    this.updateNarrative('Strategic Detour', 'Taking the Scenic Bridge', 'Runner loops upward across the wooden suspension ridge bridge with a buoyant stride.');

    this.showEmote('compass');
    this.setFace('joy', 'smile');

    // Agile pivot & hop onto detour bridge
    this.charArmL.setAttribute('transform', 'rotate(-60)');
    this.charArmR.setAttribute('transform', 'rotate(60)');

    this.safeTimeout(() => {
      this.hideEmote();
      // Run along detour path over the wooden bridge to Finish
      this.runAlongPath(this.pathDetour, 3600, () => {
        this.triggerCompletion();
      });
    }, 900);
  }

  // State 7: Failure / Uncertainty (Demonstration state)
  triggerFailureState() {
    this.updateStateLabel('failure');
    this.updateNarrative('Uncertainty Encountered', 'Testing Runner Recovery', 'Runner stumbles and scratches head in uncertainty. Click any button or Restart to recover.');
    this.setFace('surprised', 'grimace');
    this.showEmote('uncertain');

    // Wobble animation
    this.charHead.setAttribute('transform', 'rotate(-14)');
    this.charArmL.setAttribute('transform', 'rotate(30)');
    this.charArmR.setAttribute('transform', 'rotate(-120)'); // scratching head
    this.charLegL.setAttribute('transform', 'rotate(-15)');
    this.charLegR.setAttribute('transform', 'rotate(5)');
  }

  // State 8: Completion Celebration
  triggerCompletion() {
    this.updateStateLabel('celebration');
    this.updateStepper(4);
    this.updateNarrative('Goal Completed!', 'Summit Reached', `Congratulations! "${this.currentGoal}" has been successfully completed!`);

    this.setFace('joy', 'smile');
    this.showEmote('trophy');

    // Leaping victory pose
    this.charArmL.setAttribute('transform', 'rotate(-140)');
    this.charArmR.setAttribute('transform', 'rotate(140)');
    this.charLegL.setAttribute('transform', 'rotate(20)');
    this.charLegR.setAttribute('transform', 'rotate(-20)');

    // Environmental celebration: Launch confetti canons
    this.fireConfetti();

    // Show victory modal after brief victory hop
    this.safeTimeout(() => {
      this.victoryGoalEcho.textContent = `"${this.currentGoal}"`;
      this.statRoute.textContent = this.chosenRoute === 'detour' ? 'Scenic Bridge' : 'Cleared Trail';
      this.victoryModal.classList.add('open');
    }, 1200);
  }

  // Preview any of the 8 states on demand (for presentations)
  previewState(state) {
    this.clearAllTimers();
    switch (state) {
      case 'idle':
        this.setIdleState();
        break;
      case 'running':
        this.updateStateLabel('running');
        this.setFace('normal', 'smile');
        this.hideEmote();
        // Demonstrate running stride at current spot
        let step = 0;
        const runId = this.runId;
        const tick = () => {
          if (this.runId !== runId || this.currentState !== 'running') return;
          step += 0.15;
          this.applyRunCycle(step);
          if (Math.sin(step) > 0.9) this.spawnDustPuff(this.runnerPos.x, this.runnerPos.y);
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        break;
      case 'checkpoint':
        this.arriveAtCheckpoint(2, 'Drafting Concepts', 'Structuring the core milestones.', 'quill');
        break;
      case 'obstacle':
        this.setCharTransform(930, 488);
        this.encounterObstacle(true);
        break;
      case 'retry':
        this.setCharTransform(940, 488);
        this.executeObstacleClear();
        break;
      case 'detour':
        this.setCharTransform(950, 490);
        this.executeObstacleDetour();
        break;
      case 'failure':
        this.triggerFailureState();
        break;
      case 'celebration':
        this.setCharTransform(1320, 390);
        this.triggerCompletion();
        break;
    }
  }

  // ================= SVG PATH RUNNING ENGINE =================

  /**
   * Smoothly animates the runner along an SVG path using getPointAtLength()
   * @param {SVGPathElement} pathElement
   * @param {number} durationMs
   * @param {Function} onFinish
   */
  runAlongPath(pathElement, durationMs, onFinish) {
    this.updateStateLabel('running');
    this.setFace('normal', 'smile');
    this.hideEmote();

    const pathLen = pathElement.getTotalLength();
    const effectiveDuration = (durationMs / this.speedMultiplier);
    const startTimestamp = performance.now();
    const localRunId = this.runId;

    let lastDustTime = 0;

    const frame = (now) => {
      if (this.runId !== localRunId) return;

      const elapsed = now - startTimestamp;
      const progress = Math.min(elapsed / effectiveDuration, 1);

      // Smooth ease-in-out or linear motion
      const currentLen = progress * pathLen;
      const pt = pathElement.getPointAtLength(currentLen);

      // Compute heading / tangent
      const sampleDist = Math.min(pathLen, currentLen + 4);
      const ptAhead = pathElement.getPointAtLength(sampleDist);
      const dx = ptAhead.x - pt.x;
      const dy = ptAhead.y - pt.y;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      if (dx > 0.1) this.setFacing(1);
      else if (dx < -0.1) this.setFacing(-1);

      this.setCharTransform(pt.x, pt.y, angle);

      // Run cycle animation
      this.charAnimTime += (0.18 * this.speedMultiplier);
      this.applyRunCycle(this.charAnimTime);

      // Dust puff emitter
      if (now - lastDustTime > (140 / this.speedMultiplier)) {
        this.spawnDustPuff(pt.x, pt.y);
        lastDustTime = now;
      }

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(frame);
      } else {
        // Complete segment
        this.setCharTransform(pt.x, pt.y, 0);
        this.charLegL.setAttribute('transform', 'rotate(0)');
        this.charLegR.setAttribute('transform', 'rotate(0)');
        this.charArmL.setAttribute('transform', 'rotate(0)');
        this.charArmR.setAttribute('transform', 'rotate(0)');
        if (onFinish) onFinish();
      }
    };

    this.animationFrameId = requestAnimationFrame(frame);
  }

  // ================= MAIN JOURNEY SEQUENCER =================

  startJourney(goalText) {
    this.currentGoal = goalText.trim() || 'Plan my study week';
    this.goalInput.value = this.currentGoal;
    this.restart();

    // Narrative generation based on goal
    const goalStories = this.generateGoalSteps(this.currentGoal);

    // Start Segment 1: Trailhead to Checkpoint 1 (Gather)
    this.updateNarrative('Journey Started', 'Setting out on Trail', `Embarking to accomplish: "${this.currentGoal}".`);

    // We split pathMain1 into sub-segments or run fractions:
    // pathMain1 total length:
    const totalMainLen = this.pathMain1.getTotalLength();
    // Gather is at approx len 210, Draft at approx len 570, Review/Obstacle at approx len 960

    this.safeTimeout(() => {
      this.runAlongPathSub(this.pathMain1, 0, 0.22, 1800, () => {
        // Arrive CP1: Gather
        this.arriveAtCheckpoint(1, goalStories.gather.title, goalStories.gather.desc, 'idea', () => {
          // CP1 -> CP2: Draft
          this.runAlongPathSub(this.pathMain1, 0.22, 0.58, 2400, () => {
            // Arrive CP2: Draft
            this.arriveAtCheckpoint(2, goalStories.draft.title, goalStories.draft.desc, 'quill', () => {
              // CP2 -> CP3: Review & Obstacle
              this.runAlongPathSub(this.pathMain1, 0.58, 1.0, 2400, () => {
                // Encounter Obstacle at Review
                this.encounterObstacle();
              });
            });
          });
        });
      });
    }, 400);
  }

  runAlongPathSub(pathElement, startFrac, endFrac, durationMs, onFinish) {
    this.updateStateLabel('running');
    this.setFace('normal', 'smile');
    this.hideEmote();

    const pathLen = pathElement.getTotalLength();
    const startLen = startFrac * pathLen;
    const endLen = endFrac * pathLen;
    const lenDelta = endLen - startLen;
    const effectiveDuration = (durationMs / this.speedMultiplier);
    const startTimestamp = performance.now();
    const localRunId = this.runId;

    let lastDustTime = 0;

    const frame = (now) => {
      if (this.runId !== localRunId) return;

      const elapsed = now - startTimestamp;
      const progress = Math.min(elapsed / effectiveDuration, 1);
      const currentLen = startLen + progress * lenDelta;
      const pt = pathElement.getPointAtLength(currentLen);

      const sampleDist = Math.min(pathLen, currentLen + 4);
      const ptAhead = pathElement.getPointAtLength(sampleDist);
      const dx = ptAhead.x - pt.x;
      const dy = ptAhead.y - pt.y;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      if (dx > 0.1) this.setFacing(1);
      else if (dx < -0.1) this.setFacing(-1);

      this.setCharTransform(pt.x, pt.y, angle);

      this.charAnimTime += (0.18 * this.speedMultiplier);
      this.applyRunCycle(this.charAnimTime);

      if (now - lastDustTime > (140 / this.speedMultiplier)) {
        this.spawnDustPuff(pt.x, pt.y);
        lastDustTime = now;
      }

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(frame);
      } else {
        this.setCharTransform(pt.x, pt.y, 0);
        this.charLegL.setAttribute('transform', 'rotate(0)');
        this.charLegR.setAttribute('transform', 'rotate(0)');
        this.charArmL.setAttribute('transform', 'rotate(0)');
        this.charArmR.setAttribute('transform', 'rotate(0)');
        if (onFinish) onFinish();
      }
    };

    this.animationFrameId = requestAnimationFrame(frame);
  }

  // Generate contextual narrative for milestones
  generateGoalSteps(goal) {
    const lower = goal.toLowerCase();
    if (lower.includes('study') || lower.includes('exam') || lower.includes('class')) {
      return {
        gather: { title: 'Gathering Syllabi & Notes', desc: 'Collecting coursework, exam deadlines, and study priorities.' },
        draft: { title: 'Drafting Study Blocks', desc: 'Allocating deep-work sessions and spaced review cycles.' },
        review: { title: 'Schedule Clash Bottleneck', desc: 'Overlapping deadlines create an energy bottleneck.' },
        finish: { title: 'Study Calendar Locked', desc: 'Weekly master study plan fully structured and balanced!' }
      };
    } else if (lower.includes('project') || lower.includes('update') || lower.includes('status')) {
      return {
        gather: { title: 'Gathering Team Metrics', desc: 'Collating commit logs, sprint velocity, and QA status.' },
        draft: { title: 'Drafting Executive Summary', desc: 'Highlighting key wins, blockers, and next sprint milestones.' },
        review: { title: 'Scope Dependency Block', desc: 'Unresolved cross-team dependency creates a pause.' },
        finish: { title: 'Update Broadcasted', desc: 'Stakeholders aligned and sprint roadmap published!' }
      };
    } else {
      return {
        gather: { title: 'Gathering Requirements', desc: 'Collecting key references, assets, and initial inspiration.' },
        draft: { title: 'Drafting Core Architecture', desc: 'Assembling primary structures and iterative components.' },
        review: { title: 'Quality Bottleneck Review', desc: 'Complex edge case identified blocking the path forward.' },
        finish: { title: 'Goal Milestone Achieved', desc: 'All requirements met with polished execution!' }
      };
    }
  }

  // ================= UI HELPERS =================

  updateNarrative(badge, title, desc) {
    this.narrativeBadge.textContent = badge;
    this.narrativeTitle.textContent = title;
    this.narrativeDesc.textContent = desc;
    this.narrativeCard.classList.remove('hidden');
  }

  updateStepper(activeStep) {
    this.stepNodes.forEach((node, idx) => {
      const stepNum = idx + 1;
      node.classList.remove('active', 'completed');
      if (stepNum < activeStep) {
        node.classList.add('completed');
        node.querySelector('.step-dot').innerHTML = '✓';
      } else if (stepNum === activeStep) {
        node.classList.add('active');
        node.querySelector('.step-dot').innerHTML = stepNum;
      } else {
        node.querySelector('.step-dot').innerHTML = stepNum;
      }
    });

    this.stepConnectors.forEach((conn, idx) => {
      conn.classList.toggle('completed', idx + 1 < activeStep);
    });
  }

  openObstacleModal() {
    this.obstacleModal.classList.add('open');
  }

  closeObstacleModal() {
    this.obstacleModal.classList.remove('open');
  }

  restart() {
    this.clearAllTimers();
    this.closeObstacleModal();
    this.victoryModal.classList.remove('open');
    this.obstacleGroup.classList.remove('cleared', 'blocker-vibe');

    this.updateStepper(1);
    this.setFacing(1);
    this.setCharTransform(90, 560, 0);
    this.setIdleState();
    this.updateNarrative('Trailhead', 'Ready for Journey', `Enter a goal or choose an example chip to begin.`);
  }

  // ================= CONFETTI PHYSICS =================

  initConfetti() {
    this.canvas = document.getElementById('confetti-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.confettiParticles = [];
    this.confettiRunning = false;

    const resize = () => {
      this.canvas.width = this.canvas.parentElement.clientWidth;
      this.canvas.height = this.canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', resize);
    resize();
  }

  fireConfetti() {
    if (this.reducedMotion) return;
    const colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#ffd166'];
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Emit 130 confetti pieces from summit area
    for (let i = 0; i < 130; i++) {
      this.confettiParticles.push({
        x: w * 0.85 + (Math.random() * 80 - 40),
        y: h * 0.45 + (Math.random() * 60 - 30),
        vx: (Math.random() - 0.5) * 14 - 3,
        vy: -(Math.random() * 12 + 6),
        size: Math.random() * 7 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rSpeed: (Math.random() - 0.5) * 8,
        gravity: 0.35,
        drag: 0.985,
        life: 1.0,
        decay: Math.random() * 0.007 + 0.006
      });
    }

    if (!this.confettiRunning) {
      this.confettiRunning = true;
      this.animateConfetti();
    }
  }

  animateConfetti() {
    if (!this.confettiRunning) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.confettiParticles.length - 1; i >= 0; i--) {
      const p = this.confettiParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= p.drag;
      p.rotation += p.rSpeed;
      p.life -= p.decay;

      if (p.life <= 0 || p.y > this.canvas.height) {
        this.confettiParticles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = Math.max(0, p.life);
      this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      this.ctx.restore();
    }

    if (this.confettiParticles.length > 0) {
      requestAnimationFrame(() => this.animateConfetti());
    } else {
      this.confettiRunning = false;
    }
  }
}

// Bootstrap application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.thoughtTrail = new ThoughtTrail();
});
