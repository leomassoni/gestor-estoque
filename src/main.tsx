import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import {
  accessProfilesStorageKey,
  companiesStorageKey,
  syncedAppStorageKeys,
  usersStorageKey,
} from './storage/localStorage'

const clientCacheVersionStorageKey = 'gestor-estoque:client-cache-version'
const clientCacheVersion = '2026-07-25-receitas-cache-reset'

function resetIncompatibleLocalCache() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (window.localStorage.getItem(clientCacheVersionStorageKey) === clientCacheVersion) {
      return
    }

    ;[
      ...syncedAppStorageKeys,
      companiesStorageKey,
      usersStorageKey,
      accessProfilesStorageKey,
    ].forEach((key) => window.localStorage.removeItem(key))
    window.localStorage.setItem(clientCacheVersionStorageKey, clientCacheVersion)
  } catch {
    return
  }
}

resetIncompatibleLocalCache()

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[app-runtime-error]', error, info)
  }

  clearLocalCacheAndReload() {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith('gestor-estoque:'))
      .forEach((key) => window.localStorage.removeItem(key))
    window.location.reload()
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <main className="runtime-error-shell">
        <section className="runtime-error-card">
          <p className="kicker">Falha ao carregar o aplicativo</p>
          <h1>O navegador encontrou um estado local incompatível.</h1>
          <p>
            Os dados do servidor não serão apagados. Use a limpeza abaixo para remover apenas o cache local deste
            navegador e carregar os dados novamente do backend.
          </p>
          <pre>{this.state.error.message}</pre>
          <div className="form-actions">
            <button type="button" className="primary-button" onClick={() => this.clearLocalCacheAndReload()}>
              Limpar cache local e recarregar
            </button>
          </div>
        </section>
      </main>
    )
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
)
