/**
 * Pim's Desk — Animated Desktop Companion Prototype
 * Articulated SVG character controller, physical file sorting engine,
 * interactive file manager, and deterministic state machine.
 */

class PimDesk {
  constructor() {
    this.runId = 0;
    this.animationFrameId = null;
    this.timerIds = [];

    // State
    this.currentState = 'idle'; // idle | walk | inspect | lift | strain | lock | unlock | celebrate
    this.speedMultiplier = 1.0;
    this.reducedMotion = false;
    this.chosenLockAction = null; // 'retry' | 'leave'

    // Character position & facing
    this.pimPos = { x: 500, y: 470 };
    this.facing = 1; // 1 = right, -1 = left
    this.isCarrying = false;
    this.walkAnimTime = 0;

    // Files database (simulated)
    this.files = [
      { id: 1, name: 'lecture-notes.pdf', kind: 'PDF Document', size: '2.4 MB', target: 'documents', currentFolder: 'downloads', status: 'In Downloads', locked: false, icon: 'PDF', iconBg: '#ef4444' },
      { id: 2, name: 'holiday-photo.jpg', kind: 'JPEG Image', size: '4.1 MB', target: 'images', currentFolder: 'downloads', status: 'In Downloads', locked: false, icon: 'JPG', iconBg: '#f59e0b' },
      { id: 3, name: 'project-report.docx', kind: 'Word Document', size: '1.1 MB', target: 'documents', currentFolder: 'downloads', status: 'In Downloads', locked: false, icon: 'DOC', iconBg: '#2563eb' },
      { id: 4, name: 'budget.xlsx', kind: 'Spreadsheet', size: '680 KB', target: 'archive', currentFolder: 'downloads', status: 'In Downloads', locked: false, icon: 'XLS', iconBg: '#10b981' },
      { id: 5, name: 'thesis_final_FINAL2.docx', kind: 'Word Document', size: '8.5 MB', target: 'documents', currentFolder: 'downloads', status: '🔒 Process Lock', locked: true, icon: 'DOC', iconBg: '#8b5cf6' }
    ];

    this.activeFolderView = 'downloads';
    this.selectedFileId = 1;

    // Fixed coordinate anchors in desktop viewport (1280x720 space)
    this.anchors = {
      idleHome: { x: 500, y: 470 },
      fileRows: [
        { x: 450, y: 215 }, // Row 1
        { x: 450, y: 260 }, // Row 2
        { x: 450, y: 305 }, // Row 3
        { x: 450, y: 350 }, // Row 4
        { x: 450, y: 395 }  // Row 5
      ],
      folders: {
        documents: { x: 230, y: 225 },
        images: { x: 230, y: 265 },
        archive: { x: 230, y: 305 },
        downloads: { x: 230, y: 185 }
      },
      celebrationStage: { x: 620, y: 420 }
    };

    this.initDom();
    this.bindEvents();

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.setReducedMotion(true);
    }

