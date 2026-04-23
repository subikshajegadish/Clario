# Clario Implementation Log

This document tracks all meaningful project changes implemented so far.
I will keep updating this file as we add/fix features.

## Last Updated

- Date: 2026-04-23
- Scope: Initial scaffold + frontend demo UI + backend API expansion + AI mock foundation + sanity checks

## 1) Project Scaffold

- Created root structure:
  - `frontend/`
  - `backend/`
  - `ai/`
  - `README.md`
  - `.gitignore`
- Added root `.gitignore` with common ignores:
  - `node_modules/`, `dist/`, `build/`
  - `.env`, `.env.*`
  - `*.zip`
  - temp/log/editor files
- Updated root `README.md` with local run instructions.

## 2) Frontend (React + Vite)

### Setup

- Initialized React app with Vite in `frontend/` (JavaScript, no TypeScript app files).
- Installed frontend dependencies and validated scripts.

### UI implemented

- Replaced starter page with a demo-ready Clario UI in `frontend/src/App.jsx`:
  - Title: `Clario`
  - Subtitle: `AI-powered file organizer`
  - Drag-and-drop style upload area
  - `Analyze Files` button
  - `Before` section
  - `After` section
  - `Folder Tree Preview` section
- Added reusable components:
  - `frontend/src/components/UploadBox.jsx`
  - `frontend/src/components/FileList.jsx`
  - `frontend/src/components/AnalysisResults.jsx`
  - `frontend/src/components/FolderTree.jsx`
- Added minimal modern styling in:
  - `frontend/src/App.css`
  - `frontend/src/index.css`

### Frontend validation

- `npm install` works in `frontend/`
- `npm run dev` works (Vite dev server)
- `npm run lint` passes
- `npm run build` passes
- Confirmed no `.ts` / `.tsx` files in app source.

## 3) Backend (Node + Express)

### Setup

- Initialized backend in `backend/`
- Added dependencies:
  - `express`
  - `cors`
- Added server entry:
  - `backend/server.js`
- Updated `backend/package.json`:
  - `"main": "server.js"`
  - `"start": "node server.js"`

### Routes implemented

- `GET /health`
  - Returns `{ "status": "ok" }`
- `POST /analyze`
  - Accepts payload with `files` and `mode`
  - Returns mock structured analysis with:
    - `new_name`
    - `category`
    - `summary`
    - `confidence`
    - `reasoning`
- `POST /organize`
  - Accepts `analyzed_files`
  - Returns folder structure preview grouped by category

### Backend organization

- Added `backend/services/mockAi.js` to keep mock logic separate from route handlers.
- Kept route handlers minimal with basic payload validation.

### Backend validation

- `npm install` works in `backend/`
- `node server.js` runs successfully on port `3001`
- Verified endpoint responses:
  - `GET /health` returns expected JSON
  - `POST /analyze` returns valid mock structured JSON
  - `POST /organize` returns valid preview JSON

## 4) AI Logic Foundation (`ai/`)

### Files added/updated

- `ai/analyzer.js`
- `ai/prompts.js`
- `ai/schema.js` (optional response schema contract)

### Analyzer behavior

- Exported function:
  - `analyzeFile(fileName, extractedText, fileType, mode)`
- Output shape:
  - `new_name`
  - `category`
  - `summary`
  - `confidence`
  - `reasoning`
- Supported modes:
  - `general`
  - `school`
  - `job-search`
- Realistic mock patterns handled:
  - resume
  - lecture notes
  - receipt
  - screenshot
  - random PDF fallback

### Prompt foundation

- Added strong Claude-oriented system prompt in `ai/prompts.js` for future integration.
- Prompt enforces clean naming, meaningful categories, short summary, and explicit reasoning in strict JSON format.

## 5) Sanity Check Status

Current status is healthy and demo-ready:

