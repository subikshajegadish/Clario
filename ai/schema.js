// Optional schema constants to keep response shape explicit across the app.
const ANALYSIS_RESPONSE_SCHEMA = {
  new_name: "string",
  category: "string",
  summary: "string",
  confidence: "number (0 to 1)",
  reasoning: "string",
};

module.exports = {
  ANALYSIS_RESPONSE_SCHEMA,
};
