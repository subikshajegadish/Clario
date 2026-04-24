// Pass 1 (per-file understanding) + Pass 2 (batch grouping) service.
const sharp = require("sharp");
const {
  PASS1_FILE_UNDERSTANDING_PROMPT,
  PASS2_BATCH_GROUPING_PROMPT,
} = require("../../ai/prompts");

function toSlug(value = "") {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toSafeFolderName(value = "") {
  const slug = toSlug(value);
  const banned = new Set([
    "misc-files",
    "miscellaneous",
    "other",
    "general",
    "documents",
    "files",
    "content-cluster",
    "cluster",
    "group",
    "batch",
    "upload",
    "mixed",
    "various",
  ]);
  if (!slug || banned.has(slug)) {
    return "";
  }
  return slug;
}

function deriveSpecificFolderNameFromFiles(files = []) {
  const stopTokens = new Set([
    "pdf",
    "doc",
    "docx",
    "txt",
    "md",
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "bmp",
    "tiff",
    "file",
    "files",
    "document",
    "documents",
    "final",
    "copy",
    "draft",
    "notes",
  ]);
  const tokenCounts = new Map();
  files.forEach((fileName) => {
    const base = String(fileName || "").toLowerCase().replace(/\.[^.]+$/, "");
    const tokens = base.split(/[^a-z0-9]+/).filter(Boolean);
    tokens.forEach((token) => {
      if (token.length < 3 || stopTokens.has(token)) return;
      tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
    });
  });

  const ranked = Array.from(tokenCounts.entries()).sort((a, b) => b[1] - a[1]);
  if (ranked.length >= 2) {
    return `${ranked[0][0]}-${ranked[1][0]}`;
  }
  if (ranked.length === 1) {
    return ranked[0][0];
  }
  return "organized-content";
}

function deriveFallbackFolderNameForFile(file = {}) {
  const categorySeed = toSafeFolderName(file?.category || "");
  const keywordSeed = toSafeFolderName(file?.keywords?.[0] || "") || toSafeFolderName(file?.entities?.[0] || "");
  const nameSeed = toSafeFolderName(
    deriveSpecificFolderNameFromFiles([file?.new_name || file?.original_name || ""])
  );

  // Prefer category + name semantic key to avoid unrelated files collapsing.
  if (categorySeed && nameSeed) {
    return `${categorySeed}-${nameSeed}`;
  }
  if (nameSeed && keywordSeed && nameSeed !== keywordSeed) {
    return `${nameSeed}-${keywordSeed}`;
  }
  if (nameSeed) {
    return nameSeed;
  }
  if (categorySeed && keywordSeed) {
    return `${categorySeed}-${keywordSeed}`;
  }
  if (categorySeed) {
    return categorySeed;
  }
  if (keywordSeed) {
    return keywordSeed;
  }
  return "organized-content";
}

function slugifyFileName(fileName = "") {
  const extension = getExtension(fileName);
  const base = String(fileName || "").replace(/\.[^.]+$/, "");
  const slugBase = toSlug(base) || "file";
  return extension ? `${slugBase}.${extension}` : slugBase;
}

function getExtension(fileName = "") {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "txt";
}

function deriveSemanticStem(extractedText = "", fileName = "", category = "") {
  const stop = new Set([
    "the", "and", "for", "with", "from", "that", "this", "your", "you", "are", "was", "were",
    "have", "has", "had", "into", "onto", "over", "under", "about", "after", "before", "during",
    "file", "document", "documents", "notes", "draft", "final", "copy", "version", "page",
    "resume", "cv", "image", "photo", "screenshot", "lecture", "assignment", "course",
  ]);

  const textTokens = String(extractedText || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !stop.has(token));

  const fileTokens = String(fileName || "")
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !stop.has(token));

  const counts = new Map();
  [...textTokens.slice(0, 200), ...fileTokens].forEach((token) => {
    counts.set(token, (counts.get(token) || 0) + 1);
  });

  const top = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([token]) => token);

  const semantic = toSlug(top.join("-"));
  if (semantic) return semantic;

  const categoryStem = toSlug(category);
  if (categoryStem) return categoryStem;

  return toSlug(String(fileName).replace(/\.[^.]+$/, "")) || "document";
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

