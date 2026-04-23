// Stub analyzer for local development; replace with real AI calls later.
function analyzeFile(fileInfo) {
  void fileInfo; // Placeholder until real file data handling is added.

  return {
    new_name: "example_file.pdf",
    category: "General",
    summary: "Sample summary",
    confidence: 0.9,
  };
}

module.exports = {
  analyzeFile,
};
