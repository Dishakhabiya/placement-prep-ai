# Pim's Desk — Animated Desktop Companion Prototype

A lively interactive frontend prototype where an animated desktop sprite named **Pim** lives inside a computer desktop, physically exploring windows, sorting files, dealing with process locks, and celebrating completed tasks.

---

## 🌟 Creative Vision & Art Direction

- **The Desktop as a Stage**: Rather than a basic chatbot with a static mascot icon, Pim actually inhabits the desktop operating system ("PimOS").
- **Physical Interactions First**: Pim physically approaches file rows, crouches, lifts files into his hands, carries them across the window to the sidebar folders, and drops them in as the folder lids open and badge counts update.
- **Rich Desktop Environment**:
  - macOS/Unix-inspired menu bar with live time, system status, and window controls.
  - Desktop icons (Mac HD, Downloads, Documents, Photos, Trash).
  - Floating sticky note with context and task suggestions from Pim.
  - Interactive file manager with a sidebar, storage usage meter, table rows with file-type badges, and a live Inspector Preview panel.
  - Bottom taskbar dock with app launchers, speed toggle, motion toggle, and a dedicated 8-state inspection tray.
  - 100% self-contained and offline-capable: zero external CDN assets, remote fonts, or APIs.

---

## 🏃 Character Animation System

Pim is implemented as a multi-part articulated SVG rig with:
- **Locomotion**: Sinusoidal stride kinematics, alternating leg extensions, counter-phase arm swings, vertical body bounce, and turning easing (`scaleX(1)` vs `scaleX(-1)`).
- **Physical Hand-Held Carrying**: Lifted files become a physical object (`pim-carried-file-svg`) cradled in Pim's hands, tracking his stride motion across the desktop.
- **Expressive Face & Emotes**: Blinking eyelids (every 3.4s), dynamic eye states (`normal`, `surprised`, `joyful ^ ^`), mouth states (`smile`, `open gasp`, `grimace`), and a comic thought bubble (`scan`, `carry`, `lock 🔒`, `key 🔑`, `alert !`, `trophy 🏆`).

### 8 Distinct Animated States

1. **Idle**: Natural breathing chest expansion, head tilts, subtle weight shifts, and automatic eye blinks.
2. **Walk / Jog**: Stride cycle with leg rotation, arm pumps, and double-frequency torso bounce.
3. **Inspect**: Forward lean, head tilt, and magnifying glass scan bubble examining file metadata.
4. **Lift & Carry**: Deep knee bend, reach, grip, and transition into carrying pose with a physical document in hand.
5. **Strain / Pull**: Heels dug in, backward lean, trembling vibration, and grimace as Pim encounters the process lock.
6. **Locked Encounter**: Recoil with arms flung wide, alert exclamation bubble `!`, and opening of the interactive decision dialog.
7. **Key Unlock / Retry**: Golden skeleton key reveal, lock-tap sparkle, process release, and confident carry to Documents.
8. **Celebrate**: Victory leap on the celebration dais, trophy emote, arms held high, and achievement summary dialog.

---

## 🚀 Exact Windows PowerShell Launch Commands

The prototype requires no build step, node modules, or external internet access.

### Launch Local HTTP Server on Port 8081 (Recommended)
Open Windows PowerShell:
```powershell
cd C:\Users\ritik\Desktop\placement-prep-ai\prototypes\pim-desk
python -m http.server 8081
```
Open your browser at:
```
http://localhost:8081
```

### Direct Browser File Launch (Alternative)
```powershell
Start-Process "prototypes\pim-desk\index.html"
```

---

## 🎙️ 60–90 Second Faculty Presentation Script

**[00:00 - 00:15] Introduction & Concept**
> "Good morning. This is **Pim's Desk**. Traditional AI companions are almost always trapped in a floating chatbot panel next to a text box. In Pim's Desk, we asked: what if an AI assistant actually *lived* inside your desktop and physically organized your digital workspace?"

**[00:15 - 00:35] The Living Stage & Physical Sorting**
> "Here on our desktop, we see our file manager with an overflowing Downloads folder. Notice Pim idling naturally at the desk. As I click **'Tidy my Downloads folder'**, Pim sets to work. Notice the physical interaction: Pim walks to `lecture-notes.pdf`, inspects it, crouches, scoops the file into his hands, and carries it across to the Documents folder. The folder reacts, accepts the file, and increments its badge."

**[00:35 - 00:55] Personality & Variation**
> "Pim moves from item to item: photos go to Images with a camera sparkle, spreadsheets go to Archive. The timing, facial expressions, and body language vary with each file, giving Pim a curious, enthusiastic personality."

**[00:55 - 01:20] The Locked-File Encounter**
> "At row 5, Pim attempts to lift `thesis_final_FINAL2.docx`. Watch his reaction: the file is locked by a running process! Pim strains, trembles, recoils in surprise, and steps back to report the problem. The user is offered two clear choices:
> 1. If we choose **'Retry with Force'**, Pim taps the lock with his golden admin key, breaks the process hold, and triumphantly delivers the thesis to Documents.
> 2. Alternatively, choosing **'Leave it untouched'** allows Pim to safely preserve the in-use file in Downloads."

**[01:20 - 01:35] Completion & Determinism**
> "At completion, Pim takes center stage with a victory dance and a summary of files sorted. Every control — from sidebar folder filtering, inspector preview updates, speed toggles, to the state inspector tray — is fully functional, deterministic, and offline-capable."

---

## 🎛️ Interactive Controls & Shortcuts

| Control | Action |
|---|---|
| **Tidy my Downloads folder** | Runs the full 5-file physical sorting sequence. |
| **Quick Scan** | Pim patrols across all rows with a scanning lens, previewing each file in the Inspector. |
| **Reset Files / Restart** | Instantly aborts any active sequence via monotonic `runId` and returns the desktop to initial state. |
| **File Row Click** | Selects any file row and updates the right Inspector panel with type, size, target, and status. |
| **Sidebar Folder Click** | Filters table view to show files currently located in Downloads, Documents, Images, or Archive. |
| **Pim States (1–8)** | Bottom tray pills allowing evaluators to immediately trigger and observe any of the 8 character states. |
| **Speed Toggle** | Cycles animation playback rate (`1.0x`, `1.5x`, `0.75x`). |
| **Motion Toggle** | Toggles reduced-motion mode (also respects OS `prefers-reduced-motion`). |