- Frontend runs without errors.
- Backend runs without errors.
- `/health` responds correctly.
- `/analyze` responds with valid structured JSON.
- AI analyzer export and structure are valid.

## 6) Frontend API Config

- Added `frontend/src/config.js` with:
  - `API_BASE_URL = "http://localhost:3001"`
- Purpose:
  - Keep backend URL centralized and avoid hardcoded API strings in components/services.
- Follow-up:
  - All upcoming frontend API calls should import `API_BASE_URL` from this file.

## 7) Frontend -> Backend Analyze Integration

- Connected `Analyze Files` button in `frontend/src/App.jsx` to call:
  - `POST ${API_BASE_URL}/analyze`
- Added hardcoded request payload for now:
  - `resume_final.pdf`
  - `notes_ds.pdf`
  - mode: `general`
- Added React state for:
  - `analysisResults`
  - `isLoading`
  - `error`
- Added loading UX:
  - Button text changes to `Analyzing...`
  - Button disabled while request is in flight
- Added basic error handling:
  - Displays an inline error message if request fails
- Updated `After` rendering in `frontend/src/components/AnalysisResults.jsx` to show:
  - original file name
  - new name
  - category
  - summary
  - confidence
  - reasoning
- Updated folder preview logic:
  - `Folder Tree Preview` is now generated from API analysis results by category
- Validation:
  - `npm run lint` passes
  - `npm run build` passes

## 8) Frontend -> Backend Organize Integration

- Extended `frontend/src/App.jsx` so the flow is now:
  1. Call `POST ${API_BASE_URL}/analyze`
  2. Send returned `results` to `POST ${API_BASE_URL}/organize`
- Added state to store backend-generated folder preview:
  - `folderTreeData`
- Folder Tree Preview now renders backend output (instead of only frontend-derived grouping).
- Added simple normalization helper to map backend preview shape to `FolderTree` component shape.
- Error handling now covers either step (`/analyze` or `/organize`) and clears stale preview state on failure.
- Kept single loading state for a clean UX while both requests run.
- Validation:
  - `npm run lint` passes
  - `npm run build` passes

## 9) Real File Selection in Frontend

- Replaced hardcoded frontend file list with real browser file selection.
- Updated `frontend/src/components/UploadBox.jsx`:
  - Added standard `<input type="file" multiple />`
  - Emits selected files to parent via `onFilesSelected`
- Updated `frontend/src/App.jsx`:
  - Added `selectedFiles` React state
  - Before section now renders selected file names from state
  - Analyze payload is now built from selected files
  - Added placeholder text mapping per filename:
    - includes `resume` -> `"Software engineering resume content"`
    - includes `notes` -> `"Distributed systems lecture notes"`
    - otherwise -> `"General document content"`
  - Preserved analyze -> organize chaining and existing loading/error handling
  - Added guard error when Analyze is clicked with no selected files
- Updated `frontend/src/components/FileList.jsx`:
  - Shows a friendly message when no files are selected
- Validation:
  - `npm run lint` passes
  - `npm run build` passes

## 10) Improved AI Mock Analyzer Realism

- Upgraded `ai/analyzer.js` to produce more varied, believable outputs based on:
  - filename keywords
  - placeholder extracted text
  - file type / extension
  - selected mode (`general`, `school`, `job-search`)
- Cases explicitly covered with unique output behavior:
  - resume / cv
  - lecture notes / class notes
  - receipt / invoice
  - screenshot / image
  - generic fallback documents
- Mode-sensitive behavior now includes:
  - `school`: more specific academic categories like `Course Notes`
  - `job-search`: career-focused categories like `Job Applications` and `Job Search Expenses`
  - `general`: broader default categorization
- Preserved response contract:
  - `new_name`, `category`, `summary`, `confidence`, `reasoning`
- Added/kept clear comments around decision logic for easier future AI replacement.
- Validation:
  - Ran local Node sanity checks across all required cases and confirmed varied outputs.
