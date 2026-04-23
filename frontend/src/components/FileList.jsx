// Displays the original filenames before AI analysis.
function FileList({ files }) {
  if (files.length === 0) {
    return <p className="result-summary">No files selected yet.</p>
  }

  return (
    <ul className="file-list">
      {files.map((file) => (
        <li key={file} className="file-item">
          {file}
        </li>
      ))}
    </ul>
  )
}

export default FileList
