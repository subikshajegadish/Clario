// Centralized analyzer service for backend /analyze.
// Keeps rule-based analysis as a reliable fallback and adds an LLM-ready interface.
const { FILE_ANALYSIS_SYSTEM_PROMPT } = require("./llmPrompt");

function toSlug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getExtension(fileName = "") {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "txt";
}

const CATEGORY_RULES = [
  {
    category: "Job Search",
    keywords: ["resume", "cv", "experience", "skills", "education", "cover letter", "interview"],
  },
  {
    category: "Academics",
    keywords: ["lecture", "course", "assignment", "study", "syllabus", "exam", "notes"],
  },
  {
    category: "Recipes",
    keywords: ["recipe", "ingredients", "cook", "cooking", "oven", "pasta", "cake"],
  },
  {
    category: "Finance / Receipts",
    keywords: ["invoice", "receipt", "payment", "transaction", "total", "tax", "bill"],
  },
  {
    category: "Travel",
    keywords: ["flight", "hotel", "itinerary", "boarding", "booking", "departure", "travel"],
  },
  {
    category: "Personal Documents",
    keywords: ["passport", "license", "identity", "id", "statement", "driver", "account"],
  },
  {
    category: "Screenshots / Images",
    keywords: ["screenshot", "screen capture", "photo", "image", "img_"],
  },
];

function matchedTermsInSource(sourceText = "", keywords = []) {
  const lower = sourceText.toLowerCase();
  return keywords.filter((term) => lower.includes(term));
}

function detectCategory(fileName = "", extractedText = "", fileType = "") {
  const lowerText = String(extractedText || "").toLowerCase();
  const lowerName = String(fileName || "").toLowerCase();
  const lowerType = String(fileType || "").toLowerCase();
  const ext = getExtension(fileName);

  const scores = {};
  const matchedSignals = {};

  CATEGORY_RULES.forEach((rule) => {
    const textMatches = matchedTermsInSource(lowerText, rule.keywords);
    const fileNameMatches = matchedTermsInSource(lowerName, rule.keywords);
    const typeMatches = matchedTermsInSource(`${lowerType} ${ext}`, rule.keywords);

    // Priority weights: extracted text > filename > file type.
    const score = textMatches.length * 3 + fileNameMatches.length * 1.5 + typeMatches.length * 1;
    scores[rule.category] = score;
    matchedSignals[rule.category] = { textMatches, fileNameMatches, typeMatches };
  });

  const isImageType = /image\//.test(lowerType) || /(png|jpg|jpeg|webp|gif)/.test(ext);
  if (isImageType) {
    scores["Screenshots / Images"] = (scores["Screenshots / Images"] || 0) + 2;
    matchedSignals["Screenshots / Images"] = {
      ...(matchedSignals["Screenshots / Images"] || {}),
      typeMatches: [...(matchedSignals["Screenshots / Images"]?.typeMatches || []), ext],
    };
  }

  let bestCategory = "General";
  let bestScore = 0;
  Object.entries(scores).forEach(([category, score]) => {
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  });

  return {
    category: bestScore > 0 ? bestCategory : "General",
    signals: matchedSignals[bestCategory] || { textMatches: [], fileNameMatches: [], typeMatches: [] },
    usedText: lowerText.trim().length > 0,
  };
}

function buildCategoryOutput(category, baseName, extension, textPreview, signals, usedText) {
  const rankedTerms = [
    ...new Set([...(signals.textMatches || []), ...(signals.fileNameMatches || []), ...(signals.typeMatches || [])]),
  ].slice(0, 3);
  const signalReason = rankedTerms.length
    ? `Detected terms like ${rankedTerms.join(", ")}.`
    : "No strong keyword signals were detected.";
  const sourceReason = usedText
    ? "Used extracted text as primary signal, with filename/type as backup."
    : "No extracted text found, so filename/type signals were used.";

  if (category === "Job Search") {
    return {
      new_name: `job-search-${baseName}.${extension}`,
      category,
      summary: "Career document with hiring-related information and candidate details.",
      confidence: 0.95,
      reasoning: `${signalReason} ${sourceReason}`,
    };
  }

  if (category === "Academics") {
    return {
      new_name: `academics-notes-${baseName}.${extension}`,
      category,
      summary: "Study-oriented file containing lecture notes, assignments, or course material.",
      confidence: 0.93,
      reasoning: `${signalReason} ${sourceReason}`,
    };
  }

  if (category === "Recipes") {
    return {
      new_name: `recipe-${baseName}.${extension}`,
      category,
      summary: "Cooking reference with ingredients, preparation steps, or meal instructions.",
      confidence: 0.92,
      reasoning: `${signalReason} ${sourceReason}`,
    };
  }

  if (category === "Finance / Receipts") {
    return {
      new_name: `finance-receipt-${baseName}.${extension}`,
      category,
      summary: "Financial record covering payment, billing, or transaction details.",
      confidence: 0.94,
      reasoning: `${signalReason} ${sourceReason}`,
    };
  }

  if (category === "Travel") {
    return {
      new_name: `travel-itinerary-${baseName}.${extension}`,
      category,
      summary: "Travel-related document including booking details, flight info, or itinerary plans.",
      confidence: 0.91,
      reasoning: `${signalReason} ${sourceReason}`,
    };
  }

  if (category === "Screenshots / Images") {
    return {
      new_name: `image-capture-${baseName}.${extension}`,
      category,
      summary: "Visual file likely used as a screenshot, photo, or reference image.",
      confidence: 0.89,
      reasoning: `${signalReason} ${sourceReason}`,
    };
  }

  if (category === "Personal Documents") {
    return {
      new_name: `personal-doc-${baseName}.${extension}`,
      category,
      summary: "Personal identification or statement document with sensitive personal details.",
      confidence: 0.9,
      reasoning: `${signalReason} ${sourceReason}`,
    };
  }

  return {
    new_name: `general-doc-${baseName}.${extension}`,
    category: "General",
    summary: `General document for review. Preview: ${textPreview || "No text provided."}`,
    confidence: 0.78,
    reasoning: `${signalReason} ${sourceReason}`,
  };
}