function isImageFile(fileType = "", fileName = "") {
  const lowerType = String(fileType || "").toLowerCase();
  const ext = getExtension(fileName);
  return /image\//.test(lowerType) || /(png|jpg|jpeg|webp|gif)/.test(ext);
}

async function preprocessVisionPayload(imageData = "", mediaType = "") {
  if (!imageData || !mediaType) {
    return { imageData, mediaType };
  }

  const lowerType = String(mediaType).toLowerCase();
  if (!/(gif|bmp|tiff)/.test(lowerType)) {
    return { imageData, mediaType };
  }

  try {
    const sourceBuffer = Buffer.from(imageData, "base64");
    let converted;

    if (lowerType.includes("gif")) {
      converted = await sharp(sourceBuffer, { animated: true, page: 0 }).png().toBuffer();
    } else {
      converted = await sharp(sourceBuffer).png().toBuffer();
    }

    return {
      imageData: converted.toString("base64"),
      mediaType: "image/png",
    };
  } catch (error) {
    console.error("[analyzer] Image preprocessing failed, using original payload.", error.message);
    return { imageData, mediaType };
  }
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

function buildCategoryOutput(category, baseName, semanticStem, extension, textPreview, signals, usedText) {
  const stem = semanticStem || baseName || "document";
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
      new_name: `job-search-${stem}.${extension}`,
      category,
      summary: "Career document with hiring-related information and candidate details.",
      confidence: 0.95,
      reasoning: `${signalReason} ${sourceReason}`,
    };
  }

  if (category === "Academics") {
    return {
      new_name: `academics-${stem}.${extension}`,
      category,
      summary: "Study-oriented file containing lecture notes, assignments, or course material.",
      confidence: 0.93,
      reasoning: `${signalReason} ${sourceReason}`,
    };
  }

  if (category === "Recipes") {
    return {
      new_name: `recipe-${stem}.${extension}`,
      category,
      summary: "Cooking reference with ingredients, preparation steps, or meal instructions.",
      confidence: 0.92,
      reasoning: `${signalReason} ${sourceReason}`,
    };
  }

  if (category === "Finance / Receipts") {
    return {
      new_name: `finance-${stem}.${extension}`,
      category,
      summary: "Financial record covering payment, billing, or transaction details.",
      confidence: 0.94,
      reasoning: `${signalReason} ${sourceReason}`,
    };
  }

  if (category === "Travel") {
    return {
      new_name: `travel-${stem}.${extension}`,
      category,
      summary: "Travel-related document including booking details, flight info, or itinerary plans.",
      confidence: 0.91,
      reasoning: `${signalReason} ${sourceReason}`,
    };
  }

  if (category === "Screenshots / Images") {
    return {
      new_name: `image-${stem}.${extension}`,
      category,
      summary: "Visual file likely used as a screenshot, photo, or reference image.",
      confidence: 0.89,
      reasoning: `${signalReason} ${sourceReason}`,
    };
  }

  if (category === "Personal Documents") {
    return {
      new_name: `personal-${stem}.${extension}`,
      category,
      summary: "Personal identification or statement document with sensitive personal details.",
      confidence: 0.9,
      reasoning: `${signalReason} ${sourceReason}`,
    };
  }

  return {
    new_name: `document-${stem}.${extension}`,
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
    // Try parsing fenced JSON first.
    const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fencedMatch?.[1]) {
      try {
        return JSON.parse(fencedMatch[1]);
      } catch {
        // continue to balanced-object scan
      }
    }

    // Try to recover the first valid balanced JSON object from mixed text.
    let depth = 0;
    let start = -1;
    for (let index = 0; index < content.length; index += 1) {
      const char = content[index];
      if (char === "{") {
        if (depth === 0) start = index;
        depth += 1;
      } else if (char === "}") {
        if (depth > 0) depth -= 1;
        if (depth === 0 && start !== -1) {
          const candidate = content.slice(start, index + 1);
          try {
            return JSON.parse(candidate);
          } catch {
            // keep scanning for next possible object
            start = -1;
          }
        }
      }
    }
  }

  return null;
}

function extractAnthropicTextPayload(data) {
  const content = Array.isArray(data?.content) ? data.content : [];
  const textBlocks = content
    .filter((block) => block?.type === "text" && typeof block?.text === "string")
    .map((block) => block.text.trim())
    .filter(Boolean);
  return textBlocks.join("\n");
}

