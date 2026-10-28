# Thinking Podcast — Premium Animated Chatbot Prototype

An interactive miniature podcast studio prototype where three animated AI hosts — **Nova (The Strategist)**, **Pixel (The Creative)**, and **Echo (The Critic)** — debate, stress-test, and synthesize recommendations for user requests in real time.

---

## 🎙️ Creative Concept & Visual Direction

- **Living Studio Over Chat Panels**: Instead of a traditional single-chatbot message feed, the interface presents a richly illustrated broadcast studio with three distinct hosts seated at a curved conference table with boom microphones, headphones, mixing consoles, acoustic sound baffles, and neon mood lighting.
- **Three Unique Personalities**:
  - **Nova (The Strategist)**: Analytical, structured, composed. Taps her digital tablet, makes structured hand gestures, and establishes foundational milestone plans.
  - **Pixel (The Creative)**: Energetic, curious, expressive. Leans forward with both elbows on the desk, waving hands with eureka enthusiasm, proposing gamified and unconventional solutions.
  - **Echo (The Critic)**: Witty, perceptive, skeptical. Sips his coffee mug, raises an eyebrow, taps his console, stress-tests assumptions for burnout and real-world failure modes, and nods with genuine respect when a balanced consensus is achieved.
- **Strict Zero-Overflow Transcript Architecture**:
  - The studio viewport and the discussion transcript live side-by-side in a constrained grid layout.
  - The transcript feed is bounded with internal smooth scrolling, `min-width: 0`, and `overflow-wrap: anywhere`, guaranteeing that long words, custom prompts, and extensive debate dialogue wrap cleanly without ever clipping or escaping the panel.
  - The three hosts remain 100% visible throughout the entire conversation.
- **100% Offline & Self-Contained**: Zero external CDN assets, remote fonts, API keys, or network dependencies.

---

## 🏃 Character Animation System

Each host is an articulated multi-part SVG rig featuring:
- **Asynchronous Idle Breathing**: Nova (3.2s cadence), Pixel (2.4s cadence), and Echo (3.8s cadence) breathe at different sinus frequencies to ensure natural, lifelike studio presence.
- **Decoupled Eye Blinking**: Each character blinks independently on randomized cycles.
- **Context-Aware Speaker Tracking**: When one host speaks, the other two turn their heads and gaze toward the speaker.
- **Phoneme Cadence & Gesturing**: The active speaker's mouth alternates speaking shapes synchronized with debate cadence, their boom mic indicator ring glows, their active speaker spotlight illuminates, and their limbs gesture according to their personality.
- **Sound-Reactive Visual VU Meters**: Studio mixer LED meters and header equalizer spectrum bars bounce dynamically during speech turns.

### 10 Studio Interface States

1. **Idle Studio**: Ambient breathing, decoupled blinking, and waiting studio lights.
2. **Request In**: User goal registered, topic displayed on studio monitor and transcript.
3. **Nova Speaks**: Nova establishes the structured milestone framework with analytical hand gestures.
4. **Pixel Responds**: Pixel brings creative flair and energetic hand waves, proposing an unorthodox angle.
5. **Echo Challenges**: Echo raises a skeptical eyebrow, sips from his mug, and stress-tests feasibility.
6. **Deep Debate**: Tri-host convergence where Nova addresses Echo's critique and Pixel integrates solutions.
7. **Recommendations Ready**: Three distinct host recommendation cards appear alongside a synthesis option.
8. **User Choice**: Host responds directly with tailored guidance for the selected approach.
9. **Combined Cheer**: All three hosts celebrate in unison with victory poses and synchronized praise.
10. **New Request**: Safe state reset via monotonic `runId` cancellation.

---

## 🚀 Exact Windows PowerShell Launch Commands (Port 8082)

The prototype requires no build steps or npm installations.

### Launch Local HTTP Server on Port 8082 (Recommended)
Open Windows PowerShell:
```powershell
cd C:\Users\ritik\Desktop\placement-prep-ai\prototypes\thinking-podcast
python -m http.server 8082
```
Open your browser at:
```
http://localhost:8082
```

### Direct Browser File Launch (Alternative)
```powershell
Start-Process "prototypes\thinking-podcast\index.html"
```

---

## 🎙️ 60–90 Second Faculty Presentation Script

**[00:00 - 00:15] Introduction & Concept**
> "Good morning. This is **Thinking Podcast**. Most AI conversational interfaces collapse multi-agent thinking into a single flat text stream. In Thinking Podcast, we bring multi-perspective reasoning to life inside an animated miniature broadcast studio featuring three distinct hosts."

**[00:15 - 00:35] The Hosts & The Studio**
> "On the left is **Nova, The Strategist**; in the center is **Pixel, The Creative**; and on the right is **Echo, The Critic**. Notice the asynchronous idle animations: each host breathes at their own natural cadence, blinks independently, and reacts to their surroundings. As I submit our request — *'Help me plan a productive study week'* — the studio lights engage, the 'ON AIR' sign pulses, and the discussion begins."

**[00:35 - 00:55] Dynamic Debate & Cross-Speaker Interaction**
> "Notice how the hosts interact: Nova opens with a structured deep-work matrix. Her boom mic illuminates, and her equalizer bounces. As she finishes, Pixel leaps in with an energetic creative pivot, waving her hands. Then Echo raises a skeptical eyebrow, sips his coffee, and points out the flaw: where is the buffer for when Thursday falls apart? Look at Nova and Pixel: they visibly turn their heads to listen and adapt to the critique."

**[00:55 - 01:20] Non-Overflowing Transcript & User Decision**
> "Throughout the entire discussion, our transcript on the right wraps seamlessly with zero text escaping or clipping. Now, three distinct recommendation cards appear: Nova's structured plan, Pixel's creative quest, or Echo's defensive buffer. Let's click **'Tri-Host Master Synthesis'** — watch all three hosts celebrate with victory gestures, uniting their strategies into an airtight solution."

**[01:20 - 01:35] Reliability & Polish**
> "With speed toggles, reduced motion support, silent visual audio meters, and instant state preview pills, Thinking Podcast makes multi-agent deliberation engaging, transparent, and memorable."

---

## 🎛️ Interactive Controls & Shortcuts

| Control | Description |
|---|---|
| **Prompt Input & Examples** | Enter any custom request or click preset chips (*Study Week*, *Final Project*, *Tech Interview*, *Daily Routine*). |
| **Recommendation Cards** | Interactive buttons for Nova's Roadmap, Pixel's Sprint, Echo's Model, or Tri-Host Synthesis. |
| **Speed Toggle** | Changes discussion pacing (`1.0x`, `1.5x`, `0.75x`). |
| **Motion Toggle** | Toggles motion effects (also respects OS `prefers-reduced-motion`). |
| **Audio Toggle** | Toggles soft studio audio chime synthesizers (defaults to muted). |
| **Reset Button** | Safely aborts any running discussion using monotonic `runId` cancellation. |
| **State Inspector (1–10)** | Bottom tray pills allowing instant preview of any of the 10 studio states. |