function sanitizeConfidence(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return 0.75;
  return Math.max(0, Math.min(1, num));
}

function extractJsonFromText(content = "") {
  if (!content) return null;

  try {
    return JSON.parse(content);
  } catch {
    // Try to recover JSON payload from markdown/code-fence responses.
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(content.slice(start, end + 1));
      } catch {
        return null;
      }
    }
  }

  return null;
}

function validateAnalysisShape(result, fileName = "file") {
  if (!result || typeof result !== "object") return null;
  if (!result.new_name || !result.category || !result.summary || !result.reasoning) return null;

  const extension = getExtension(fileName);
  const safeName = String(result.new_name).trim() || `general-doc.${extension}`;

  return {
    new_name: safeName.includes(".") ? safeName : `${safeName}.${extension}`,
    category: String(result.category).trim(),
    summary: String(result.summary).trim(),
    confidence: sanitizeConfidence(result.confidence),
    reasoning: String(result.reasoning).trim(),
  };
}

/**
 * Rule-based analyzer (fallback/default today).
 * Priority: extractedText -> fileName -> fileType.
 */
function analyzeFileWithRules(fileName = "", fileType = "", extractedText = "") {
  const detection = detectCategory(fileName, extractedText, fileType);
  const extension = getExtension(fileName);
  const baseName = toSlug(String(fileName).replace(/\.[^.]+$/, "")) || "file";
  const textPreview = String(extractedText || "").trim().slice(0, 80);

  return buildCategoryOutput(
    detection.category,
    baseName,
    extension,
    textPreview,
    detection.signals,
    detection.usedText
  );
}

/**
 * LLM analyzer stub.
 * Keep this function signature stable so real API integration is a drop-in change.
 */
async function analyzeFileWithLLM(fileName = "", fileType = "", extractedText = "") {
  const truncatedText = String(extractedText || "").slice(0, 3500);
  const userPayload = {
    fileName,
    fileType,
    extractedText: truncatedText,
  };

  const openAiKey = process.env.OPENAI_API_KEY;
  const claudeKey = process.env.CLAUDE_API_KEY;

  if (openAiKey) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: FILE_ANALYSIS_SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(userPayload, null, 2) },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed with status ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data?.choices?.[0]?.message?.content || "";
    const parsed = extractJsonFromText(rawContent);
    return validateAnalysisShape(parsed, fileName);
  }

  if (claudeKey) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_MODEL || "claude-3-5-sonnet-latest",
        max_tokens: 600,
        system: FILE_ANALYSIS_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Analyze this file and return only JSON:\n${JSON.stringify(userPayload, null, 2)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude request failed with status ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data?.content?.[0]?.text || "";
    const parsed = extractJsonFromText(rawContent);
    return validateAnalysisShape(parsed, fileName);
  }

  return null;
}

/**
 * Unified analyzer entrypoint.
 * Attempts LLM path when enabled, falls back to rules for reliability.
 */
async function analyzeFile(fileName = "", fileType = "", extractedText = "") {
  const useLLM = process.env.USE_LLM_ANALYZER === "true";

  if (useLLM) {
    try {
      const llmResult = await analyzeFileWithLLM(fileName, fileType, extractedText);
      if (llmResult) {
        return llmResult;
      }
      console.error("[analyzer] LLM enabled but no valid structured response. Falling back to rules.");
    } catch (error) {
      console.error("[analyzer] LLM analysis failed. Falling back to rules.", error.message);
    }
  }

  return analyzeFileWithRules(fileName, fileType, extractedText);
}

async function analyzeFiles(files = []) {
  return Promise.all(
    files.map(async (file, index) => {
      const fileName = file.name || `file-${index + 1}.txt`;
      const fileType = file.type || "unknown";
      const extractedText = file.text || "";
      const analysis = await analyzeFile(fileName, fileType, extractedText);
      const extension = getExtension(fileName);

      return {
        original_name: fileName || `file-${index + 1}.${extension}`,
        new_name: analysis.new_name,
        category: analysis.category,
        summary: analysis.summary,
        confidence: analysis.confidence,
        reasoning: analysis.reasoning,
      };
    })
  );
}

function buildFolderPreview(analyzedFiles = []) {
  const folders = {};

  analyzedFiles.forEach((file) => {
    const folder = file.category || "General";
    if (!folders[folder]) {
      folders[folder] = [];
    }
    folders[folder].push(file.new_name || file.original_name || "untitled-file");
  });

  return {
    root: "Clario Workspace",
    folders: Object.entries(folders).map(([name, files]) => ({
      name,
      files,
    })),
  };
}

module.exports = {
  analyzeFileWithRules,
  analyzeFileWithLLM,
  analyzeFile,
  analyzeFiles,
  buildFolderPreview,
};