async function callClaudeWithRetry(requestBody, { timeoutMs = 25000, retries = 1 } = {}) {
  const claudeKey = process.env.CLAUDE_API_KEY;
  if (!claudeKey) return null;

  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": claudeKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.status === 401 || response.status === 403) {
        throw new Error("Invalid Claude API key. Please check CLAUDE_API_KEY in backend/.env.");
      }
      if (!response.ok) {
        throw new Error(`Claude request failed with status ${response.status}`);
      }
      return response;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      const isTimeout = error.name === "AbortError";
      const isNetwork = /fetch|network|socket|timed out|timeout/i.test(String(error.message || ""));
      const shouldRetry = attempt < retries && (isTimeout || isNetwork);
      if (!shouldRetry) {
        break;
      }
    }
  }

  if (lastError?.name === "AbortError") {
    throw new Error("Claude request timed out. Please retry.");
  }
  throw lastError || new Error("Claude request failed.");
}

let cachedModelList = null;
let cachedModelListAtMs = 0;

async function fetchAvailableClaudeModels() {
  const claudeKey = process.env.CLAUDE_API_KEY;
  if (!claudeKey) return [];

  const now = Date.now();
  if (cachedModelList && now - cachedModelListAtMs < 5 * 60 * 1000) {
    return cachedModelList;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/models", {
      method: "GET",
      headers: {
        "x-api-key": claudeKey,
        "anthropic-version": "2023-06-01",
      },
    });
    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const modelIds = Array.isArray(data?.data)
      ? data.data
          .map((model) => String(model?.id || "").trim())
          .filter((id) => id.startsWith("claude-"))
      : [];
    cachedModelList = modelIds;
    cachedModelListAtMs = now;
    return modelIds;
  } catch {
    return [];
  }
}

async function resolveClaudeModelCandidates(preferredModel) {
  const defaults = [
    preferredModel,
    "claude-sonnet-4-20250514",
    "claude-3-7-sonnet-latest",
    "claude-3-5-sonnet-latest",
    "claude-3-5-haiku-latest",
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
  ].filter(Boolean);

  const available = await fetchAvailableClaudeModels();
  if (!available.length) {
    return [...new Set(defaults)];
  }

  const availableSet = new Set(available);
  const inAvailableOrder = defaults.filter((model) => availableSet.has(model));
  const fallbacksFromAvailable = available.filter((model) =>
    /sonnet|haiku/i.test(model)
  );

  const candidates = [...new Set([...inAvailableOrder, ...fallbacksFromAvailable])];
  return candidates.length ? candidates : [...new Set(defaults)];
}

