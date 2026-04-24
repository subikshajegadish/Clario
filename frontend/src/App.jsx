import { useEffect, useState } from 'react'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import toast, { Toaster } from 'react-hot-toast'
import JSZip from 'jszip'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import './App.css'
import UploadBox from './components/UploadBox'
import FileList from './components/FileList'
import AnalysisResults from './components/AnalysisResults'
import FolderTree from './components/FolderTree'
import { API_BASE_URL } from './config'

GlobalWorkerOptions.workerSrc = pdfWorker

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_TEXT_CHARS = 12000
const SUPPORTED_TEXT_EXTENSIONS = [
  'pdf',
  'txt',
  'md',
  'docx',
  'doc',
  'xlsx',
  'csv',
  'json',
  'html',
  'xml',
]
const SUPPORTED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff']
const UNSUPPORTED_EXTENSIONS = ['exe', 'zip', 'mp4', 'mp3', 'psd', 'ai']

const buildDefaultZipNameFromDate = () => {
  const now = new Date()
  const month = now.toLocaleString('en-US', { month: 'short' }).toLowerCase()
  const day = now.getDate()
  const year = now.getFullYear()
  return `clario-${month}${day}-${year}`
}

function App() {
  const [selectedFiles, setSelectedFiles] = useState([])
  const [analysisResults, setAnalysisResults] = useState([])
  const [folderTreeData, setFolderTreeData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [theme, setTheme] = useState(() => localStorage.getItem('clario-theme') || 'dark')
  const originalFiles = selectedFiles.map((file) => ({ name: file.name, size: file.size }))

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('clario-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'))
  }

  // Validates file count and sizes before storing; toasts and drops violations.
  const handleFilesSelected = (files) => {
    setSelectedFiles((current) => {
      const merged = [...current, ...files]
      const uniqueMap = new Map()
      merged.forEach((file) => {
        const key = `${file.name}_${file.size}_${file.lastModified}`
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, file)
        }
      })

      const deduped = Array.from(uniqueMap.values())
      const duplicateCount = merged.length - deduped.length
      if (duplicateCount > 0) {
        toast.error(`Skipped ${duplicateCount} duplicate file(s).`, { duration: 4000 })
      }

      const nonEmpty = deduped.filter((file) => {
        if (file.size === 0) {
          toast.error(`"${file.name}" is empty (0 bytes). Please upload a non-empty file.`, {
            duration: 5000,
          })
          return false
        }
        return true
      })

      const sizeValid = nonEmpty.filter((file) => {
        if (file.size > MAX_FILE_SIZE) {
          const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
          toast.error(`"${file.name}" is ${sizeMB} MB — files must be under 10 MB.`, {
            duration: 5000,
          })
          return false
        }
        return true
      })

      let capped = sizeValid
      if (sizeValid.length > 10) {
        toast.error(`Too many files — only 10 allowed. ${sizeValid.length - 10} file(s) were not added.`, {
          duration: 5000,
        })
        capped = sizeValid.slice(0, 10)
      }

      setAnalysisResults([])
      setFolderTreeData(null)
      setError('')
      return capped
    })
  }

  const handleRemoveFile = (targetFile) => {
    setSelectedFiles((current) =>
      current.filter((file) => !(file.name === targetFile.name && file.size === targetFile.size))
    )
    setAnalysisResults([])
    setFolderTreeData(null)
    setError('')
  }

  const handleReset = () => {
    setSelectedFiles([])
    setAnalysisResults([])
    setFolderTreeData(null)
    setError('')
  }

  // Normalizes backend /organize response into the tree shape used by FolderTree.
  const mapOrganizePreviewToTree = (preview) => ({
    name: preview?.root || 'Clario Workspace',
    children: (preview?.folders || []).map((folder) => ({
      name: folder.name,
      children: folder.files || [],
    })),
  })

  const mapFoldersToOriginalName = (preview, results = []) => {
    const folderByFile = {}
    const originalByNewName = {}
    results.forEach((result) => {
      if (result?.new_name && result?.original_name) {
        originalByNewName[result.new_name] = result.original_name
      }
    })
    ;(preview?.folders || []).forEach((folder) => {
      ;(folder.files || []).forEach((fileName) => {
        folderByFile[fileName] = folder.name
        const mappedOriginal = originalByNewName[fileName]
        if (mappedOriginal) {
          folderByFile[mappedOriginal] = folder.name
        }
      })
    })
    return folderByFile
  }

  const getKeywordBasedPlaceholder = (fileName) => {
    const lowerName = fileName.toLowerCase()
    if (lowerName.includes('resume') || lowerName.includes('cv')) {
      return 'software engineering resume content'
    }
    if (
      lowerName.includes('notes') ||
      lowerName.includes('lecture') ||
      lowerName.includes('assignment')
    ) {
      return 'academic course notes and study material'
    }
    if (
      lowerName.includes('recipe') ||
      lowerName.includes('pasta') ||
      lowerName.includes('cake') ||
      lowerName.includes('cooking')
    ) {
      return 'recipe instructions ingredients and cooking steps'
    }
    if (
      lowerName.includes('receipt') ||
      lowerName.includes('invoice') ||
      lowerName.includes('bill') ||
      lowerName.includes('payment')
    ) {
      return 'transaction receipt and payment details'
    }
    if (
      lowerName.includes('flight') ||
      lowerName.includes('hotel') ||
      lowerName.includes('itinerary') ||
      lowerName.includes('boarding')
    ) {
      return 'travel booking and itinerary information'
    }
    if (
      lowerName.includes('screenshot') ||
      lowerName.includes('image') ||
      lowerName.includes('photo')
    ) {
      return 'screenshot or image content'
    }
    if (
      lowerName.includes('passport') ||
      lowerName.includes('license') ||
      lowerName.includes('id') ||
      lowerName.includes('statement')
    ) {
      return 'personal document information'
    }
    return 'general document content'
  }

  const getFileExtension = (fileName = '') => {
    const parts = fileName.toLowerCase().split('.')
    return parts.length > 1 ? parts[parts.length - 1] : ''
  }

  const toSafeSlug = (value = '') =>
    String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

  const toZipSafeFolder = (value = '') => toSafeSlug(value) || 'organized-files'

  const toZipSafeFileName = (value = '') => {
    const raw = String(value || '').trim()
    const baseName = raw.split(/[\\/]/).pop() || 'file'
    return baseName.replace(/\s+/g, ' ').trim() || 'file'
  }

  const buildZipFileName = (candidateName = '') => {
    const cleaned = toSafeSlug(candidateName || buildDefaultZipNameFromDate())
    return cleaned.endsWith('.zip') ? cleaned : `${cleaned}.zip`
  }

  const normalizeText = (value = '') => String(value).replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_CHARS)

  const isSupportedExtension = (extension) =>
    SUPPORTED_TEXT_EXTENSIONS.includes(extension) || SUPPORTED_IMAGE_EXTENSIONS.includes(extension)

  const readImageAsBase64 = async (file) => {
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let index = 0; index < bytes.length; index += 1) {
      binary += String.fromCharCode(bytes[index])
    }
    return btoa(binary)
  }

  const readPdfText = async (file) => {
    try {
      const bytes = await file.arrayBuffer()
      const pdf = await getDocument({ data: bytes }).promise
      const pages = []

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber)
        const textContent = await page.getTextContent()
        const pageText = textContent.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
          .trim()
        if (pageText) {
          pages.push(pageText)
        }
      }

      if (pages.length > 0) {
        return pages.join('\n')
      }
    } catch (pdfError) {
      throw new Error(
        `Could not read PDF "${file.name}". The file may be corrupted or unsupported.`
      )
    }
    throw new Error(`PDF "${file.name}" contains no readable text content.`)
  }

  const readDocLikeText = async (file) => {
    try {
      const buffer = await file.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer: buffer })
      const text = normalizeText(result.value)
      if (text) return text
    } catch {
      // fall through to plain text fallback
    }
    const fallback = normalizeText(await file.text())
    if (fallback) return fallback
    throw new Error(`Could not extract text from "${file.name}".`)
  }

  const readSpreadsheetText = async (file) => {
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheetTexts = workbook.SheetNames.map((sheetName) =>
        XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], { blankrows: false })
      )
      const merged = normalizeText(sheetTexts.join('\n'))
      if (merged) return merged
    } catch {
      // fallback below
    }
    const fallback = normalizeText(await file.text())
    if (fallback) return fallback
    throw new Error(`Could not extract spreadsheet content from "${file.name}".`)
  }

  // Extracts per-file text for backend analysis with practical fallbacks.
  const extractFilePayload = async (file) => {
    const extension = getFileExtension(file.name)
    const mimeType = (file.type || '').toLowerCase()

    if (UNSUPPORTED_EXTENSIONS.includes(extension)) {
      throw new Error(
        `Unsupported file type: ${file.name}. Please upload documents or images only.`
      )
    }

    if (extension && !isSupportedExtension(extension)) {
      throw new Error(
        `Unsupported file type: ${file.name}. Please upload documents or images only.`
      )
    }

    if (extension === 'txt' || extension === 'md') {
      return { text: normalizeText(await file.text()) }
    }

    if (!extension) {
      const text = normalizeText(await file.text())
      return { text: text || getKeywordBasedPlaceholder(file.name) }
    }

    if (extension === 'pdf' || mimeType.includes('pdf')) {
      return { text: await readPdfText(file) }
    }

    if (extension === 'docx' || extension === 'doc') {
      return { text: await readDocLikeText(file) }
    }

    if (extension === 'xlsx' || extension === 'csv') {
      return { text: await readSpreadsheetText(file) }
    }

    if (['json', 'html', 'xml'].includes(extension)) {
      return { text: normalizeText(await file.text()) }
    }

    if (
      SUPPORTED_IMAGE_EXTENSIONS.includes(extension) ||
      mimeType.startsWith('image/')
    ) {
      return {
        text: `Image file "${file.name}" (${mimeType || extension || 'unknown type'}) for visual analysis.`,
        imageData: await readImageAsBase64(file),
        mediaType: mimeType || 'image/jpeg',
      }
    }

    throw new Error(`Unsupported file type: ${file.name}. Please upload documents or images only.`)
  }

  // Converts browser File objects into backend /analyze payload shape.
  // Skips files with unsupported types and shows a toast for each one.
  const buildAnalyzePayload = async (files) => {
    const results = await Promise.all(
      files.map(async (file) => {
        try {
          const extracted = await extractFilePayload(file)
          const payload = {
            name: file.name,
            type: file.type || 'unknown',
            text: extracted.text || getKeywordBasedPlaceholder(file.name),
          }
          if (extracted.imageData) {
            payload.image_data = extracted.imageData
            payload.media_type = extracted.mediaType
          }
          return payload
        } catch (fileError) {
          toast.error(fileError.message, { duration: 5000 })
          return null
        }
      })
    )

    return { files: results.filter(Boolean) }
  }

  // Analyze files first, then ask backend to generate folder organization preview.
  const handleAnalyzeFiles = async () => {
    if (selectedFiles.length === 0) {
      const msg = 'Please select at least one file before analyzing.'
      setError(msg)
      toast.error(msg)
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const payload = await buildAnalyzePayload(selectedFiles)
      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        let details = ''
        try {
          const errData = await response.json()
          details = errData?.details || errData?.error || ''
        } catch {
          void 0
        }
        throw new Error(details || `Analyze request failed with status ${response.status}`)
      }

      const data = await response.json()
      const results = data.results || []
      setAnalysisResults(results)

      const organizeResponse = await fetch(`${API_BASE_URL}/organize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analyzed_files: results }),
      })

      if (!organizeResponse.ok) {
        let details = ''
        try {
          const errData = await organizeResponse.json()
          details = errData?.details || errData?.error || ''
        } catch {
          void 0
        }
        throw new Error(details || `Organize request failed with status ${organizeResponse.status}`)
      }

      const organizeData = await organizeResponse.json()
      const folderMap = mapFoldersToOriginalName(organizeData.preview, results)
      const enrichedResults = results.map((item) => ({
        ...item,
        assigned_folder:
          folderMap[item.original_name] ||
          folderMap[item.new_name] ||
          item.category ||
          'organized-files',
      }))
      setAnalysisResults(enrichedResults)
      setFolderTreeData(mapOrganizePreviewToTree(organizeData.preview))
    } catch (requestError) {
      const msg = requestError.message || 'Failed to process files. Please try again.'
      setError(msg)
      toast.error(msg)
      setAnalysisResults([])
      setFolderTreeData(null)
    } finally {
      setIsLoading(false)
    }
  }

  // Builds a ZIP in-memory with files grouped into their AI-assigned category folders.
  const handleDownloadZip = async () => {
    if (selectedFiles.length === 0 || analysisResults.length === 0) return

    const toastId = toast.loading('Building ZIP…')
    try {
      const zip = new JSZip()

      // Build a lookup map: "name_size" → category from analysis results.
      // selectedFiles still holds the original File objects in RAM.
      const categoryMap = {}
      analysisResults.forEach((result) => {
        // Match the file in selectedFiles to get its size for the key.
        const match = selectedFiles.find((f) => f.name === result.original_name)
        if (match) {
          const key = `${match.name}_${match.size}`
          categoryMap[key] = result.assigned_folder || result.category || 'organized-files'
        }
      })

      selectedFiles.forEach((file) => {
        const key = `${file.name}_${file.size}`
        const folder = toZipSafeFolder(categoryMap[key] || 'organized-files')
        const zipFileName = toZipSafeFileName(file.name)
        // Single-level ZIP layout: root/folder/file only.
        zip.folder(folder).file(zipFileName, file, { date: new Date(file.lastModified) })
      })

      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      const defaultName = buildZipFileName(buildDefaultZipNameFromDate())
      let finalName = defaultName
      const wantsRename = window.confirm(
        `Download filename: ${defaultName}\n\nClick OK to rename before downloading, or Cancel to keep this name.`
      )
      if (wantsRename) {
        const suggested = defaultName.replace(/\.zip$/i, '')
        const customName = window.prompt('Enter ZIP filename (without .zip):', suggested)
        if (customName !== null && customName.trim()) {
          finalName = buildZipFileName(customName)
        }
      }
      anchor.download = finalName
      anchor.click()
      URL.revokeObjectURL(url)

      toast.success('ZIP downloaded!', { id: toastId })
    } catch (zipError) {
      toast.error(`ZIP failed: ${zipError.message}`, { id: toastId })
    }
  }

  return (
    <main className="app">
      <div className="orb orb-1" aria-hidden="true" />
      <div className="orb orb-2" aria-hidden="true" />
      <div className="orb orb-3" aria-hidden="true" />
      <div className="orb orb-4" aria-hidden="true" />
      <div className="orb orb-5" aria-hidden="true" />
      <button className="theme-toggle" type="button" onClick={toggleTheme}>
        {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
      </button>
      <Toaster
        position="top-right"
        toastOptions={{
          error: {
            style: {
              background: '#1e1e2e',
              color: '#f38ba8',
              border: '1px solid #f38ba8',
              borderRadius: '10px',
              fontFamily: 'Inter, sans-serif',
            },
            iconTheme: { primary: '#f38ba8', secondary: '#1e1e2e' },
          },
        }}
      />
      <header className="hero">
        <p className="hero-kicker">Clario Demo</p>
        <h1>Clario</h1>
        <p>AI-powered file organizer</p>
      </header>

      <section className="card">
        <h2>Upload</h2>
        <UploadBox
          onFilesSelected={handleFilesSelected}
          selectedCount={selectedFiles.length}
          isLoading={isLoading}
        />
        <div className="button-row">
          <button
            className="analyze-button"
            type="button"
            onClick={handleAnalyzeFiles}
            disabled={isLoading || selectedFiles.length === 0}
            title={selectedFiles.length === 0 ? 'Upload files first to start analysis.' : ''}
          >
            {isLoading ? 'Analyzing...' : 'Analyze Files'}
          </button>
          <button
            className="download-button"
            type="button"
            onClick={handleDownloadZip}
            disabled={analysisResults.length === 0 || isLoading}
          >
            ⬇ Download as ZIP
          </button>
          <button
            className="reset-button"
            type="button"
            onClick={handleReset}
            disabled={isLoading || (selectedFiles.length === 0 && analysisResults.length === 0)}
          >
            Start Over
          </button>
        </div>
        {isLoading ? <div className="loading-spinner" aria-label="Loading analysis" /> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </section>

      <section className="grid">
        <div className="card">
          <h2>Before: Selected Files</h2>
          <p className="section-subtitle">{originalFiles.length} file(s) selected</p>
          <FileList files={originalFiles} onRemoveFile={handleRemoveFile} isLoading={isLoading} />
        </div>

        <div className="card">
          <h2>After: AI Analysis</h2>
          <p className="section-subtitle">Renaming suggestions, categories, and reasoning</p>
          <AnalysisResults results={analysisResults} />
        </div>
      </section>

      <section className="card">
        <h2>Folder Tree Preview</h2>
        <p className="section-subtitle">Backend-generated organization structure</p>
        {folderTreeData ? (
          <FolderTree tree={folderTreeData} />
        ) : (
          <p className="result-summary">
            Run Analyze Files to generate a backend folder preview.
          </p>
        )}
      </section>
    </main>
  )
}

export default App
