import os
import sys

# Ensure backend root is in Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db import init_db
from routers.profile import router as profile_router
from routers.questions import router as questions_router
from routers.answers import router as answers_router
from routers.chat import router as chat_router



@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize SQLite tables
    init_db()
    yield
    # Shutdown: Clean up if needed


app = FastAPI(
    title="Module 1: Resume & Job Description Intelligence API",
    description="AI-Powered Placement Interview & Speaking Assistant - Person 1 Module",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration for local development (React Native Expo, iOS Simulator, Android Emulator, Web)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register endpoints
app.include_router(profile_router)
app.include_router(questions_router)
app.include_router(answers_router)
app.include_router(chat_router)



@app.get("/")
def root():
    return {
        "message": "Placement Prep AI - Module 1: Resume & JD Intelligence API is running.",
        "docs_url": "/docs",
        "health_url": "/api/health"
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
