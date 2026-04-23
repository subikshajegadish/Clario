import { useState } from 'react'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import './App.css'
import UploadBox from './components/UploadBox'
import FileList from './components/FileList'
import AnalysisResults from './components/AnalysisResults'
import FolderTree from './components/FolderTree'
import { API_BASE_URL } from './config'

GlobalWorkerOptions.workerSrc = pdfWorker

function App() {
  const [selectedFiles, setSelectedFiles] = useState([])
  const [analysisResults, setAnalysisResults] = useState([])
  const [folderTreeData, setFolderTreeData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const originalFiles = selectedFiles.map((file) => file.name)

  // Normalizes backend /organize response into the tree shape used by FolderTree.
  const mapOrganizePreviewToTree = (preview) => ({
    name: preview?.root || 'Clario Workspace',
    children: (preview?.folders || []).map((folder) => ({
      name: folder.name,
      children: folder.files || [],
    })),
  })

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
      // Fall back cleanly if browser-side PDF parsing fails.
      void pdfError
    }

    return `PDF file uploaded (${file.name}). Text extraction is limited for this file in-browser.`
  }

  // Extracts per-file text for backend analysis with practical fallbacks.
  const extractFileText = async (file) => {
    const extension = getFileExtension(file.name)
    const mimeType = (file.type || '').toLowerCase()

    if (extension === 'txt' || extension === 'md') {
      return file.text()
    }

    if (extension === 'pdf' || mimeType.includes('pdf')) {
      return readPdfText(file)
    }

    if (
      ['png', 'jpg', 'jpeg', 'webp'].includes(extension) ||
      mimeType.startsWith('image/')
    ) {
      return 'image file uploaded'
    }

    return `Unsupported file type uploaded (${file.name}, ${file.type || 'unknown type'}).`
  }

  // Converts browser File objects into backend /analyze payload shape.
  const buildAnalyzePayload = async (files) => {
    const extractedFiles = await Promise.all(
      files.map(async (file) => {
        const extractedText = await extractFileText(file)
        return {
          name: file.name,
          type: file.type || 'unknown',
          text: extractedText || getKeywordBasedPlaceholder(file.name),
        }
      })
    )

    return { files: extractedFiles }
  }

  // Analyze files first, then ask backend to generate folder organization preview.
  const handleAnalyzeFiles = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select at least one file before analyzing.')
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
        throw new Error(`Analyze request failed with status ${response.status}`)
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
        throw new Error(`Organize request failed with status ${organizeResponse.status}`)
      }

      const organizeData = await organizeResponse.json()
      setFolderTreeData(mapOrganizePreviewToTree(organizeData.preview))
    } catch (requestError) {
      setError(requestError.message || 'Failed to process files. Please try again.')
      setAnalysisResults([])
      setFolderTreeData(null)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="app">
      <header className="hero">
        <p className="hero-kicker">Clario Demo</p>
        <h1>Clario</h1>
        <p>AI-powered file organizer</p>
      </header>

      <section className="card">
        <h2>Upload</h2>
        <p className="section-subtitle">
          Select files and run AI analysis to preview smart naming and folders.
        </p>
        <p className="mode-helper">
          Clario automatically detects file themes and groups similar files together.
        </p>
        <UploadBox onFilesSelected={setSelectedFiles} />
        <button
          className="analyze-button"
          type="button"
          onClick={handleAnalyzeFiles}
          disabled={isLoading}
        >
          {isLoading ? 'Analyzing...' : 'Analyze Files'}
        </button>
        {error ? <p className="error-text">{error}</p> : null}
      </section>

      <section className="grid">
        <div className="card">
          <h2>Before: Selected Files</h2>
          <p className="section-subtitle">{originalFiles.length} file(s) selected</p>
          <FileList files={originalFiles} />
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
