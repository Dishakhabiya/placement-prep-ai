#!/usr/bin/env bash
set -e

# Resolve script directory regardless of working directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Ensure Python virtual environment exists
if [ ! -d ".venv" ]; then
  echo "Virtual environment not found. Creating .venv..."
  python3 -m venv .venv
fi

# Activate virtual environment
source .venv/bin/activate

# Install / update dependencies ensuring edge-tts >= 7.3.1
echo "Checking backend dependencies..."
pip install -r requirements.txt

# Ensure spaCy model is downloaded
python -c "import spacy; spacy.load('en_core_web_sm')" 2>/dev/null || python -m spacy download en_core_web_sm

# Launch FastAPI using virtualenv python
PORT="${PORT:-8000}"
echo "Starting backend server on port $PORT using .venv..."
exec python -m uvicorn main:app --host 0.0.0.0 --port "$PORT" --reload
