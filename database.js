/**
 * PrepAI - SQLite Storage using better-sqlite3
 * Persists candidate practice history and scores.
 */
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'prepai.db');
const db = new Database(dbPath);

// Enable WAL mode for high concurrency
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id TEXT,
    question TEXT NOT NULL,
    category TEXT,
    answer TEXT NOT NULL,
    coach_reply TEXT NOT NULL,
    scores TEXT NOT NULL, -- JSON
    tips TEXT NOT NULL,   -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const insertAttemptStmt = db.prepare(`
  INSERT INTO history (question_id, question, category, answer, coach_reply, scores, tips)
  VALUES (@question_id, @question, @category, @answer, @coach_reply, @scores, @tips)
`);

const selectHistoryStmt = db.prepare(`
  SELECT id, question_id, question, category, answer, coach_reply, scores, tips, created_at
  FROM history
  ORDER BY id DESC
  LIMIT ?
`);

const selectByIdStmt = db.prepare(`
  SELECT id, question_id, question, category, answer, coach_reply, scores, tips, created_at
  FROM history
  WHERE id = ?
`);

const deleteByIdStmt = db.prepare(`
  DELETE FROM history WHERE id = ?
`);

const clearAllStmt = db.prepare(`
  DELETE FROM history
`);

function saveAttempt({ questionId, question, category, answer, coach_reply, scores, tips }) {
  const info = insertAttemptStmt.run({
    question_id: questionId || 'custom',
    question: question || 'Untitled question',
    category: category || 'Practice',
    answer: answer || '',
    coach_reply: coach_reply || '',
    scores: JSON.stringify(scores || []),
    tips: JSON.stringify(tips || [])
  });
  return info.lastInsertRowid;
}

function getHistory(limit = 50) {
  const rows = selectHistoryStmt.all(limit);
  return rows.map(row => {
    let scores = [];
    let tips = [];
    try { scores = JSON.parse(row.scores); } catch (e) {}
    try { tips = JSON.parse(row.tips); } catch (e) {}
    return {
      ...row,
      scores,
      tips
    };
  });
}

function getAttemptById(id) {
  const row = selectByIdStmt.get(id);
  if (!row) return null;
  let scores = [];
  let tips = [];
  try { scores = JSON.parse(row.scores); } catch (e) {}
  try { tips = JSON.parse(row.tips); } catch (e) {}
  return { ...row, scores, tips };
}

function deleteAttempt(id) {
  return deleteByIdStmt.run(id);
}

function clearHistory() {
  return clearAllStmt.run();
}

module.exports = {
  db,
  saveAttempt,
  getHistory,
  getAttemptById,
  deleteAttempt,
  clearHistory
};
