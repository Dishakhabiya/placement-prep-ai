# PrepAI Desktop — Interview Coach Web App (Port 8085)

A standalone desktop interview coach web application matching the `prepai-desktop.html` design (teal/cream/orange theme, Fraunces + DM Sans fonts), powered by Node.js + Express and Anthropic API integration.

---

## 🚀 Setup & Running

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```
Add your Anthropic API key in `.env`:
```env
PORT=8085
ANTHROPIC_API_KEY=your_key_here
```

### 3. Start the Server
```bash
npm start
```

Open your browser at: **[http://localhost:8085](http://localhost:8085)**

---

## 🌐 API Endpoints

- `GET /api/questions`: Returns question cards (Q1 Intro, Q2 Self-awareness, Q3 Your turn).
- `GET /api/random-question`: Returns a random question from the pool of 10 interview questions.
- `POST /api/coach`: Analyzes `{ question, answer }` using Claude (`claude-sonnet-4-6`) and returns `{ score, strengths, improvements, sampleAnswer }`.
- `GET /api/history`: Returns the last 20 practice sessions saved in `history.json`.
- `POST /api/history`: Appends a practice entry to `history.json`.
