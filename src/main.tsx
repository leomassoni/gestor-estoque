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

function renderLocalStorageRescueIfRequested() {
  if (typeof window === 'undefined') {
    return false
  }

  const params = new URLSearchParams(window.location.search)
  if (params.get('rescueLocalStorage') !== '1') {
    return false
  }

  const root = document.getElementById('root')
  if (!root) {
    return true
  }

  const entries: Record<string, string> = {}
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith('gestor-estoque:'))
    .sort()
    .forEach((key) => {
      entries[key] = window.localStorage.getItem(key) ?? ''
    })

  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    origin: window.location.origin,
    href: window.location.href,
    userAgent: window.navigator.userAgent,
    entries,
  }
  const rawPayload = JSON.stringify(payload, null, 2)
  const fileName = `gestor-estoque-localstorage-resgate-${new Date().toISOString().replace(/[:.]/g, '-')}.json`

  root.innerHTML = ''
  const shell = document.createElement('main')
  shell.style.cssText =
    'min-height:100vh;padding:24px;font-family:Arial,sans-serif;background:#f6f7f9;color:#17202a;box-sizing:border-box;'

  const panel = document.createElement('section')
  panel.style.cssText =
    'max-width:760px;margin:0 auto;background:#fff;border:1px solid #d8dee6;border-radius:8px;padding:20px;box-shadow:0 8px 24px rgba(15,23,42,.08);'

  const title = document.createElement('h1')
  title.textContent = 'Resgate de dados locais'
  title.style.cssText = 'font-size:22px;margin:0 0 12px;'

  const description = document.createElement('p')
  description.textContent =
    'Esta tela nao sincroniza nem limpa dados. Ela apenas exporta as chaves locais do Gestor de Estoque deste navegador.'
  description.style.cssText = 'font-size:15px;line-height:1.45;margin:0 0 16px;'

  const summary = document.createElement('pre')
  summary.textContent = Object.entries(entries)
    .map(([key, value]) => `${key}: ${value.length} caracteres`)
    .join('\n') || 'Nenhuma chave local do Gestor de Estoque foi encontrada neste navegador.'
  summary.style.cssText =
    'white-space:pre-wrap;background:#f1f5f9;border:1px solid #d8dee6;border-radius:6px;padding:12px;max-height:220px;overflow:auto;font-size:12px;'

  const actions = document.createElement('div')
  actions.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;margin:16px 0;'

  const downloadButton = document.createElement('button')
  downloadButton.type = 'button'
  downloadButton.textContent = 'Baixar JSON'
  downloadButton.style.cssText =
    'border:0;border-radius:6px;background:#0f766e;color:#fff;font-weight:700;padding:10px 14px;font-size:14px;'
  downloadButton.onclick = () => {
    const blob = new Blob([rawPayload], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const copyButton = document.createElement('button')
  copyButton.type = 'button'
  copyButton.textContent = 'Copiar JSON'
  copyButton.style.cssText =
    'border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#17202a;font-weight:700;padding:10px 14px;font-size:14px;'
  copyButton.onclick = async () => {
    try {
      await window.navigator.clipboard.writeText(rawPayload)
      copyButton.textContent = 'JSON copiado'
    } catch {
      copyButton.textContent = 'Falha ao copiar'
    }
  }

  const note = document.createElement('p')
  note.textContent = `Arquivo sugerido: ${fileName}`
  note.style.cssText = 'font-size:12px;color:#475569;margin:0;'

  actions.append(downloadButton, copyButton)
  panel.append(title, description, summary, actions, note)
  shell.append(panel)
  root.append(shell)
  return true
}

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

const didRenderLocalStorageRescue = renderLocalStorageRescueIfRequested()

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

if (!didRenderLocalStorageRescue) {
  resetIncompatibleLocalCache()

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </React.StrictMode>,
  )
}