    this.setCharPos(this.anchors.idleHome.x, this.anchors.idleHome.y);
    this.setIdleState();
    this.startGlobalIdleLoop();
    this.updateClock();
    setInterval(() => this.updateClock(), 30000);
  }

  initDom() {
    // Character parts
    this.pimGroup = document.getElementById('pim-character');
    this.pimRig = document.getElementById('pim-rig');
    this.pimShadow = document.getElementById('pim-shadow');
    this.pimTorso = document.getElementById('pim-torso');
    this.pimHead = document.getElementById('pim-head');
    this.pimLegL = document.getElementById('pim-leg-l');
    this.pimLegR = document.getElementById('pim-leg-r');
    this.pimArmL = document.getElementById('pim-arm-l');
    this.pimArmR = document.getElementById('pim-arm-r');
    this.pimCarriedFileSvg = document.getElementById('pim-carried-file-svg');
    this.pimBubble = document.getElementById('pim-bubble');

    // Face elements
    this.eyesNormal = document.getElementById('eyes-normal');
    this.eyesSurprised = document.getElementById('eyes-surprised');
    this.eyesJoy = document.getElementById('eyes-joy');
    this.mouthSmile = document.getElementById('mouth-smile');
    this.mouthOpen = document.getElementById('mouth-open');
    this.mouthGrimace = document.getElementById('mouth-grimace');

    // Bubble Emotes
    this.bubbles = {
      scan: document.getElementById('bubble-scan'),
      carry: document.getElementById('bubble-carry'),
      lock: document.getElementById('bubble-lock'),
      key: document.getElementById('bubble-key'),
      alert: document.getElementById('bubble-alert'),
      trophy: document.getElementById('bubble-trophy')
    };

    // UI elements
    this.btnStartTidy = document.getElementById('btn-start-tidy');
    this.btnQuickScan = document.getElementById('btn-quick-scan');
    this.btnResetDesk = document.getElementById('btn-reset-desk');
    this.btnDockRestart = document.getElementById('btn-dock-restart');
    this.btnSpeedToggle = document.getElementById('btn-speed-toggle');
    this.btnMotionToggle = document.getElementById('btn-motion-toggle');

    this.pimStatusDesc = document.getElementById('pim-status-desc');
    this.systemStatusText = document.getElementById('system-status-text');
    this.activeStateName = document.getElementById('active-state-name');
    this.stickyNoteText = document.getElementById('sticky-note-text');
    this.clockDisplay = document.getElementById('clock-display');

    // Inspector
    this.previewCard = document.getElementById('preview-card');
    this.previewArtIcon = document.getElementById('preview-art-icon');
    this.previewName = document.getElementById('preview-name');
    this.metaType = document.getElementById('meta-type');
    this.metaSize = document.getElementById('meta-size');
    this.metaFolder = document.getElementById('meta-folder');
    this.metaStatus = document.getElementById('meta-status');

    // Badges & storage
    this.badgeDownloads = document.getElementById('badge-downloads');
    this.badgeDocuments = document.getElementById('badge-documents');
    this.badgeImages = document.getElementById('badge-images');
    this.badgeArchive = document.getElementById('badge-archive');
    this.windowBadgeCount = document.getElementById('window-badge-count');
    this.windowTitleText = document.getElementById('window-title-text');
    this.breadcrumbCurrent = document.getElementById('breadcrumb-current');
    this.storageBarFill = document.getElementById('storage-bar-fill');
    this.storagePercTxt = document.getElementById('storage-perc-txt');

    // Modals
    this.lockedModal = document.getElementById('locked-file-modal');
    this.btnChoiceRetry = document.getElementById('btn-choice-retry');
    this.btnChoiceLeave = document.getElementById('btn-choice-leave');

    this.completionModal = document.getElementById('completion-modal');
    this.btnTidyAgain = document.getElementById('btn-tidy-again');
    this.btnCloseSummary = document.getElementById('btn-close-summary');
    this.summarySortedCount = document.getElementById('summary-sorted-count');
    this.summaryPreservedCount = document.getElementById('summary-preserved-count');
  }

  bindEvents() {
    // Primary Tidy Button
    this.btnStartTidy.addEventListener('click', () => {
      this.executeFullSortingScenario();
    });

    // Quick Scan
    this.btnQuickScan.addEventListener('click', () => {
      this.executeQuickScan();
    });

    // Reset / Restart
    this.btnResetDesk.addEventListener('click', () => this.restart());
    this.btnDockRestart.addEventListener('click', () => this.restart());

    // Speed Cycle
    this.btnSpeedToggle.addEventListener('click', () => {
      if (this.speedMultiplier === 1.0) {
        this.speedMultiplier = 1.5;
        this.btnSpeedToggle.textContent = '1.5x Speed';
      } else if (this.speedMultiplier === 1.5) {
        this.speedMultiplier = 0.75;
        this.btnSpeedToggle.textContent = '0.75x Speed';
      } else {
        this.speedMultiplier = 1.0;
        this.btnSpeedToggle.textContent = '1.0x Speed';
      }
    });

    // Motion Toggle
    this.btnMotionToggle.addEventListener('click', () => {
      this.setReducedMotion(!this.reducedMotion);
    });

    // Modal Choices
    this.btnChoiceRetry.addEventListener('click', () => {
      this.lockedModal.classList.remove('open');
      this.executeLockedRetryAction();
    });

    this.btnChoiceLeave.addEventListener('click', () => {
      this.lockedModal.classList.remove('open');
      this.executeLockedLeaveAction();
    });

    // Completion modal actions
    this.btnTidyAgain.addEventListener('click', () => {
      this.completionModal.classList.remove('open');
      this.restart();
    });

    this.btnCloseSummary.addEventListener('click', () => {
      this.completionModal.classList.remove('open');
    });

    // Interactive File Row Selection
    document.querySelectorAll('.file-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = parseInt(row.getAttribute('data-id'), 10);
        this.selectFile(id);
      });
    });

    // Interactive Sidebar Folder Navigation
    document.querySelectorAll('.sidebar-folder-item').forEach(item => {
      item.addEventListener('click', () => {
        const folder = item.getAttribute('data-folder');
        this.switchFolderView(folder);
      });
    });

    // Secondary State Tester Pills
    document.querySelectorAll('.state-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const state = btn.getAttribute('data-state');
        this.previewState(state);
      });
    });
  }

  updateClock() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    this.clockDisplay.textContent = `${hours}:${minutes} ${ampm}`;
  }

  setReducedMotion(enabled) {
    this.reducedMotion = enabled;
    if (enabled) {
      document.body.classList.add('reduced-motion-active');
      this.btnMotionToggle.textContent = 'Motion: Reduced';
    } else {
      document.body.classList.remove('reduced-motion-active');
      this.btnMotionToggle.textContent = 'Motion: Full';
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

  // ================= CHARACTER CONTROLLER & KINEMATICS =================

  setFacing(direction) {
    this.facing = direction >= 0 ? 1 : -1;
    this.pimRig.setAttribute('transform', `scale(${this.facing * 1.35}, 1.35)`);
  }

  setCharPos(x, y) {
    this.pimPos = { x, y };
    this.pimGroup.setAttribute('transform', `translate(${x}, ${y})`);
  }

  setFace(eyeState = 'normal', mouthState = 'smile') {
    this.eyesNormal.style.display = eyeState === 'normal' ? 'block' : 'none';
    this.eyesSurprised.style.display = eyeState === 'surprised' ? 'block' : 'none';
    this.eyesJoy.style.display = eyeState === 'joy' ? 'block' : 'none';

    this.mouthSmile.style.display = mouthState === 'smile' ? 'block' : 'none';
    this.mouthOpen.style.display = mouthState === 'open' ? 'block' : 'none';
    this.mouthGrimace.style.display = mouthState === 'grimace' ? 'block' : 'none';
  }

  showBubble(type) {
    Object.values(this.bubbles).forEach(b => b.style.display = 'none');
    if (type && this.bubbles[type]) {
      this.bubbles[type].style.display = 'block';
      this.pimBubble.classList.add('visible');
    } else {
      this.pimBubble.classList.remove('visible');
    }
  }

  hideBubble() {
    this.pimBubble.classList.remove('visible');
  }

  setCarrying(isCarrying) {
    this.isCarrying = isCarrying;
    this.pimCarriedFileSvg.style.display = isCarrying ? 'block' : 'none';
  }

  updateStateLabel(stateName) {
    this.currentState = stateName;
    const names = {
      idle: '1. Idle (Natural Breathing)',
      walk: '2. Walk / Jog Across Desk',
      inspect: '3. Inspecting File Details',
      lift: '4. Lifting & Physical Carry',
      strain: '5. Straining at Process Lock',
      lock: '6. Locked File Encounter',
      unlock: '7. Key Force Unlock',
      celebrate: '8. Victory Celebration'
    };
    this.activeStateName.textContent = names[stateName] || stateName;

    document.querySelectorAll('.state-pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-state') === stateName);
    });
  }

  updateStatus(desc) {
    this.pimStatusDesc.textContent = desc;
    this.systemStatusText.textContent = desc.split(' ')[0] + ' ' + (desc.split(' ')[1] || '');
  }

  // State 1: Idle
  setIdleState() {
    this.updateStateLabel('idle');
    this.setFace('normal', 'smile');
    this.hideBubble();
    this.setCarrying(false);
    this.pimLegL.setAttribute('transform', 'rotate(0)');
    this.pimLegR.setAttribute('transform', 'rotate(0)');
    this.pimArmL.setAttribute('transform', 'rotate(0)');
    this.pimArmR.setAttribute('transform', 'rotate(0)');
    this.updateStatus('Pim is idling at the desk.');
  }

  startGlobalIdleLoop() {
    const loop = (timestamp) => {
      if (this.currentState === 'idle') {
        const t = timestamp * 0.003;
        // Breathing torso expansion
        const breathe = Math.sin(t) * 1.5;
        this.pimTorso.setAttribute('transform', `translate(0, ${breathe})`);
        this.pimHead.setAttribute('transform', `translate(0, ${breathe * 0.7})`);
        this.pimShadow.setAttribute('rx', (20 + breathe * 0.5).toFixed(1));

        // Arm swing & weight shift
        const sway = Math.sin(t * 0.7) * 2;
        this.pimArmL.setAttribute('transform', `rotate(${-sway + 3})`);
        this.pimArmR.setAttribute('transform', `rotate(${sway - 3})`);

        // Natural periodic blink
        const blinkTime = timestamp % 3400;
        if (blinkTime < 130) {
          this.eyesNormal.style.opacity = '0.1';
        } else {
          this.eyesNormal.style.opacity = '1';
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // Smooth interpolated walk between two points with stride kinematics
  walkTo(targetX, targetY, durationMs, onFinish) {
    this.updateStateLabel('walk');
    this.setFace('normal', 'smile');
    this.hideBubble();

    const startX = this.pimPos.x;
    const startY = this.pimPos.y;
    const dx = targetX - startX;
    const dy = targetY - startY;

    if (Math.abs(dx) > 1) {
      this.setFacing(dx > 0 ? 1 : -1);
    }

    const startTimestamp = performance.now();
    const effectiveDuration = durationMs / this.speedMultiplier;
    const localRunId = this.runId;

    const frame = (now) => {
      if (this.runId !== localRunId) return;

      const elapsed = now - startTimestamp;
      const progress = Math.min(elapsed / effectiveDuration, 1);

      // Interpolate position
      const currentX = startX + dx * progress;
      const currentY = startY + dy * progress;
      this.setCharPos(currentX, currentY);

      // Stride cycle
      this.walkAnimTime += 0.22 * this.speedMultiplier;
      const legAngle = Math.sin(this.walkAnimTime) * 32;
      const armAngle = -legAngle * 0.8;

      this.pimLegL.setAttribute('transform', `rotate(${-legAngle})`);
      this.pimLegR.setAttribute('transform', `rotate(${legAngle})`);

      if (!this.isCarrying) {
        this.pimArmL.setAttribute('transform', `rotate(${-armAngle})`);
        this.pimArmR.setAttribute('transform', `rotate(${armAngle})`);
      } else {
        // Holding carried file in front with slight stride bounce
        this.pimArmL.setAttribute('transform', `rotate(-40) translate(2, 2)`);
        this.pimArmR.setAttribute('transform', `rotate(35) translate(-2, 2)`);
      }

      // Torso bounce
      const bounce = Math.abs(Math.sin(this.walkAnimTime)) * -4;
      this.pimTorso.setAttribute('transform', `translate(0, ${bounce})`);
      this.pimHead.setAttribute('transform', `translate(0, ${bounce * 0.7})`);
      this.pimShadow.setAttribute('rx', (20 + bounce * 0.5).toFixed(1));

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(frame);
      } else {
        // Arrived at destination
        this.setCharPos(targetX, targetY);
        this.pimLegL.setAttribute('transform', 'rotate(0)');
        this.pimLegR.setAttribute('transform', 'rotate(0)');
        if (!this.isCarrying) {
          this.pimArmL.setAttribute('transform', 'rotate(0)');
          this.pimArmR.setAttribute('transform', 'rotate(0)');
        }
        if (onFinish) onFinish();
      }
    };

    this.animationFrameId = requestAnimationFrame(frame);
  }

  // ================= PHYSICAL ACTION SEQUENCES =================

  // Inspect file
  inspectAction(fileObj, onFinish) {
    this.updateStateLabel('inspect');
    this.updateStatus(`Pim is inspecting ${fileObj.name}...`);
    this.selectFile(fileObj.id);

    this.setFace('normal', 'open');
    this.showBubble('scan');

    // Leaning forward with head tilt
    this.pimHead.setAttribute('transform', 'rotate(10) translate(2, 1)');
    this.pimTorso.setAttribute('transform', 'rotate(5)');
    this.pimArmR.setAttribute('transform', 'rotate(35)');

    this.safeTimeout(() => {
      this.hideBubble();
      this.pimHead.setAttribute('transform', 'rotate(0)');
      this.pimTorso.setAttribute('transform', 'rotate(0)');
      this.pimArmR.setAttribute('transform', 'rotate(0)');
      if (onFinish) onFinish();
    }, 1100);
  }

  // Lift file from row
  liftFileAction(fileObj, onFinish) {
    this.updateStateLabel('lift');
    this.updateStatus(`Pim is lifting ${fileObj.name}...`);

    // Crouch down
    this.pimTorso.setAttribute('transform', 'translate(0, 6)');
    this.pimArmL.setAttribute('transform', 'rotate(-55)');
    this.pimArmR.setAttribute('transform', 'rotate(-55)');
    this.pimLegL.setAttribute('transform', 'rotate(-10)');
    this.pimLegR.setAttribute('transform', 'rotate(10)');

    const rowEl = document.getElementById(`row-file-${fileObj.id}`);
    if (rowEl) rowEl.classList.add('transporting');

    this.safeTimeout(() => {
      // Stand up holding file
      this.setCarrying(true);
      this.showBubble('carry');
      this.setFace('joy', 'smile');

      this.pimTorso.setAttribute('transform', 'translate(0, 0)');
      this.pimArmL.setAttribute('transform', 'rotate(-40)');
      this.pimArmR.setAttribute('transform', 'rotate(35)');
      this.pimLegL.setAttribute('transform', 'rotate(0)');
      this.pimLegR.setAttribute('transform', 'rotate(0)');

      this.safeTimeout(() => {
        this.hideBubble();
        if (onFinish) onFinish();
      }, 500);
    }, 600);
  }

  // Drop file into folder
  depositFileAction(fileObj, onFinish) {
    const targetFolder = fileObj.target;
    this.updateStatus(`Pim deposits ${fileObj.name} into ${targetFolder}...`);

    const folderItem = document.getElementById(`folder-nav-${targetFolder}`);
    if (folderItem) folderItem.classList.add('drag-target');

    // Reach forward and release file
    this.pimArmL.setAttribute('transform', 'rotate(-70)');
    this.pimArmR.setAttribute('transform', 'rotate(-70)');

    this.safeTimeout(() => {
      // File dropped
      this.setCarrying(false);
      this.setFace('joy', 'smile');
      this.pimArmL.setAttribute('transform', 'rotate(0)');
      this.pimArmR.setAttribute('transform', 'rotate(0)');

      // Update file status & badges
      fileObj.currentFolder = targetFolder;
      fileObj.status = `✓ Moved to ${targetFolder.charAt(0).toUpperCase() + targetFolder.slice(1)}`;

      const pill = document.getElementById(`status-pill-${fileObj.id}`);
      if (pill) {
        pill.className = 'file-status-pill moved';
        pill.textContent = `✓ In ${targetFolder}`;
      }

      const rowEl = document.getElementById(`row-file-${fileObj.id}`);
      if (rowEl) {
        rowEl.classList.remove('transporting');
        rowEl.classList.add('sorted-away');
      }

      this.updateFolderBadges();

      if (folderItem) {
        setTimeout(() => folderItem.classList.remove('drag-target'), 400);
      }

      this.safeTimeout(() => {
        if (onFinish) onFinish();
      }, 500);
    }, 600);
  }

  // Encounter process lock on thesis file
  lockedEncounterSequence() {
    this.updateStateLabel('strain');
    this.updateStatus('Pim encounters a stubborn process lock!');

    const rowEl = document.getElementById('row-file-5');
    if (rowEl) rowEl.classList.add('locked-highlight');

    // Reach to lift
    this.pimTorso.setAttribute('transform', 'translate(0, 6)');
    this.pimArmL.setAttribute('transform', 'rotate(-55)');
    this.pimArmR.setAttribute('transform', 'rotate(-55)');

    this.safeTimeout(() => {
      // STUCK! Padlock appears
      this.showBubble('lock');
      this.setFace('normal', 'grimace');

      // Straining vibration: heels dug in, trembling arms
      let shakeCount = 0;
      const currentRun = this.runId;
      const shakeInterval = setInterval(() => {
        if (this.runId !== currentRun) {
          clearInterval(shakeInterval);
          return;
        }
        shakeCount++;
        const ox = (shakeCount % 2 === 0 ? -2 : 2);
        this.pimRig.setAttribute('transform', `scale(${this.facing * 1.35}, 1.35) translate(${ox}, 0)`);
      }, 70);

      this.safeTimeout(() => {
        clearInterval(shakeInterval);
        this.pimRig.setAttribute('transform', `scale(${this.facing * 1.35}, 1.35) translate(0, 0)`);

        // Recoil with surprise
        this.updateStateLabel('lock');
        this.setFace('surprised', 'open');
        this.showBubble('alert');

        this.pimArmL.setAttribute('transform', 'rotate(-100)');
        this.pimArmR.setAttribute('transform', 'rotate(95)');
        this.pimTorso.setAttribute('transform', 'translate(-6, -2)');

        this.safeTimeout(() => {
          // Open decision dialog
          this.lockedModal.classList.add('open');
        }, 900);
      }, 1300);
    }, 600);
  }

  // User Choice A: Retry with Force / Key Unlock
  executeLockedRetryAction() {
    this.chosenLockAction = 'retry';
    this.updateStateLabel('unlock');
    this.updateStatus('Pim taps the lock with the golden admin key!');

    this.showBubble('key');
    this.setFace('joy', 'smile');
    this.pimArmR.setAttribute('transform', 'rotate(-60)');

    this.safeTimeout(() => {
      // Lock snaps open!
      const lockGlyph = document.getElementById('lock-glyph-5');
      if (lockGlyph) lockGlyph.style.stroke = '#10b981';

      this.liftFileAction(this.files[4], () => {
        // Carry to Documents folder
        this.walkTo(this.anchors.folders.documents.x, this.anchors.folders.documents.y, 1400, () => {
          this.depositFileAction(this.files[4], () => {
            const pill = document.getElementById('status-pill-5');
            if (pill) {
              pill.className = 'file-status-pill moved';
              pill.textContent = '✓ Force Unlocked & Moved';
            }
            this.files[4].status = '✓ Force Unlocked & Moved';
            this.executeCompletionCelebration();
          });
        });
      });
    }, 1100);
  }

  // User Choice B: Leave it untouched
  executeLockedLeaveAction() {
    this.chosenLockAction = 'leave';
    this.updateStatus('Pim marks file safe and leaves it untouched in Downloads.');

    this.setFace('normal', 'smile');
    this.hideBubble();

    // Gentle patting motion
    this.pimArmR.setAttribute('transform', 'rotate(40)');
    const pill = document.getElementById('status-pill-5');
    if (pill) {
      pill.className = 'file-status-pill preserved';
      pill.textContent = '📌 Preserved in Downloads';
    }
    this.files[4].status = '📌 Preserved in Downloads';

    const rowEl = document.getElementById('row-file-5');
    if (rowEl) rowEl.classList.remove('locked-highlight');

    this.safeTimeout(() => {
      this.executeCompletionCelebration();
    }, 900);
  }

  // Scene E: Completion Celebration
  executeCompletionCelebration(direct = false) {
    this.updateStateLabel('celebrate');
    this.updateStatus('All files sorted! Downloads folder is spotless.');

    const celebratePim = () => {
      this.setFace('joy', 'smile');
      this.showBubble('trophy');

      // Leaping victory poses
      this.pimArmL.setAttribute('transform', 'rotate(-135)');
      this.pimArmR.setAttribute('transform', 'rotate(135)');
      this.pimLegL.setAttribute('transform', 'rotate(15)');
      this.pimLegR.setAttribute('transform', 'rotate(-15)');

      let hopStep = 0;
      const currentRun = this.runId;
      const hopInterval = setInterval(() => {
        if (this.runId !== currentRun) {
          clearInterval(hopInterval);
          return;
        }
        hopStep++;
        const hopY = Math.sin(hopStep * 0.6) * -8;
        this.setCharPos(this.anchors.celebrationStage.x, this.anchors.celebrationStage.y + hopY);
      }, 50);

      const modalDelay = direct ? 500 : 1600;
      this.safeTimeout(() => {
        clearInterval(hopInterval);
        this.setCharPos(this.anchors.celebrationStage.x, this.anchors.celebrationStage.y);

        // Stats summary calculation
        const sortedCount = this.files.filter(f => f.currentFolder !== 'downloads').length;
        const preservedCount = this.files.length - sortedCount;

        this.summarySortedCount.textContent = sortedCount;
        this.summaryPreservedCount.textContent = preservedCount;
        this.completionModal.classList.add('open');
      }, modalDelay);
    };

    if (direct) {
      this.setCharPos(this.anchors.celebrationStage.x, this.anchors.celebrationStage.y);
      celebratePim();
    } else {
      this.walkTo(this.anchors.celebrationStage.x, this.anchors.celebrationStage.y, 1000, celebratePim);
    }
  }

  // ================= SCENARIO SCRIPTS =================

  // Complete Main Scripted Sorting Scenario (Scenes A -> B -> C -> D -> E)
  executeFullSortingScenario() {
    this.restart();
    this.btnStartTidy.disabled = true;

    // Step 1: Walk from home to File 1 (lecture-notes.pdf)
    this.walkTo(this.anchors.fileRows[0].x, this.anchors.fileRows[0].y, 1100, () => {
      this.inspectAction(this.files[0], () => {
        this.liftFileAction(this.files[0], () => {
          // Carry to Documents
          this.walkTo(this.anchors.folders.documents.x, this.anchors.folders.documents.y, 1200, () => {
            this.depositFileAction(this.files[0], () => {

              // Step 2: Walk to File 2 (holiday-photo.jpg)
              this.walkTo(this.anchors.fileRows[1].x, this.anchors.fileRows[1].y, 1200, () => {
                this.inspectAction(this.files[1], () => {
                  this.liftFileAction(this.files[1], () => {
                    // Carry to Images
                    this.walkTo(this.anchors.folders.images.x, this.anchors.folders.images.y, 1200, () => {
                      this.depositFileAction(this.files[1], () => {

                        // Step 3: Walk to File 3 (project-report.docx)
                        this.walkTo(this.anchors.fileRows[2].x, this.anchors.fileRows[2].y, 1200, () => {
                          this.liftFileAction(this.files[2], () => {
                            // Carry to Documents
                            this.walkTo(this.anchors.folders.documents.x, this.anchors.folders.documents.y, 1200, () => {
                              this.depositFileAction(this.files[2], () => {

                                // Step 4: Walk to File 4 (budget.xlsx)
                                this.walkTo(this.anchors.fileRows[3].x, this.anchors.fileRows[3].y, 1200, () => {
                                  this.liftFileAction(this.files[3], () => {
                                    // Carry to Archive
                                    this.walkTo(this.anchors.folders.archive.x, this.anchors.folders.archive.y, 1200, () => {
                                      this.depositFileAction(this.files[3], () => {

                                        // Step 5: Walk to File 5 (thesis_final_FINAL2.docx - LOCKED)
                                        this.walkTo(this.anchors.fileRows[4].x, this.anchors.fileRows[4].y, 1200, () => {
                                          this.lockedEncounterSequence();
                                        });

                                      });
                                    });
                                  });
                                });

                              });
                            });
                          });
                        });

                      });
                    });
                  });
                });
              });

            });
          });
        });
      });
    });
  }

  // Quick Scan: Pim walks through each file, inspecting each one with scan flashlight
  executeQuickScan() {
    this.restart();
    this.btnQuickScan.disabled = true;

    let index = 0;
    const scanNext = () => {
      if (index >= this.files.length) {
        this.walkTo(this.anchors.idleHome.x, this.anchors.idleHome.y, 1000, () => {
          this.setIdleState();
          this.btnQuickScan.disabled = false;
        });
        return;
      }

      const file = this.files[index];
      this.walkTo(this.anchors.fileRows[index].x, this.anchors.fileRows[index].y, 800, () => {
        this.inspectAction(file, () => {
          index++;
          scanNext();
        });
      });
    };

    scanNext();
  }

  // Preview any single animation state on demand (For Presentation / Evaluation)
  previewState(state) {
    this.clearAllTimers();
    this.lockedModal.classList.remove('open');
    this.completionModal.classList.remove('open');
    this.setCarrying(false);

    switch (state) {
      case 'idle':
        this.setCharPos(this.anchors.idleHome.x, this.anchors.idleHome.y);
        this.setIdleState();
        break;

      case 'walk':
        this.setCharPos(this.anchors.idleHome.x, this.anchors.idleHome.y);
        this.walkTo(this.anchors.fileRows[0].x, this.anchors.fileRows[0].y, 1400, () => {
          this.setIdleState();
        });
        break;

      case 'inspect':
        this.setCharPos(this.anchors.fileRows[1].x, this.anchors.fileRows[1].y);
        this.inspectAction(this.files[1], () => {
          this.setIdleState();
        });
        break;

      case 'lift':
        this.setCharPos(this.anchors.fileRows[0].x, this.anchors.fileRows[0].y);
        this.liftFileAction(this.files[0], () => {
          this.setCarrying(true);
          this.updateStateLabel('lift');
        });
        break;

      case 'strain':
        this.setCharPos(this.anchors.fileRows[4].x, this.anchors.fileRows[4].y);
        this.lockedEncounterSequence();
        break;

      case 'lock':
        this.setCharPos(this.anchors.fileRows[4].x, this.anchors.fileRows[4].y);
        this.updateStateLabel('lock');
        this.setFace('surprised', 'open');
        this.showBubble('alert');
        this.lockedModal.classList.add('open');
        break;

      case 'unlock':
        this.setCharPos(this.anchors.fileRows[4].x, this.anchors.fileRows[4].y);
        this.executeLockedRetryAction();
        break;

      case 'celebrate':
        this.executeCompletionCelebration(true);
        break;
    }
  }

  // ================= UI & EXPLORER HELPERS =================

  selectFile(fileId) {
    this.selectedFileId = fileId;
    const file = this.files.find(f => f.id === fileId);
    if (!file) return;

    // Highlight table row
    document.querySelectorAll('.file-row').forEach(row => {
      row.classList.toggle('selected', parseInt(row.getAttribute('data-id'), 10) === fileId);
    });

    // Update inspector
    this.previewName.textContent = file.name;
    this.previewArtIcon.style.background = file.iconBg;
    this.previewArtIcon.style.color = '#ffffff';
    this.previewArtIcon.textContent = file.icon;

    this.metaType.textContent = file.kind;
    this.metaSize.textContent = file.size;
    this.metaFolder.textContent = file.target.charAt(0).toUpperCase() + file.target.slice(1);
    this.metaStatus.textContent = file.status;
  }

  switchFolderView(folderName) {
    this.activeFolderView = folderName;

    // Update sidebar navigation active pill
    document.querySelectorAll('.sidebar-folder-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-folder') === folderName);
    });

    const titleMap = {
      downloads: 'Downloads',
      documents: 'Documents',
      images: 'Images',
      archive: 'Archive'
    };

    const dispName = titleMap[folderName] || folderName;
    this.windowTitleText.textContent = dispName;
    this.breadcrumbCurrent.textContent = dispName;

    // Filter table rows based on currentFolder
    let visibleCount = 0;
    this.files.forEach(file => {
      const row = document.getElementById(`row-file-${file.id}`);
      if (!row) return;

      if (folderName === 'downloads') {
        row.style.display = 'grid';
        visibleCount++;
      } else {
        const matches = file.currentFolder === folderName;
        row.style.display = matches ? 'grid' : 'none';
        if (matches) visibleCount++;
      }
    });

    this.windowBadgeCount.textContent = `${visibleCount} item${visibleCount === 1 ? '' : 's'}`;
  }

  updateFolderBadges() {
    const counts = { downloads: 0, documents: 0, images: 0, archive: 0 };
    this.files.forEach(f => {
      if (counts[f.currentFolder] !== undefined) {
        counts[f.currentFolder]++;
      }
    });

    this.badgeDownloads.textContent = counts.downloads;
    this.badgeDocuments.textContent = counts.documents;
    this.badgeImages.textContent = counts.images;
    this.badgeArchive.textContent = counts.archive;

    const sortedCount = this.files.filter(f => f.currentFolder !== 'downloads').length;
    const perc = Math.round(68 - sortedCount * 8);
    this.storageBarFill.style.width = `${perc}%`;
    this.storagePercTxt.textContent = `${perc}%`;
  }

  restart() {
    this.clearAllTimers();
    this.btnStartTidy.disabled = false;
    this.btnQuickScan.disabled = false;
    this.lockedModal.classList.remove('open');
    this.completionModal.classList.remove('open');

    // Reset files state
    this.files.forEach(f => {
      f.currentFolder = 'downloads';
      f.status = f.locked ? '🔒 Process Lock' : 'In Downloads';
    });

    document.querySelectorAll('.file-row').forEach(row => {
      row.className = 'file-row';
      row.style.display = 'grid';
    });

    const lockGlyph = document.getElementById('lock-glyph-5');
    if (lockGlyph) lockGlyph.style.stroke = '#ef4444';

    // Reset status pills
    for (let i = 1; i <= 4; i++) {
      const p = document.getElementById(`status-pill-${i}`);
      if (p) {
        p.className = 'file-status-pill';
        p.textContent = 'In Downloads';
      }
    }
    const p5 = document.getElementById('status-pill-5');
    if (p5) {
      p5.className = 'file-status-pill locked';
      p5.textContent = '🔒 Process Lock';
    }

    this.updateFolderBadges();
    this.switchFolderView('downloads');
    this.selectFile(1);

    // Reset Pim
    this.setCharPos(this.anchors.idleHome.x, this.anchors.idleHome.y);
    this.setFacing(1);
    this.setIdleState();
  }
}

// Bootstrap on DOM load
document.addEventListener('DOMContentLoaded', () => {
  window.pimDesk = new PimDesk();
});
