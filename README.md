# Clario

Minimal full-stack hackathon starter for **Clario**, an AI-powered file renaming and organization tool.

## Project Structure

- `frontend/` - React + Vite UI
- `backend/` - Node.js + Express API
- `ai/` - AI prompt and analyzer stubs
- `README.md` - setup and run instructions
- `.gitignore` - common local/dev ignores

## Run Locally

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
npm install
node server.js
```

### AI

`ai/analyzer.js` and `ai/prompts.js` are lightweight placeholders for future Claude-powered analysis integration.

## Notes

- Purposefully minimal setup for quick hacking.
- No database, auth, or deployment config included.