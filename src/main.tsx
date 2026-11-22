import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AuthProvider } from './auth/AuthProvider'
import './styles.css'

type ErrorBoundaryState = { error: Error | null }

class AppErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('HealthyLife render error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{ minHeight: '100vh', padding: '32px 20px', background: '#f5f8f4', color: '#20352c', fontFamily: 'sans-serif' }}>
          <section style={{ maxWidth: 640, margin: '8vh auto', padding: 24, background: '#fff', border: '1px solid #e3ebe3', borderRadius: 16 }}>
            <h1>HealthyLife nu a putut porni</h1>
            <p>Am capturat eroarea pentru depanare:</p>
            <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 13 }}>{this.state.error.message}</pre>
            <p>Trimite o captură a acestui mesaj echipei de suport.</p>
          </section>
        </main>
      )
    }
    return this.props.children
  }
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  document.body.innerHTML = '<main style="padding:24px;font-family:sans-serif">HealthyLife: elementul aplicației nu a fost găsit în pagină.</main>'
} else {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <AuthProvider>
          <App />
        </AuthProvider>
      </AppErrorBoundary>
    </React.StrictMode>,
  )
}
