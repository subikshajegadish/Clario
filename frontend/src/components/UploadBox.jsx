import { useRef, useState } from 'react'

// Multi-file picker with drag/drop support and hover state.
function UploadBox({ onFilesSelected, selectedCount = 0, isLoading = false }) {
  const [isDragActive, setIsDragActive] = useState(false)
  const inputRef = useRef(null)

  const handleFiles = (files) => {
    if (!isLoading) {
      onFilesSelected(files)
    }
  }

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || [])
    handleFiles(files)
  }

  const handleDragOver = (event) => {
    event.preventDefault()
    if (!isLoading) setIsDragActive(true)
  }

  const handleDragLeave = (event) => {
    event.preventDefault()
    setIsDragActive(false)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setIsDragActive(false)
    const files = Array.from(event.dataTransfer?.files || [])
    handleFiles(files)
  }

  return (
    <label
      className={`upload-box ${isDragActive ? 'upload-box-active' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        className="upload-input upload-input-hidden"
        type="file"
        multiple
        accept=".pdf,.txt,.md,.docx,.doc,.xlsx,.csv,.json,.html,.xml,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff"
        onChange={handleFileChange}
        disabled={isLoading}
      />
      <p className="upload-icon" aria-hidden="true">
        ⤴
      </p>
      <p className="upload-title">Drag and drop files here</p>
      <p className="upload-subtitle">or click anywhere to choose files</p>
      <p className="upload-count">{selectedCount} file{selectedCount === 1 ? '' : 's'} selected</p>
      <p className="upload-supported">
        Supported: .pdf .txt .md .docx .doc .xlsx .csv .json .html .xml .jpg .jpeg .png .webp
        .gif .bmp .tiff
      </p>
    </label>
  )
}

export default UploadBox
