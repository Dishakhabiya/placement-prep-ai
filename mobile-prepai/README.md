# PrepAI UI

Redesigned desktop-first & responsive home / "Practise" screen for Placement Prep AI. Built with React Native & Expo SDK 57, featuring a warm cream & teal palette, an energetic orange accent, Fraunces + DM Sans typography, and fluid micro-animations powered by the native `Animated` API.

---

## 🎨 Design System & Palette

- **Light Mode:**
  - Background: `#FBF3E4` (warm cream)
  - Ink / Text: `#0B3B4A` (deep teal)
  - Card: `#FFFFFF` (pure white)
  - Soft / Badge: `#F3E4C6` (soft wheat)
  - Muted: `#4F7480` (slate teal)
  - Line: `rgba(11, 59, 74, 0.13)`
  - Accent: `#FF6F2C` (energetic orange)
- **Dark Mode:**
  - Background: `#082C38`
  - Ink / Text: `#F7E6C8`
  - Card: `#0F4655`
  - Soft / Badge: `#14586A`
  - Muted: `#9BC0C7`
  - Line: `rgba(247, 230, 200, 0.15)`
  - Accent: `#FF6F2C`
- **Typography:**
  - **Fraunces (700 Bold & 900 Black)** for headings, Q-numbers, and card questions.
  - **DM Sans (400 Regular, 500 Medium, 700 Bold)** for UI text, buttons, and captions.

---

## ⚡ Features & Micro-Animations

1. **Drifting Background Blobs:** Two radial-gradient soft SVG circles drifting slowly in an infinite loop.
2. **TopBar:**
   - Brand logo "PrepAI" with a hopping orange dot (`.`).
   - Center pill navigation tabs: *Practise* (active), *History*, and *Saved*.
   - 3-day streak badge with a gently pulsing orange dot.
   - Dark/Light mode toggle switch.
3. **HeroPanel:**
   - Eyebrow "YOUR INTERVIEW COACH" with letter-spacing.
   - H1 "What shall we practise today?" with individual animated word entrance reveals.
   - Animated `MascotSvg` (floating with subtle tilt, eyes blinking every 4s, headphones nodding).
   - 11-bar responsive `Waveform` (staggered idle breathing wave; rapid energetic movement when listening).
   - 88px `MicButton` with dual pulsing ripple rings and breathing scale. Toggles listening state and turns cream with an ink microphone.
   - Pill `InputBar` with cycling placeholders every 3.2s, orange focus ring, and cream send button.
4. **Cards (2x2 Grid / Responsive Stack):**
   - Q1: *“Tell me about yourself.”* (Intro)
   - Q2: *“What are your biggest strengths and weaknesses?”* (Self-awareness)
   - Q3: *“What should I ask the interviewer?”* (Your turn)
   - **RandomCard:** *“Surprise me”* with 5-dot SVG dice. Spins 360° on hover; on click, tumbles 720° while cycling through questions before settling on one.
   - Cards lift 8px with alternating ±1.2° tilt and soft shadow on hover/press; arrow slides 6px right.
5. **QuestionMarquee:**
   - Seamless horizontal marquee with 32s linear loop, pausing on hover.
   - Left and right gradient fade masks.
6. **Toast Notification:**
   - Slides up from bottom when any question, card, or query is triggered; auto-hides after ~2.3s.

---

## 🚀 Running the App

### 1. Installation
From the repository root:
```bash
cd mobile-prepai
npm install
```

### 2. Development Server (Web on Port 8083)
```bash
npm run web
```
The app will open at:
**[http://localhost:8083](http://localhost:8083)**

### 3. Native (iOS / Android)
```bash
npm run ios
npm run android
```

---

## 📁 Project Structure

```text
mobile-prepai/
├── App.js                         # Root entry with fonts, ThemeProvider, Navigation
├── app.json                       # Expo configuration (renamed to "PrepAI UI")
├── babel.config.js
├── index.js                       # Primary entry registering App.js
├── metro.config.js
├── package.json                   # Scripts configured for port 8083
├── README.md
└── src/
    ├── components/
    │   ├── BackgroundBlobs.js     # Drifting radial gradient SVG circles
    │   ├── HeroPanel.js           # Left hero panel with animated H1 and controls
    │   ├── InputBar.js            # Pill text input with rotating placeholders
    │   ├── MascotSvg.js           # Animated mascot with blinking eyes & nodding headphones
    │   ├── MicButton.js           # 88px mic button with ripple rings & breathing animation
    │   ├── QuestionCard.js        # Q1/Q2/Q3 cards with hover lift, tilt & arrow slide
    │   ├── QuestionMarquee.js     # 32s endless horizontal scroll strip with gradient masks
    │   ├── RandomCard.js          # Orange surprise card with tumbling 3D dice roll
    │   ├── Toast.js               # Slide-up notification alert
    │   ├── TopBar.js              # Logo, pill tabs, streak badge, and theme toggle
    │   └── Waveform.js            # 11 rounded bars with idle and listening wave animation
    ├── data/
    │   └── questions.js           # Practice, marquee, and random questions data
    ├── screens/
    │   ├── HistoryPlaceholderScreen.js
    │   ├── HomeScreen.js          # Responsive home screen (wide >=940 2-col, narrow 1-col)
    │   └── SavedPlaceholderScreen.js
    ├── services/
    │   └── api.js                 # Backend integration stubs (ready for FastAPI)
    ├── store/
    │   └── useUiStore.js          # Zustand store for listening, toast, selected questions
    └── theme/
        ├── index.js
        ├── ThemeProvider.js       # Light/Dark context provider with useTheme hook
        └── tokens.js              # Color palette, Fraunces/DM Sans typography & radii
```