async function callClaudeWithModelFallback(requestBody, modelCandidates = []) {
  const models = modelCandidates.filter(Boolean);
  let lastError = null;

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];
    try {
      return await callClaudeWithRetry(
        {
          ...requestBody,
          model,
        },
        { timeoutMs: 25000, retries: 1 }
      );
    } catch (error) {
      lastError = error;
      const isNotFound = /status 404/i.test(String(error.message || ""));
      if (isNotFound && index < models.length - 1) {
        console.error(`[analyzer] Claude model "${model}" unavailable (404). Trying fallback model.`);
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error("Claude request failed for all model candidates.");
}

function validateAnalysisShape(result, fileName = "file") {
  if (!result || typeof result !== "object") return null;

  const candidate = Array.isArray(result) ? result[0] : result;
  if (!candidate || typeof candidate !== "object") return null;

  const extension = getExtension(fileName);
  const pickedName =
    candidate.new_name || candidate.newName || candidate.filename || candidate.renamed_file || "";
  const pickedCategory = candidate.category || candidate.folder || candidate.group || "General";
  const pickedSummary = candidate.summary || candidate.description || candidate.short_summary || "";
  const pickedReasoning = candidate.reasoning || candidate.explanation || candidate.rationale || "";

  const safeName = String(pickedName).trim() || `general-doc.${extension}`;
  const safeKeywords = Array.isArray(candidate.keywords)
    ? candidate.keywords.map((item) => String(item).trim()).filter(Boolean).slice(0, 8)
    : [];
  const safeEntities = Array.isArray(candidate.entities)
    ? candidate.entities.map((item) => String(item).trim()).filter(Boolean).slice(0, 8)
    : [];
  const safeSummary = String(pickedSummary || "").trim();
  const safeReasoning = String(pickedReasoning || "").trim();

  return {
    new_name: safeName.includes(".") ? safeName : `${safeName}.${extension}`,
    category: String(pickedCategory).trim() || "General",
    summary: safeSummary || `Auto summary for ${fileName}.`,
    confidence: sanitizeConfidence(candidate.confidence),
    reasoning: safeReasoning || "Structured inference from available file signals.",
    keywords: safeKeywords,
    entities: safeEntities,
    scene_description: String(candidate.scene_description || candidate.sceneDescription || "").trim(),
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
  const semanticStem = deriveSemanticStem(extractedText, fileName, detection.category);
  const textPreview = String(extractedText || "").trim().slice(0, 80);

  return buildCategoryOutput(
    detection.category,
    baseName,
    semanticStem,
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
async function analyzeFileWithLLM(fileName = "", fileType = "", extractedText = "", imageData = "", mediaType = "") {
  const truncatedText = String(extractedText || "").slice(0, 12000);
  const userPayload = {
    fileName,
    fileType,
    extractedText: truncatedText,
    instructions: isImageFile(fileType, fileName)
      ? "This is an image. Return scene_description plus strong visual keywords/entities."
      : "This is a text-oriented file. Return summary/keywords/entities from content.",
  };
  if (process.env.CLAUDE_API_KEY) {
    const preferredModel = process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";
    const modelCandidates = await resolveClaudeModelCandidates(preferredModel);
    const preparedImage = await preprocessVisionPayload(imageData, mediaType);
    const imageContent =
      preparedImage.imageData && preparedImage.mediaType
        ? [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: preparedImage.mediaType,
                data: preparedImage.imageData,
              },
            },
          ]
        : [];

    const response = await callClaudeWithModelFallback(
      {
        max_tokens: 800,
        temperature: 0,
        system: PASS1_FILE_UNDERSTANDING_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              ...imageContent,
              {
                type: "text",
                text: `Analyze this file and return only JSON:\n${JSON.stringify(userPayload, null, 2)}`,
              },
            ],
          },
        ],
      },
      modelCandidates
    );

    const data = await response.json();
    const rawContent = extractAnthropicTextPayload(data);
    const parsed = extractJsonFromText(rawContent);
    if (!parsed || typeof parsed !== "object") {
      console.error("[analyzer] Claude response was not parseable JSON.", rawContent.slice(0, 300));
    }
    const validated = validateAnalysisShape(parsed, fileName);
    if (!validated) {
      console.error("[analyzer] Claude JSON parsed but failed validation.", JSON.stringify(parsed).slice(0, 300));
    }
    return validated;
  }

  console.error("[analyzer] CLAUDE_API_KEY not available in backend process env.");

  return null;
}

function validateBatchGroupingShape(result) {
  if (!result || typeof result !== "object") return null;
  if (!Array.isArray(result.folders)) return null;

  return {
    folders: result.folders
      .map((folder) => ({
        name: toSafeFolderName(
          String(folder?.name || folder?.folder_name || folder?.title || folder?.label || "")
        ),
        reasoning: String(folder?.reasoning || "").trim(),
        files: Array.isArray(folder?.files)
          ? folder.files.map((item) => String(item).trim()).filter(Boolean)
          : [],
      }))
      .filter((folder) => folder.files.length > 0),
    unassigned: Array.isArray(result.unassigned)
      ? result.unassigned.map((item) => String(item).trim()).filter(Boolean)
      : [],
  };
}

function normalizeGroupingForStability(grouping) {
  if (!grouping?.folders?.length) {
    return { folders: [], unassigned: [] };
  }

  const mergedByFolder = new Map();
  grouping.folders.forEach((folder) => {
    const fallbackFromFiles = deriveSpecificFolderNameFromFiles(folder?.files || []);
    const normalizedName = toSafeFolderName(folder?.name) || toSafeFolderName(fallbackFromFiles) || "organized-content";
    const existing = mergedByFolder.get(normalizedName) || {
      name: normalizedName,
      reasoning: "",
      files: [],
    };
    const reasoning = String(folder?.reasoning || "").trim();
    if (!existing.reasoning && reasoning) {
      existing.reasoning = reasoning;
    }
    const files = (folder?.files || []).map((name) => String(name).trim()).filter(Boolean);
    existing.files.push(...files);
    mergedByFolder.set(normalizedName, existing);
  });

  const normalizedFolders = Array.from(mergedByFolder.values())
    .map((folder) => ({
      ...folder,
      files: [...new Set(folder.files)].sort((a, b) => a.localeCompare(b)),
    }))
    .filter((folder) => folder.files.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    folders: normalizedFolders,
    unassigned: [],
  };
}

