# Thought Trail — Interactive Goal Journey Prototype

An animated frontend experience where a runner journeys through an illustrated park to achieve user goals.

---

## 🌟 Concept & Key Highlights

- **World & Animation-First Experience**: Rather than a standard chatbot or text box, the primary interface is an interactive, multi-layered park environment.
- **Visual Art Direction**:
  - Layered park with atmospheric perspective: morning sky gradient, glowing sun corona, parallax drifting clouds, soaring birds, distant mountain silhouettes, rolling green hills, and deciduous tree clusters.
  - Winding SVG trails with organic curves, trail footsteps, cobblestone textures, and a wooden suspension footbridge over a mountain river gorge.
  - Checkpoint monuments: **Gather** (illuminated stone beacon & satchel), **Draft** (artisan drafting easel & prism inkwell), **Review** (mossy stone gateway & crystal boulder obstacle), and **Finish** (summit pavilion & victory trophy).
  - Responsive layout designed for desktop viewports ($1280 \times 720$ and larger) without clipping, horizontal scrolling, or layout overflow.
  - 100% self-contained and offline-capable: zero external CDN assets, fonts, or APIs.

---

## 🏃 Character Animation System

The runner is built as an articulated SVG rig with individual control over:
- Head, blinking eyelids, expressive eyes (Normal, Surprised, Joyful `^ ^`), and mouth shapes (Smile, Open Gasp, Determined Grimace).
- Torso with explorer vest and backpack.
- Flowing adventurer scarf with follow-through physics.
- Counter-swinging arms with hands.
- Stride-cycling legs with trail boots.
- Dynamic ground shadow scaling with elevation and jumps.
- Trailing dust particle puffs emitted dynamically on stride contact.
- Overhead emote bubble displaying contextual iconography (Idea bulb, Quill, Alert `!`, Wrench, Compass, Uncertainty `?`, Golden Trophy).

### 8 Distinct Animated States

1. **Idle**: Breathing chest expansion, gentle head sway, periodic eye blinking every 3.2s, weight shifts, and relaxed posture.
2. **Running**: Full stride gait using trigonometric cycles, alternating leg extensions, counter-phase arm pumps, torso bounce, forward lean, streaming scarf, and dust puffs.
3. **Checkpoint Arrival**: Smooth deceleration to a halt, turning toward the monument, celebratory arms-up cheer, celebratory hop, and beacon aura pulse.
4. **Obstacle Encounter**: Sudden skid stop with dust burst, recoil with arms flung up, wide-eyed surprise, alert emote `!`, hesitant step back, and thoughtful chin-tap inspection.
5. **Retry / Clear**: Runner rolls up sleeves, enters power stance, physically strains against the boulder, heaves it into the ravine with visual rumble, wipes brow with a triumphant thumbs-up, and sprints down the cleared trail.
6. **Detour**: Runner pivots, spots the upper wooden suspension bridge, displays compass emote, performs an agile leap onto the timber bridge, and scampers across the gorge ridge to the summit.
7. **Failure / Uncertainty**: Runner stumbles, scratches head with dizzy expression, displaying a purple question mark `?`, demonstrating recovery handling.
8. **Completion**: Runner crosses the summit tape, leaps in victory, triggers dual confetti cannon particle physics, and displays the achievement summary modal.

---

## 🚀 Exact Windows 11 Launch Instructions

The prototype is completely self-contained with no node build steps or external dependencies.

### Option 1: Direct Browser Launch (Simplest & Instant)
1. Open Windows File Explorer and navigate to:
   ```
   C:\Users\ritik\Desktop\placement-prep-ai\prototypes\thought-trail\
   ```
2. Double-click `index.html` (or right-click → **Open with** → **Microsoft Edge** or **Google Chrome**).

Alternatively, from PowerShell:
```powershell
Start-Process "prototypes\thought-trail\index.html"
```

### Option 2: Local Python Server (Recommended for Presentations)
Run a local HTTP server in PowerShell:
```powershell
cd C:\Users\ritik\Desktop\placement-prep-ai\prototypes\thought-trail
python -m http.server 8080
```
Open your browser at:
```
http://localhost:8080
```

---

## 🎙️ 60–90 Second Live Presentation Script

**[00:00 - 00:15] Introduction & Concept**
> "Welcome to **Thought Trail**. Instead of asking users to manage tasks through conventional forms or generic chat boxes, Thought Trail turns goal execution into an animated visual journey through an illustrated park. Every milestone on your path is a physical checkpoint the runner must reach."

**[00:15 - 00:35] The Goal & The World**
> "Let's type a goal into the dock — for instance, *'Plan my study week'* — or select one of our quick chips. As I hit *Start Journey*, notice the environment: layered parallax clouds, swaying wildflowers, and an articulated runner whose legs, arms, backpack, and scarf dynamically respond to the winding trail using exact SVG path interpolation."

**[00:35 - 00:55] Checkpoints & The Review Obstacle**
> "The runner reaches **Gather**, collecting notes and syllabi, then ascends toward **Draft** to structure study blocks. As we approach **Review**, the runner spots a quality bottleneck — a fallen mossy boulder blocking the main trail! Notice the sudden skid stop, the wide-eyed surprise reaction, and the inspect pose."

**[00:55 - 01:20] Dual Paths & Choice Demonstration**
> "Here, Thought Trail empowers the user with two deterministic paths:
> 1. If we choose **'Clear the obstacle and retry'**, the runner digs in, physically heaves the boulder aside with dust and rumble, and sprints ahead along the cleared valley trail.
> 2. Alternatively, choosing **'Take the detour'** sends the runner leaping onto the scenic timber suspension bridge above the river gorge, looping around the obstacle."

**[01:20 - 01:30] Finish & Celebration**
> "At the summit, the runner leaps across the victory ribbon, launching an interactive confetti particle system and displaying a completed milestone summary. With instant restart, speed controls, reduced motion support, and offline reliability, Thought Trail makes progress tangible and motivating."

---

## 🎛️ Interactive Controls & Shortcuts

| Control | Description |
|---|---|
| **Goal Input** | Type any custom goal up to 80 characters. |
| **Example Chips** | Instant goal presets (*Study Week*, *Project Update*, *Design Tokens*, *Mock Interview*). |
| **Restart** | Immediately stops all running timelines, cleans up particles, and resets runner to the trailhead. |
| **Speed Toggle** | Cycles playback speed between `1.0x`, `1.5x`, and `0.75x`. |
| **Motion Toggle** | Respects `prefers-reduced-motion` and allows manual toggle of motion effects. |
| **State Inspector (1-8)** | Direct access buttons in the bottom tray to immediately preview any of the 8 character states. |
