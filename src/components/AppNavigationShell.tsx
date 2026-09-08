import { memo } from 'react'
import type { AppSection, CompanyRecord, Session } from '../types/domain'

export function getAppSectionDisplayLabel(section: AppSection) {
  if (section === 'FichasTecnicas') return 'Fichas Tecnicas'
  if (section === 'Itens') return 'Utensilios e Recipientes'
  if (section === 'CentrosEstoque') return 'Centros de estoque'
  if (section === 'ConfiguracoesEstoque') return 'Importar vendas'
  if (section === 'Requisicoes') return 'Requisicao'
  if (section === 'Compras') return 'Compras'
  if (section === 'RelatoriosEstoque') return 'Relatorios'
  if (section === 'EntradaProducoes') return 'Entrada de producoes'
  if (section === 'Desperdicio') return 'Desperdicio'
  if (section === 'PainelMaster') return 'Painel master'
  return section
}

type AppSidebarProps = {
  activeSection: AppSection
  allowedSections: AppSection[]
  allowedCadastroSections: AppSection[]
  allowedEstoqueSections: AppSection[]
  hasCadastrosAccess: boolean
  hasEstoqueAccess: boolean
  isCadastrosActive: boolean
  isEstoqueActive: boolean
  isCadastrosMenuOpen: boolean
  isEstoqueMenuOpen: boolean
  isMobileSidebarOpen: boolean
  onCloseMobileSidebar: () => void
  onNavigate: (section: AppSection) => void
  onToggleCadastrosMenu: () => void
  onToggleEstoqueMenu: () => void
  onShowProductList: () => void
  onShowItemList: () => void
  onShowTechnicalSheetList: () => void
  onLogout: () => void
}

