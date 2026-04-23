// Simple multi-file picker used by the analyze flow.
function UploadBox({ onFilesSelected }) {
  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || [])
    onFilesSelected(files)
  }

  return (
    <label className="upload-box">
      <input
        className="upload-input"
        type="file"
        multiple
        onChange={handleFileChange}
      />
      <p className="upload-title">Select files to analyze</p>
      <p className="upload-subtitle">Choose one or more files</p>
    </label>
  )
}

export default UploadBox
