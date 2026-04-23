// Mock analyzer foundation for Clario.
// Keeps logic deterministic so frontend/backend demos are stable.
// Prioritizes extracted text first, then filename, then file type.

function normalize(value = "") {
  return String(value).toLowerCase();
}

function cleanBaseName(fileName = "file") {
  const nameWithoutExt = fileName.replace(/\.[^.]+$/, "");
  return nameWithoutExt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "file";
}

function getExtension(fileName = "", fileType = "") {
  const fromName = fileName.split(".").pop();
  if (fromName && fromName !== fileName) {
    return fromName.toLowerCase();
  }
  return normalize(fileType) || "txt";
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
  const lowerText = normalize(extractedText);
  const lowerName = normalize(fileName);
  const lowerType = normalize(fileType);
  const ext = getExtension(fileName, fileType);

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

function buildMockResult(fileName, extractedText, fileType) {
  const detection = detectCategory(fileName, extractedText, fileType);
  const { category, signals, usedText } = detection;
  const ext = getExtension(fileName, fileType);
  const baseName = cleanBaseName(fileName);
  const textPreview = (extractedText || "").trim().slice(0, 90);

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
      new_name: `job-search-${baseName}.${ext}`,
      category: "Job Search",
      summary: "Resume highlighting professional experience, technical skills, and project impact.",
      confidence: 0.96,
      reasoning: `${signalReason} ${sourceReason}`,
    };
  }

  if (category === "Academics") {
    return {
      new_name: `academics-notes-${baseName}.${ext}`,
      category: "Academics",
      summary: "Academic document with lecture notes, assignment context, or study material.",
      confidence: 0.93,
      reasoning: `${signalReason} ${sourceReason}`,
    };
  }

  if (category === "Recipes") {
    return {
      new_name: `recipe-${baseName}.${ext}`,
      category: "Recipes",
      summary: "Cooking document containing ingredients, instructions, and preparation steps.",
      confidence: 0.92,
      reasoning: `${signalReason} ${sourceReason}`,
    };
  }

  if (category === "Finance / Receipts") {
    return {
      new_name: `finance-receipt-${baseName}.${ext}`,
      category: "Finance / Receipts",
      summary: "Financial document with transaction, billing, and payment details.",
      confidence: 0.94,
      reasoning: `${signalReason} ${sourceReason}`,
    };
  }

  if (category === "Travel") {
    return {
      new_name: `travel-itinerary-${baseName}.${ext}`,
      category: "Travel",
      summary: "Travel booking document with itinerary, flight, or hotel information.",
      confidence: 0.91,
      reasoning: `${signalReason} ${sourceReason}`,
    };
  }

  if (category === "Screenshots / Images") {
    return {
      new_name: `image-capture-${baseName}.${ext}`,
      category: "Screenshots / Images",
      summary: "Image file likely used as a visual reference or captured screen context.",
      confidence: 0.89,
      reasoning: `${signalReason} ${sourceReason}`,
    };
  }

  if (category === "Personal Documents") {
    return {
      new_name: `personal-doc-${baseName}.${ext}`,
      category: "Personal Documents",
      summary: "Personal document containing identification or account statement information.",
      confidence: 0.9,
      reasoning: `${signalReason} ${sourceReason}`,
    };
  }

  return {
    new_name: `general-doc-${baseName}.${ext}`,
    category: "General",
    summary: `General document for review. Preview: ${textPreview || "No text extracted yet."}`,
    confidence: 0.79,
    reasoning: `${signalReason} ${sourceReason}`,
  };
}

/**
 * Analyze one file and return structured mock metadata.
 * @param {string} fileName
 * @param {string} extractedText
 * @param {string} fileType
 */
function analyzeFile(fileName, extractedText, fileType) {
  return buildMockResult(fileName, extractedText, fileType);
}

module.exports = {
  analyzeFile,
};
