import { Component } from 'react'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    // Keep console logging for unexpected render/runtime crashes.
    // eslint-disable-next-line no-console
    console.error('Clario UI crashed', error)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app">
          <section className="card">
            <h2>Something went wrong</h2>
            <p className="result-summary">
              Clario hit an unexpected UI error. Reload to continue your session.
            </p>
            <button type="button" className="analyze-button" onClick={this.handleReload}>
              Reload App
            </button>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
