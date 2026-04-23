// Displays the original filenames + sizes before AI analysis.
const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileList({ files }) {
  if (files.length === 0) {
    return <p className="result-summary">No files selected yet.</p>
  }

  return (
    <ul className="file-list">
      {files.map((file) => (
        <li key={`${file.name}_${file.size}`} className="file-item">
          <span className="file-item-name">{file.name}</span>
          <span className="file-item-size">{formatSize(file.size)}</span>
        </li>
      ))}
    </ul>
  )
}

export default FileList
