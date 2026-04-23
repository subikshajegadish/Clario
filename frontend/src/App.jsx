import { useState } from 'react'
import './App.css'
import UploadBox from './components/UploadBox'
import FileList from './components/FileList'
import AnalysisResults from './components/AnalysisResults'
import FolderTree from './components/FolderTree'
import { API_BASE_URL } from './config'

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

  // Placeholder text mapping until real OCR/text extraction is connected.
  const getPlaceholderText = (fileName) => {
    const lowerName = fileName.toLowerCase()
    if (lowerName.includes('resume')) return 'Software engineering resume content'
    if (lowerName.includes('notes')) return 'Distributed systems lecture notes'
    return 'General document content'
  }

  // Converts browser File objects into backend /analyze payload shape.
  const buildAnalyzePayload = (files) => ({
    files: files.map((file) => ({
      name: file.name,
      type: file.type || 'unknown',
      text: getPlaceholderText(file.name),
    })),
    mode: 'general',
  })

  // Analyze files first, then ask backend to generate folder organization preview.
  const handleAnalyzeFiles = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select at least one file before analyzing.')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const payload = buildAnalyzePayload(selectedFiles)
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
        <h1>Clario</h1>
        <p>AI-powered file organizer</p>
      </header>

      <section className="card">
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
          <h2>Before</h2>
          <FileList files={originalFiles} />
        </div>

        <div className="card">
          <h2>After</h2>
          <AnalysisResults results={analysisResults} />
        </div>
      </section>

      <section className="card">
        <h2>Folder Tree Preview</h2>
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
