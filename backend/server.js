// Minimal Express server for Clario's backend API.
const express = require("express");
const cors = require("cors");

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

// Placeholder analyze route for wiring frontend-backend flow during the hackathon.
app.post("/analyze", (req, res) => {
  void req.body; // Reserved for future file metadata payload.

  res.json({
    new_name: "example_file.pdf",
    category: "General",
    summary: "Sample summary",
    confidence: 0.9,
  });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