async function groupFilesWithLLM(analyzedFiles = []) {
  const claudeKey = process.env.CLAUDE_API_KEY;
  if (!claudeKey || analyzedFiles.length === 0) return null;

  const preferredModel = process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";
  const modelCandidates = await resolveClaudeModelCandidates(preferredModel);
  const response = await callClaudeWithModelFallback(
    {
      max_tokens: 1000,
      temperature: 0,
      system: PASS2_BATCH_GROUPING_PROMPT,
      messages: [
        {
          role: "user",
          content: `Group these files:\n${JSON.stringify({ files: analyzedFiles }, null, 2)}`,
        },
      ],
    },
    modelCandidates
  );

  const data = await response.json();
  const rawContent = extractAnthropicTextPayload(data);
  const parsed = extractJsonFromText(rawContent);
  if (!parsed) {
    console.error("[organize] Claude grouping response was not parseable JSON.", rawContent.slice(0, 220));
  }
  return normalizeGroupingForStability(validateBatchGroupingShape(parsed));
}

/**
 * Unified analyzer entrypoint.
 * Attempts LLM path when enabled, falls back to rules for reliability.
 */
async function analyzeFile(fileName = "", fileType = "", extractedText = "", imageData = "", mediaType = "") {
  const useLLM = process.env.USE_LLM_ANALYZER !== "false";

  if (useLLM) {
    try {
      const llmResult = await analyzeFileWithLLM(fileName, fileType, extractedText, imageData, mediaType);
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
  const analyzed = await Promise.all(
    files.map(async (file, index) => {
      const fileName = file.name || `file-${index + 1}.txt`;
      const fileType = file.type || "unknown";
      const extractedText = file.text || "";
      const imageData = file.image_data || "";
      const mediaType = file.media_type || "";
      const analysis = await analyzeFile(fileName, fileType, extractedText, imageData, mediaType);
      const extension = getExtension(fileName);

      return {
        original_name: fileName || `file-${index + 1}.${extension}`,
        new_name: slugifyFileName(analysis.new_name),
        category: analysis.category,
        summary: analysis.summary,
        confidence: analysis.confidence,
        reasoning: analysis.reasoning,
        keywords: analysis.keywords || [],
        entities: analysis.entities || [],
        scene_description: analysis.scene_description || "",
      };
    })
  );

  return analyzed.sort((a, b) => a.original_name.localeCompare(b.original_name));
}

function buildFallbackGroupedFolders(analyzedFiles = []) {
  const folders = {};
  analyzedFiles.forEach((file) => {
    const folderName = deriveFallbackFolderNameForFile(file);
    if (!folders[folderName]) folders[folderName] = [];
    folders[folderName].push(file.original_name);
  });
  return Object.entries(folders).map(([name, files]) => ({
    name,
    reasoning: "Fallback grouping by strongest available signal.",
    files,
  }));
}

async function buildFolderPreview(analyzedFiles = []) {
  try {
    const llmGrouping = await groupFilesWithLLM(analyzedFiles);
    if (llmGrouping?.folders?.length) {
      return {
        root: "Clario Workspace",
        folders: llmGrouping.folders.map((folder) => ({
          name: folder.name,
          files: folder.files,
          reasoning: folder.reasoning,
        })),
      };
    }
  } catch (error) {
    console.error("[organize] Pass 2 Claude grouping failed. Falling back.", error.message);
  }

  return {
    root: "Clario Workspace",
    folders: buildFallbackGroupedFolders(analyzedFiles),
  };
}

module.exports = {
  analyzeFileWithRules,
  analyzeFileWithLLM,
  analyzeFile,
  analyzeFiles,
  buildFolderPreview,
};
