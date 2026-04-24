# Clario

AI-powered file organizer that understands file content, discovers semantic relationships across mixed file types, and structures them into meaningful folders automatically.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     Frontend                         │
│  File validation → Content extraction → ZIP builder  │
└────────────────────────┬────────────────────────────┘
                         │
              POST /analyze + POST /organize
                         │
┌────────────────────────▼────────────────────────────┐
│                     Backend                          │
│         Pass 1 (per-file) → Pass 2 (batch)           │
└────────────────────────┬────────────────────────────┘
                         │
              Anthropic v1/messages API
                         │
┌────────────────────────▼────────────────────────────┐
│                 Claude Sonnet                         │
│      File understanding + Semantic clustering         │
└─────────────────────────────────────────────────────┘
```

## End-to-End Flow

**1. Upload & Validation (Frontend)**
- Validates file type, size (max 10MB), count (max 10), duplicates, and empty files
- Extracts content client-side:
  - PDF → `pdfjs-dist`
  - DOC/DOCX → `mammoth`
  - XLSX/CSV → `xlsx`
  - JSON/HTML/XML/TXT/MD → raw text
  - Images → base64

**2. Pass 1 — Per-file Understanding (`POST /analyze`)**
- Each file sent individually to Claude via `PASS1_FILE_UNDERSTANDING_PROMPT`
- Images preprocessed with `sharp` (GIF first frame, BMP/TIFF → PNG) before Claude Vision
- Claude returns strict JSON per file:
  `new_name`, `category`, `summary`, `confidence`, `reasoning`, `keywords`, `entities`, `scene_description`
- Retry + timeout wrapper on every API call
- Fallback to rule-based analysis if Claude fails

**3. Pass 2 — Semantic Clustering (`POST /organize`)**
- All Pass 1 summaries sent together in one prompt via `PASS2_BATCH_GROUPING_PROMPT`
- `temperature: 0` for deterministic, repeatable grouping
- Claude groups files by content and purpose — never by filename or person name
- Backend normalizes folder names, merges duplicate buckets, sorts for stability
- Fallback to heuristic grouping if Claude fails

**4. ZIP Download (Frontend)**
- Folder tree preview and ZIP use identical folder mapping
- JSZip builds one-level structure only: `zip-name/folder/file`
- Original `lastModified` timestamps preserved per file
- Default ZIP name: `clario-{month}{day}-{year}.zip` (user-editable before download)

## Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, JSX, CSS |
| Backend | Node.js, Express, nodemon |
| AI | Anthropic Claude `claude-sonnet-4-20250514` |
| Document parsing | pdfjs-dist, mammoth, xlsx |
| Image processing | sharp |
| File output | JSZip |
| Notifications | react-hot-toast |

## Supported File Types

**Documents:** `.pdf` `.txt` `.md` `.docx` `.doc` `.xlsx` `.csv` `.json` `.html` `.xml`

**Images:** `.jpg` `.jpeg` `.png` `.webp` `.gif` `.bmp` `.tiff`

## Getting Started

### Prerequisites
- Node.js 18+
- Anthropic API key

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
npm run dev
```

### Environment Variables

Create `backend/.env`:
```
CLAUDE_API_KEY=your_anthropic_api_key
CLAUDE_MODEL=claude-sonnet-4-20250514
USE_LLM_ANALYZER=true
```

> If `CLAUDE_API_KEY` is missing, backend falls back to rule-based analysis.
> If the configured model returns a 404, backend automatically tries fallback model candidates.

## Constraints

- Maximum 10 files per batch
- Maximum 10MB per file
- ZIP structure is strictly one level deep

## Roadmap

- Persistent folder memory across sessions
- Incremental organization — merge new files into existing folder structures
- Google Drive and Dropbox integration
- User-defined organization rules