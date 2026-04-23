// Mock analyzer foundation for Clario.
// Keeps logic deterministic so frontend/backend demos are stable.

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

function detectSignals(fileName = "", extractedText = "", fileType = "") {
  const full = `${normalize(fileName)} ${normalize(extractedText)} ${normalize(fileType)}`;
  const ext = getExtension(fileName, fileType);

  // Decision logic combines filename, text hints, and MIME/extension signals.
  const isResume = /(resume|cv|curriculum vitae|linkedin)/.test(full);
  const isNotes = /(lecture|class notes|notes|chapter|assignment|course|professor|homework)/.test(full);
  const isReceipt = /(receipt|transaction|amount paid|merchant|tax|invoice|billing)/.test(full);
  const isImageType = /image\//.test(normalize(fileType)) || /(png|jpg|jpeg|webp|gif)/.test(ext);
  const isScreenshot = /(screenshot|screen shot|screen capture|snip|img_)/.test(full);

  return { ext, isResume, isNotes, isReceipt, isImageType, isScreenshot };
}

function buildMockResult(fileName, extractedText, fileType, mode) {
  const { ext, isResume, isNotes, isReceipt, isImageType, isScreenshot } = detectSignals(
    fileName,
    extractedText,
    fileType
  );
  const baseName = cleanBaseName(fileName);
  const textPreview = (extractedText || "").trim().slice(0, 90);

  if (isResume) {
    const category = mode === "job-search" ? "Job Applications" : "Career";
    const prefix = mode === "job-search" ? "job-search-resume" : "resume";
    return {
      new_name: `${prefix}-${baseName}.${ext}`,
      category,
      summary: "Resume highlighting professional experience, technical skills, and project impact.",
      confidence: 0.96,
      reasoning:
        "Matched resume/CV keywords in filename or text and prioritized career-oriented naming.",
    };
  }

  if (isNotes) {
    const category = mode === "school" ? "Course Notes" : "Education";
    const prefix = mode === "school" ? "class-notes" : "lecture-notes";
    return {
      new_name: `${prefix}-${baseName}.${ext}`,
      category,
      summary: "Academic notes summarizing lecture topics and key concepts for review.",
      confidence: 0.93,
      reasoning:
        "Detected note/lecture/course terms and applied academic-focused organization logic.",
    };
  }

  if (isReceipt) {
    const category = mode === "job-search" ? "Job Search Expenses" : "Finance";
    const prefix = mode === "job-search" ? "job-expense-receipt" : "expense-receipt";
    return {
      new_name: `${prefix}-${baseName}.${ext}`,
      category,
      summary: "Receipt or invoice document containing payment amount, merchant, and transaction details.",
      confidence: 0.91,
      reasoning:
        "Detected finance signals such as receipt/invoice/tax/amount paid and grouped under expense tracking.",
    };
  }

  if (isScreenshot || isImageType) {
    const category = mode === "school" ? "Study Images" : "Screenshots";
    const prefix = isScreenshot ? "screenshot" : "image";
    return {
      new_name: `${prefix}-${baseName}.${ext}`,
      category,
      summary: "Image file likely used as a visual reference or captured screen context.",
      confidence: isScreenshot ? 0.9 : 0.86,
      reasoning:
        "Detected screenshot/image patterns from filename or file type and categorized as visual content.",
    };
  }

  return {
    new_name: `document-${baseName}.${ext}`,
    category: mode === "school" ? "Reference Material" : "General",
    summary: `General document for review. Preview: ${textPreview || "No text extracted yet."}`,
    confidence: 0.79,
    reasoning:
      "No strong pattern match found, so a generic document classification was applied as fallback.",
  };
}

/**
 * Analyze one file and return structured mock metadata.
 * @param {string} fileName
 * @param {string} extractedText
 * @param {string} fileType
 * @param {"general"|"school"|"job-search"} mode
 */
function analyzeFile(fileName, extractedText, fileType, mode = "general") {
  const supportedModes = new Set(["general", "school", "job-search"]);
  const safeMode = supportedModes.has(mode) ? mode : "general";
  return buildMockResult(fileName, extractedText, fileType, safeMode);
}

module.exports = {
  analyzeFile,
};
