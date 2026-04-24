// Displays the original filenames + sizes before AI analysis.
const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileList({ files, onRemoveFile, isLoading = false }) {
  if (files.length === 0) {
    return <p className="result-summary">No files selected yet.</p>
  }

  return (
    <ul className="file-list">
      {files.map((file) => (
        <li key={`${file.name}_${file.size}`} className="file-item">
          <span className="file-item-name">{file.name}</span>
          <div className="file-item-actions">
            <span className="file-item-size">{formatSize(file.size)}</span>
            {onRemoveFile ? (
              <button
                type="button"
                className="remove-file-button"
                onClick={() => onRemoveFile(file)}
                disabled={isLoading}
                aria-label={`Remove ${file.name}`}
              >
                Remove
              </button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  )
}

export default FileList
