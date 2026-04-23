// Minimal Express server for Clario's backend API.
const express = require("express");
const cors = require("cors");
const { analyzeFiles, buildFolderPreview } = require("./services/mockAi");

const app = express();
const PORT = 3001;

// Enable CORS for local frontend-backend communication.
app.use(cors());

// Parse incoming JSON payloads.
app.use(express.json());

// Basic health check endpoint to verify server is running.
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Analyze route: accepts files and auto-detects themes per file.
app.post("/analyze", async (req, res) => {
  const { files = [] } = req.body;

  if (!Array.isArray(files)) {
    return res.status(400).json({
      error: "Invalid payload. 'files' must be an array.",
    });
  }

  try {
    const analysis = await analyzeFiles(files);
    return res.json({
      count: analysis.length,
      results: analysis,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to analyze files.",
      details: error.message,
    });
  }
});

// Organize route: accepts analyzed files and returns folder tree preview.
app.post("/organize", (req, res) => {
  const { analyzed_files: analyzedFiles = [] } = req.body;

  if (!Array.isArray(analyzedFiles)) {
    return res.status(400).json({
      error: "Invalid payload. 'analyzed_files' must be an array.",
    });
  }

  const preview = buildFolderPreview(analyzedFiles);

  return res.json({
    status: "ok",
    preview,
  });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});