function AppSidebarComponent({
  activeSection,
  allowedSections,
  allowedCadastroSections,
  allowedEstoqueSections,
  hasCadastrosAccess,
  hasEstoqueAccess,
  isCadastrosActive,
  isEstoqueActive,
  isCadastrosMenuOpen,
  isEstoqueMenuOpen,
  isMobileSidebarOpen,
  onCloseMobileSidebar,
  onNavigate,
  onToggleCadastrosMenu,
  onToggleEstoqueMenu,
  onShowProductList,
  onShowItemList,
  onShowTechnicalSheetList,
  onLogout,
}: AppSidebarProps) {
  function handleCadastroNavigation(section: AppSection) {
    onNavigate(section)
    if (section === 'Produtos') {
      onShowProductList()
    }
    if (section === 'Itens') {
      onShowItemList()
    }
    if (section === 'FichasTecnicas') {
      onShowTechnicalSheetList()
    }
  }

  return (
    <>
      <div
        className={`sidebar-backdrop${isMobileSidebarOpen ? ' open' : ''}`}
        role="presentation"
        onClick={onCloseMobileSidebar}
      />
      <aside className={`sidebar${isMobileSidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-inner">
          <div>
            <p className="kicker auth-eyebrow sidebar-title">Gestor de Estoque</p>
          </div>

          <nav className="sidebar-nav" aria-label="Navegacao principal">
            {(['PainelMaster'] as const)
              .filter((section) => allowedSections.includes(section))
              .map((section) => (
                <button
                  key={section}
                  type="button"
                  className={activeSection === section ? 'nav-item active' : 'nav-item'}
                  onClick={() => onNavigate(section)}
                >
                  {getAppSectionDisplayLabel(section)}
                </button>
              ))}
            {(['Receituarios'] as const)
              .filter((section) => allowedSections.includes(section))
              .map((section) => (
                <button
                  key={section}
                  type="button"
                  className={activeSection === section ? 'nav-item active' : 'nav-item'}
                  onClick={() => onNavigate(section)}
                >
                  Receituarios
                </button>
              ))}
            {hasCadastrosAccess ? (
              <div className="sidebar-group">
                <button
                  type="button"
                  className={isCadastrosActive ? 'nav-item active' : 'nav-item'}
                  onClick={onToggleCadastrosMenu}
                  aria-expanded={isCadastrosMenuOpen}
                >
                  <span>Cadastros</span>
                  <span className="nav-caret" aria-hidden="true">
                    {isCadastrosMenuOpen ? '▾' : '▸'}
                  </span>
                </button>
                {isCadastrosMenuOpen ? (
                  <div className="sidebar-subnav">
                    {allowedCadastroSections.map((section) => (
                      <button
                        key={section}
                        type="button"
                        className={activeSection === section ? 'nav-subitem active' : 'nav-subitem'}
                        onClick={() => handleCadastroNavigation(section)}
                      >
                        {getAppSectionDisplayLabel(section)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {hasEstoqueAccess ? (
              <div className="sidebar-group">
                <button
                  type="button"
                  className={isEstoqueActive ? 'nav-item active' : 'nav-item'}
                  onClick={onToggleEstoqueMenu}
                  aria-expanded={isEstoqueMenuOpen}
                >
                  <span>Estoque</span>
                  <span className="nav-caret" aria-hidden="true">
                    {isEstoqueMenuOpen ? '▾' : '▸'}
                  </span>
                </button>
                {isEstoqueMenuOpen ? (
                  <div className="sidebar-subnav">
                    {allowedEstoqueSections.map((section) => (
                      <button
                        key={section}
                        type="button"
                        className={activeSection === section ? 'nav-subitem active' : 'nav-subitem'}
                        onClick={() => onNavigate(section)}
                      >
                        {getAppSectionDisplayLabel(section)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {(['Empresa', 'Usuarios'] as const)
              .filter((section) => allowedSections.includes(section))
              .map((section) => (
                <button
                  key={section}
                  type="button"
                  className={activeSection === section ? 'nav-item active' : 'nav-item'}
                  onClick={() => onNavigate(section)}
                >
                  {section}
                </button>
              ))}
            <button
              type="button"
              className="nav-item sidebar-logout"
              onClick={() => {
                onCloseMobileSidebar()
                onLogout()
              }}
            >
              Sair
            </button>
          </nav>
        </div>
      </aside>
    </>
  )
}

type MobileTopbarProps = {
  activeSection: AppSection
  isMobileSidebarOpen: boolean
  onToggleMobileSidebar: () => void
}

function MobileTopbarComponent({
  activeSection,
  isMobileSidebarOpen,
  onToggleMobileSidebar,
}: MobileTopbarProps) {
  return (
    <section className="mobile-topbar">
      <button
        type="button"
        className="ghost-button mobile-menu-button"
        onClick={onToggleMobileSidebar}
        aria-expanded={isMobileSidebarOpen}
        aria-label={isMobileSidebarOpen ? 'Fechar menu principal' : 'Abrir menu principal'}
      >
        {isMobileSidebarOpen ? '✕' : '☰'}
      </button>
      <div className="mobile-topbar-copy">
        <p className="kicker">Navegacao</p>
        <strong>{getAppSectionDisplayLabel(activeSection)}</strong>
      </div>
    </section>
  )
}

type ActiveCompanyHeroProps = {
  currentCompany: CompanyRecord | null
  currentAppUserCompanyIds: number[]
  isSystemAdmin: boolean
  session: Session
  onSwitchCompany: () => void
}

function ActiveCompanyHeroComponent({
  currentCompany,
  currentAppUserCompanyIds,
  isSystemAdmin,
  session,
  onSwitchCompany,
}: ActiveCompanyHeroProps) {
  if (!currentCompany) {
    return null
  }

  return (
    <section className="hero-panel">
      <div>
        <p className="kicker">Empresa ativa</p>
        <h2>{currentCompany.tradeName}</h2>
        <p className="hero-copy">{currentCompany.legalName}</p>
        <div className="hero-details">
          <span>{session?.user.fullName || session?.user.username || 'Usuario logado'}</span>
          <span>{currentCompany.status}</span>
        </div>
      </div>
      <div className="hero-meta">
        {isSystemAdmin || currentAppUserCompanyIds.length > 1 ? (
          <button type="button" className="ghost-button" onClick={onSwitchCompany}>
            Trocar empresa
          </button>
        ) : null}
      </div>
    </section>
  )
}

export const AppSidebar = memo(AppSidebarComponent)
export const MobileTopbar = memo(MobileTopbarComponent)
export const ActiveCompanyHero = memo(ActiveCompanyHeroComponent)
