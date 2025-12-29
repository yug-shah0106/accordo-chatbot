# Quick Setup Guide

## Required Environment Files

### Backend `.env` (create in `backend/.env`)

```bash
PORT=4000
DATABASE_URL=postgresql://accordo:accordo@localhost:5432/accordo_mvp
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
```

### Frontend `.env` (create in `frontend/.env`)

```bash
VITE_API_BASE_URL=http://localhost:4000/api
```

## Setup Steps

1. **Start PostgreSQL:**
   ```bash
   docker compose up -d
   ```

2. **Run Database Migration:**
   ```bash
   cd backend
   npm run migrate
   ```

3. **Install & Start Ollama:**
   ```bash
   # Install Ollama (if needed)
   # macOS: brew install ollama
   # Or download from https://ollama.ai
   
   # Pull model
   ollama pull llama3.1
   
   # Verify running
   curl http://localhost:11434/api/tags
   ```

4. **Start Backend:**
   ```bash
   cd backend
   npm run dev
   ```

5. **Start Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

6. **Open Browser:**
   Navigate to `http://localhost:5173`

## Verification

- Backend health: `curl http://localhost:4000/health`
- Database: Check `docker ps` shows `accordo_db` running
- Ollama: `curl http://localhost:11434/api/tags` returns model list

