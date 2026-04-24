import { useEffect, useState } from 'react'

// Shows the renamed output and metadata returned by analysis.
function AnalysisResults({ results }) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    setActiveIndex(0)
  }, [results.length])

  const getConfidenceClass = (confidence = 0) => {
    if (confidence >= 0.9) return 'confidence-high'
    if (confidence >= 0.7) return 'confidence-medium'
    return 'confidence-low'
  }

  const toBadgeClass = (category = '') =>
    `result-category badge-${String(category).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  if (results.length === 0) {
    return <p className="result-summary">No analysis yet. Click Analyze Files.</p>
  }

  const current = results[activeIndex]

  return (
    <div className="results-list carousel">
      <div className="carousel-header">
        <button
          type="button"
          className="carousel-arrow"
          onClick={() => setActiveIndex((currentIndex) => (currentIndex - 1 + results.length) % results.length)}
          aria-label="Previous analysis result"
        >
          ←
        </button>
        <p className="carousel-counter">
          {activeIndex + 1} of {results.length}
        </p>
        <button
          type="button"
          className="carousel-arrow"
          onClick={() => setActiveIndex((currentIndex) => (currentIndex + 1) % results.length)}
          aria-label="Next analysis result"
        >
          →
        </button>
      </div>
      <article key={current.original_name || current.new_name} className="result-card carousel-slide">
        <p className="result-label">Original</p>
        <p className="result-meta">{current.original_name}</p>
        <p className="result-label">Renamed To</p>
        <p className="result-name">{current.new_name}</p>
        <p className={toBadgeClass(current.category)}>{current.category}</p>
        <p className="result-summary">{current.summary}</p>
        <div className="confidence-row">
          <p className="result-meta">
            <strong>Confidence:</strong> {Math.round((current.confidence || 0) * 100)}%
          </p>
          <div className="confidence-bar-track" aria-hidden="true">
            <div
              className={`confidence-bar-fill ${getConfidenceClass(current.confidence)}`}
              style={{ width: `${Math.round((current.confidence || 0) * 100)}%` }}
            />
          </div>
        </div>
        <p className="result-meta result-reasoning">
          <strong>Reasoning:</strong> {current.reasoning}
        </p>
        {current.keywords?.length ? (
          <p className="result-meta">
            <strong>Keywords:</strong> {current.keywords.join(', ')}
          </p>
        ) : null}
      </article>
    </div>
  )
}

export default AnalysisResults
