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

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
