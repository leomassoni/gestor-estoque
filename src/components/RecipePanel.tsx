import { useMemo, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { NormalizedTextInput } from './NormalizedTextField'
import { buildTechnicalSheetGeneratedDescription } from '../domain/technicalSheetDescriptions'
import { getTechnicalSheetYieldUnitLabel } from '../domain/technicalSheets'
import { formatDecimal, formatMoney } from '../utils/core'
import { buildPreparationModeMetricParts } from '../utils/preparationMode'
import type {
  AccessProfileRecord,
  FlavorProfileRecord,
  ProductRecord,
  RecipeExecutionGarnishColumnKey,
  RecipeExecutionIngredientColumnKey,
  RecipeExecutionServiceItemColumnKey,
  RecipePanelAccess,
  RecipePanelComputedData,
  RecipePanelIngredientMetrics,
  RecipePanelServiceItemMetrics,
  RecipePanelTab,
  RecipePreparoIngredientColumnKey,
  RecipePreparoServiceItemColumnKey,
  SharedPreparationSaleFeeInfo,
  TechnicalSheetFlavorProfileRating,
  TechnicalSheetRecord,
} from '../types/domain'

type Column<Key extends string> = { key: Key; label: string }

export type RecipePanelProps = {
  canPreviewRecipePanelProfiles: boolean
  recipePanelPreviewProfiles: AccessProfileRecord[]
  recipePanelPreviewProfileId: number | null
  setRecipePanelPreviewProfileId: Dispatch<SetStateAction<number | null>>
  openRecipeExportModal: () => void
  canViewRecipePreparoTab: boolean
  canViewRecipeExecucaoTab: boolean
  activeRecipePanelPreviewProfile: AccessProfileRecord | null
  recipePanelTab: RecipePanelTab
  setRecipePanelTab: Dispatch<SetStateAction<RecipePanelTab>>
  recipePanelListId: string
  recipePanelSearch: Record<RecipePanelTab, string>
  handleRecipePanelSearchChange: (tab: RecipePanelTab, value: string) => void
  filteredRecipePanelSheets: TechnicalSheetRecord[]
  recipePanelData: RecipePanelComputedData | null
  visibleRecipeExecutionHeroFields: RecipePanelAccess['executionHeroFields']
  visibleRecipePreparoHeroFields: RecipePanelAccess['preparoHeroFields']
  visibleRecipePanelExecutionBlocks: RecipePanelAccess['executionBlocks']
  recipePanelRecipeCount: Record<RecipePanelTab, string>
  handleRecipePanelRecipeCountChange: (tab: RecipePanelTab, value: string) => void
  recipePanelDesiredYield: Record<RecipePanelTab, string>
  handleRecipePanelDesiredYieldChange: (tab: RecipePanelTab, value: string) => void
  selectedRecipePanelSheetImageDataUrl: string
  technicalSheets: TechnicalSheetRecord[]
  products: ProductRecord[]
  flavorProfiles: FlavorProfileRecord[]
  visibleRecipeExecutionServiceItemColumnDefinitions: Column<RecipeExecutionServiceItemColumnKey>[]
  visibleRecipeExecutionIngredientColumnDefinitions: Column<RecipeExecutionIngredientColumnKey>[]
  visibleRecipePreparoIngredientColumnDefinitions: Column<RecipePreparoIngredientColumnKey>[]
  visibleRecipePreparoServiceItemColumnDefinitions: Column<RecipePreparoServiceItemColumnKey>[]
  visibleRecipeExecutionGarnishColumnDefinitions: Column<RecipeExecutionGarnishColumnKey>[]
  renderRecipeExecutionServiceItemColumnValue: (column: RecipeExecutionServiceItemColumnKey, item: RecipePanelServiceItemMetrics) => ReactNode
  renderRecipeExecutionIngredientColumnValue: (column: RecipeExecutionIngredientColumnKey, item: RecipePanelIngredientMetrics) => ReactNode
  renderRecipePreparoIngredientColumnValue: (column: RecipePreparoIngredientColumnKey, item: RecipePanelIngredientMetrics) => ReactNode
  renderRecipePreparoServiceItemColumnValue: (column: RecipePreparoServiceItemColumnKey, item: RecipePanelServiceItemMetrics) => ReactNode
  renderRecipeExecutionGarnishColumnValue: (column: RecipeExecutionGarnishColumnKey, item: RecipePanelIngredientMetrics) => ReactNode
  getTechnicalSheetFlavorProfileRatingsForDisplay: (sheet: TechnicalSheetRecord, profiles: FlavorProfileRecord[]) => TechnicalSheetFlavorProfileRating[]
  renderSharedPreparationSaleFeeCard: (info: SharedPreparationSaleFeeInfo | null | undefined, className?: string) => ReactNode
}

export function RecipePanel({
  canPreviewRecipePanelProfiles,
  recipePanelPreviewProfiles,
  recipePanelPreviewProfileId,
  setRecipePanelPreviewProfileId,
  openRecipeExportModal,
  canViewRecipePreparoTab,
  canViewRecipeExecucaoTab,
  activeRecipePanelPreviewProfile,
  recipePanelTab,
  setRecipePanelTab,
  recipePanelListId,
  recipePanelSearch,
  handleRecipePanelSearchChange,
  filteredRecipePanelSheets,
  recipePanelData,
  visibleRecipeExecutionHeroFields,
  visibleRecipePreparoHeroFields,
  visibleRecipePanelExecutionBlocks,
  recipePanelRecipeCount,
  handleRecipePanelRecipeCountChange,
  recipePanelDesiredYield,
  handleRecipePanelDesiredYieldChange,
  selectedRecipePanelSheetImageDataUrl,
  technicalSheets,
  products,
  flavorProfiles,
  visibleRecipeExecutionServiceItemColumnDefinitions,
  visibleRecipeExecutionIngredientColumnDefinitions,
  visibleRecipePreparoIngredientColumnDefinitions,
  visibleRecipePreparoServiceItemColumnDefinitions,
  visibleRecipeExecutionGarnishColumnDefinitions,
  renderRecipeExecutionServiceItemColumnValue,
  renderRecipeExecutionIngredientColumnValue,
  renderRecipePreparoIngredientColumnValue,
  renderRecipePreparoServiceItemColumnValue,
  renderRecipeExecutionGarnishColumnValue,
  getTechnicalSheetFlavorProfileRatingsForDisplay,
  renderSharedPreparationSaleFeeCard,
}: RecipePanelProps) {
  const recipePanelPreparationModeParts = useMemo(() => {
    if (!recipePanelData) return []
    const metrics = recipePanelData.sheet.kind === 'EXECUCAO'
      ? [...recipePanelData.ingredientMetrics, ...recipePanelData.garnishMetrics]
      : recipePanelData.ingredientMetrics
    return buildPreparationModeMetricParts(recipePanelData.sheet.preparationMode, metrics)
  }, [recipePanelData])

  return (
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="kicker">Receituarios</p>
              <h2>Painel de receitas</h2>
            </div>
            <div className="toolbar-actions">
              {canPreviewRecipePanelProfiles && recipePanelPreviewProfiles.length > 0 ? (
                <label className="field recipe-profile-preview-field">
                  <span>Visualizando como</span>
                  <select
                    value={recipePanelPreviewProfileId ?? ''}
                    onChange={(event) => {
                      const nextValue = event.target.value
                      setRecipePanelPreviewProfileId(nextValue === '' ? null : Number(nextValue))
                    }}
                  >
                    <option value="">Meu perfil</option>
                    {recipePanelPreviewProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button
                type="button"
                className="primary-button"
                onClick={openRecipeExportModal}
                disabled={!canViewRecipePreparoTab && !canViewRecipeExecucaoTab}
              >
                Exportar
              </button>
            </div>
          </div>

          {activeRecipePanelPreviewProfile ? (
            <div className="inline-warning-card recipe-profile-preview-banner">
              <div>
                <strong>Previa de visualizacao: {activeRecipePanelPreviewProfile.name}</strong>
                <p>
                  Esta tela usa apenas as configuracoes de receituario deste perfil. Seu usuario real,
                  permissoes e empresa ativa nao foram alterados.
                </p>
              </div>
              <button type="button" className="ghost-button" onClick={() => setRecipePanelPreviewProfileId(null)}>
                Voltar para meu perfil
              </button>
            </div>
          ) : null}

          <div className="panel-tabs" role="tablist" aria-label="Tipos de receituario">
            {canViewRecipePreparoTab ? (
              <button
                type="button"
                className={recipePanelTab === 'PREPARO' ? 'panel-tab active' : 'panel-tab'}
                onClick={() => setRecipePanelTab('PREPARO')}
              >
                Pre-preparos
              </button>
            ) : null}
            {canViewRecipeExecucaoTab ? (
              <button
                type="button"
                className={recipePanelTab === 'EXECUCAO' ? 'panel-tab active' : 'panel-tab'}
                onClick={() => setRecipePanelTab('EXECUCAO')}
              >
                Execucao
              </button>
            ) : null}
          </div>

          <div className="receituario-content">
            {canViewRecipePreparoTab || canViewRecipeExecucaoTab ? (
            <section className="inner-panel">
              <div className="form-grid receituario-search-grid">
                <label className="field search-field field-span-all">
                  <span>Buscar receita</span>
                  <NormalizedTextInput
                    list={recipePanelListId}
                    value={recipePanelSearch[recipePanelTab]}
                    onChange={(value) => handleRecipePanelSearchChange(recipePanelTab, value)}
                    commitMode="debounce"
                    placeholder={
                      recipePanelTab === 'PREPARO'
                        ? 'Digite o nome do pre-preparo'
                        : 'Digite o nome da ficha de execucao'
                    }
                  />
                  <datalist id={recipePanelListId}>
                    {filteredRecipePanelSheets.map((sheet) => (
                      <option key={sheet.id} value={sheet.name} />
                    ))}
                  </datalist>
                </label>
              </div>
            </section>
            ) : null}

              {canViewRecipePreparoTab || canViewRecipeExecucaoTab ? recipePanelData ? (
                <>
                  <section className="inner-panel">
                    <div className={recipePanelTab === 'EXECUCAO' ? 'receituario-hero' : undefined}>
                      {recipePanelTab === 'EXECUCAO' ? (
                        <>
                          <div className="receituario-hero-copy">
                            <div className="section-heading">
                              <div>
                                <p className="kicker">Ficha tecnica de execucao</p>
                                <h2>{recipePanelData.sheet.name}</h2>
                              </div>
                            </div>

                            <div className="receituario-summary-grid receituario-summary-grid-execucao">
                              <article
                                className={
                                  visibleRecipeExecutionHeroFields.family
                                    ? 'receituario-metric-card'
                                    : 'receituario-metric-card recipe-hero-preserve-desktop'
                                }
                                aria-hidden={!(visibleRecipeExecutionHeroFields.family)}
                              >
                                <span>Familia</span>
                                <strong>{recipePanelData.sheet.family}</strong>
                              </article>
                              <article
                                className={
                                  visibleRecipeExecutionHeroFields.subfamily
                                    ? 'receituario-metric-card'
                                    : 'receituario-metric-card recipe-hero-preserve-desktop'
                                }
                                aria-hidden={!(visibleRecipeExecutionHeroFields.subfamily)}
                              >
                                <span>Subfamilia</span>
                                <strong>{recipePanelData.sheet.subfamily}</strong>
                              </article>
                              <article
                                className={
                                  visibleRecipeExecutionHeroFields.sectors
                                    ? 'receituario-metric-card'
                                    : 'receituario-metric-card recipe-hero-preserve-desktop'
                                }
                                aria-hidden={!(visibleRecipeExecutionHeroFields.sectors)}
                              >
                                <span>Setores</span>
                                <strong>{recipePanelData.sheet.sectors.join(', ') || '-'}</strong>
                              </article>
                              <article
                                className={
                                  visibleRecipeExecutionHeroFields.baseYield
                                    ? 'receituario-metric-card'
                                    : 'receituario-metric-card recipe-hero-preserve-desktop'
                                }
                                aria-hidden={!(visibleRecipeExecutionHeroFields.baseYield)}
                              >
                                <span>Rendimento base</span>
                                <strong>
                                  {formatDecimal(recipePanelData.baseYield)} {getTechnicalSheetYieldUnitLabel(recipePanelData.sheet, technicalSheets, products)}
                                </strong>
                              </article>
                            </div>

                            <div className="form-grid receituario-controls-grid receituario-controls-grid-execucao">
                              <label
                                className={
                                  visibleRecipeExecutionHeroFields.recipeCount
                                    ? 'field'
                                    : 'field recipe-hero-preserve-desktop'
                                }
                                aria-hidden={!(visibleRecipeExecutionHeroFields.recipeCount)}
                              >
                                <span>Quantidade de receitas</span>
                                <input
                                  value={recipePanelRecipeCount[recipePanelTab]}
                                  onChange={(event) => handleRecipePanelRecipeCountChange(recipePanelTab, event.target.value)}
                                  placeholder="1"
                                />
                              </label>
                              <label
                                className={
                                  visibleRecipeExecutionHeroFields.desiredYield
                                    ? 'field'
                                    : 'field recipe-hero-preserve-desktop'
                                }
                                aria-hidden={!(visibleRecipeExecutionHeroFields.desiredYield)}
                              >
                                <span>Quantidade final desejada</span>
                                <input
                                  value={recipePanelDesiredYield[recipePanelTab]}
                                  onChange={(event) => handleRecipePanelDesiredYieldChange(recipePanelTab, event.target.value)}
                                  placeholder={formatDecimal(recipePanelData.baseYield)}
                                />
                              </label>
                            </div>

                            <div className="receituario-summary-grid receituario-summary-grid-metrics">
                              <article
                                className={
                                  visibleRecipeExecutionHeroFields.finalYield
                                    ? 'receituario-metric-card'
                                    : 'receituario-metric-card recipe-hero-preserve-desktop'
                                }
                                aria-hidden={!(visibleRecipeExecutionHeroFields.finalYield)}
                              >
                                <span>Rendimento final</span>
                                <strong>
                                  {formatDecimal(recipePanelData.desiredYield)} {getTechnicalSheetYieldUnitLabel(recipePanelData.sheet, technicalSheets, products)}
                                </strong>
                              </article>
                              <article
                                className={
                                  visibleRecipeExecutionHeroFields.finalAlcoholPercentage
                                    ? 'receituario-metric-card'
                                    : 'receituario-metric-card recipe-hero-preserve-desktop'
                                }
                                aria-hidden={!(visibleRecipeExecutionHeroFields.finalAlcoholPercentage)}
                              >
                                <span>% alcool final</span>
                                <strong>{formatDecimal(recipePanelData.finalAlcoholPercentage)}%</strong>
                              </article>
                              <article
                                className={
                                  visibleRecipeExecutionHeroFields.finalCmvPercentage
                                    ? 'receituario-metric-card'
                                    : 'receituario-metric-card recipe-hero-preserve-desktop'
                                }
                                aria-hidden={!(visibleRecipeExecutionHeroFields.finalCmvPercentage)}
                              >
                                <span>CMV final</span>
                                <strong>{formatDecimal(recipePanelData.finalCmvPercentage)}%</strong>
                              </article>
                              <article
                                className={
                                  visibleRecipeExecutionHeroFields.finalSalePrice
                                    ? 'receituario-metric-card'
                                    : 'receituario-metric-card recipe-hero-preserve-desktop'
                                }
                                aria-hidden={!(visibleRecipeExecutionHeroFields.finalSalePrice)}
                              >
                                <span>Valor final de venda</span>
                                <strong>R$ {formatMoney(recipePanelData.finalSalePrice)}</strong>
                              </article>
                            </div>

                          </div>

                          {visibleRecipePanelExecutionBlocks.productImage ? (
                          <aside className="receituario-hero-media receituario-hero-media-execucao" aria-label="Apresentacao visual do produto">
                              <div
                                className={
                                  selectedRecipePanelSheetImageDataUrl
                                    ? 'receituario-hero-image-frame'
                                    : 'receituario-hero-image-frame receituario-hero-image-frame-empty'
                                }
                              >
                                {selectedRecipePanelSheetImageDataUrl ? (
                                  <img
                                    src={selectedRecipePanelSheetImageDataUrl}
                                    alt={`Foto de ${recipePanelData.sheet.name}`}
                                    className="receituario-hero-image"
                                  />
                                ) : (
                                  <div className="receituario-hero-image-placeholder">
                                    <span>Foto do produto nao cadastrada.</span>
                                  </div>
                                )}
                              </div>
                            </aside>
                          ) : null}
                        </>
                      ) : (
                        <div>
                          <div className="section-heading">
                            <div>
                              <p className="kicker">
                                {recipePanelTab === 'PREPARO' ? 'Ficha tecnica de pre-preparo' : 'Ficha tecnica de execucao'}
                              </p>
                              <h2>{recipePanelData.sheet.name}</h2>
                              {recipePanelTab === 'PREPARO' ? (
                                <div className="receituario-colors">
                                  <span>Cores</span>
                                  <div className="receituario-color-dots" aria-label="Cores da ficha">
                                    <span
                                      className={
                                        recipePanelData.sheet.colorTagOne
                                          ? 'color-swatch color-swatch-filled receituario-color-dot'
                                          : 'color-swatch receituario-color-dot'
                                      }
                                      style={
                                        recipePanelData.sheet.colorTagOne
                                          ? { backgroundColor: recipePanelData.sheet.colorTagOne }
                                          : undefined
                                      }
                                      aria-label={recipePanelData.sheet.colorTagOne ? `Cor 1 ${recipePanelData.sheet.colorTagOne}` : 'Sem cor 1'}
                                      title={recipePanelData.sheet.colorTagOne || 'Sem cor'}
                                    >
                                      {recipePanelData.sheet.colorTagOne ? null : <span className="color-swatch-none">Ø</span>}
                                    </span>
                                    <span
                                      className={
                                        recipePanelData.sheet.colorTagTwo
                                          ? 'color-swatch color-swatch-filled receituario-color-dot'
                                          : 'color-swatch receituario-color-dot'
                                      }
                                      style={
                                        recipePanelData.sheet.colorTagTwo
                                          ? { backgroundColor: recipePanelData.sheet.colorTagTwo }
                                          : undefined
                                      }
                                      aria-label={recipePanelData.sheet.colorTagTwo ? `Cor 2 ${recipePanelData.sheet.colorTagTwo}` : 'Sem cor 2'}
                                      title={recipePanelData.sheet.colorTagTwo || 'Sem cor'}
                                    >
                                      {recipePanelData.sheet.colorTagTwo ? null : <span className="color-swatch-none">Ø</span>}
                                    </span>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <>
                            {visibleRecipePreparoHeroFields.family ||
                            visibleRecipePreparoHeroFields.subfamily ||
                            visibleRecipePreparoHeroFields.sectors ||
                            visibleRecipePreparoHeroFields.baseYield ? (
                            <div className="receituario-summary-grid">
                              {visibleRecipePreparoHeroFields.family ? (
                              <article className="receituario-metric-card">
                                <span>Familia</span>
                                <strong>{recipePanelData.sheet.family}</strong>
                              </article>
                              ) : null}
                              {visibleRecipePreparoHeroFields.subfamily ? (
                              <article className="receituario-metric-card">
                                <span>Subfamilia</span>
                                <strong>{recipePanelData.sheet.subfamily}</strong>
                              </article>
                              ) : null}
                              {visibleRecipePreparoHeroFields.sectors ? (
                              <article className="receituario-metric-card">
                                <span>Setores</span>
                                <strong>{recipePanelData.sheet.sectors.join(', ') || '-'}</strong>
                              </article>
                              ) : null}
                              {visibleRecipePreparoHeroFields.baseYield ? (
                              <article className="receituario-metric-card">
                                <span>Rendimento base</span>
                                <strong>
                                  {formatDecimal(recipePanelData.baseYield)} {getTechnicalSheetYieldUnitLabel(recipePanelData.sheet, technicalSheets, products)}
                                </strong>
                              </article>
                              ) : null}
                            </div>
                            ) : null}

                            {visibleRecipePreparoHeroFields.recipeCount || visibleRecipePreparoHeroFields.desiredYield ? (
                            <div className="form-grid receituario-controls-grid">
                              {visibleRecipePreparoHeroFields.recipeCount ? (
                              <label className="field">
                                <span>Quantidade de receitas</span>
                                <input
                                  value={recipePanelRecipeCount[recipePanelTab]}
                                  onChange={(event) => handleRecipePanelRecipeCountChange(recipePanelTab, event.target.value)}
                                  placeholder="1"
                                />
                              </label>
                              ) : null}
                              {visibleRecipePreparoHeroFields.desiredYield ? (
                              <label className="field">
                                <span>Volume final desejado</span>
                                <input
                                  value={recipePanelDesiredYield[recipePanelTab]}
                                  onChange={(event) => handleRecipePanelDesiredYieldChange(recipePanelTab, event.target.value)}
                                  placeholder={formatDecimal(recipePanelData.baseYield)}
                                />
                              </label>
                              ) : null}
                            </div>
                            ) : null}
                          </>
                        </div>
                      )}
                    </div>
                  </section>

                  {recipePanelTab === 'EXECUCAO' && visibleRecipePanelExecutionBlocks.serviceItems ? (
                    <section className="inner-panel">
                      <div className="section-heading">
                        <div>
                          <p className="kicker">Composicao de recipientes</p>
                          <h2>Recipientes de servico</h2>
                        </div>
                      </div>

                      {recipePanelData.serviceItemMetrics.length > 0 && visibleRecipeExecutionServiceItemColumnDefinitions.length > 0 ? (
                        <div className="table-wrap receituario-service-inline-table">
                          <table className="product-table">
                            <thead>
                              <tr>
                                {visibleRecipeExecutionServiceItemColumnDefinitions.map((column) => (
                                  <th key={column.key}>{column.label}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {recipePanelData.serviceItemMetrics.map((serviceItem) => (
                                <tr key={serviceItem.id}>
                                  {visibleRecipeExecutionServiceItemColumnDefinitions.map((column) => (
                                    <td key={`${serviceItem.id}-${column.key}`}>
                                      {renderRecipeExecutionServiceItemColumnValue(column.key, serviceItem)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : recipePanelData.serviceItemMetrics.length > 0 ? (
                        <div className="empty-state empty-state-inline">
                          <strong>Nenhuma coluna de recipiente habilitada para este perfil.</strong>
                        </div>
                      ) : (
                        <div className="empty-state empty-state-inline">
                          <strong>Nenhum recipiente de servico cadastrado.</strong>
                        </div>
                      )}
                    </section>
                  ) : null}

                  {recipePanelTab === 'EXECUCAO' ? (
                  visibleRecipePanelExecutionBlocks.ingredients ? (
                  <section className="inner-panel">
                    <div className="section-heading">
                      <div>
                        <p className="kicker">Composicao</p>
                        <h2>Insumos</h2>
                      </div>
                    </div>

                    {recipePanelData.ingredientMetrics.length > 0 && visibleRecipeExecutionIngredientColumnDefinitions.length > 0 ? (
                      <div className="table-wrap">
                        <table className="product-table">
                          <thead>
	                            <tr>
	                              {visibleRecipeExecutionIngredientColumnDefinitions.map((column) => (
	                                <th key={column.key}>{column.label}</th>
	                              ))}
	                            </tr>
                          </thead>
                          <tbody>
                            {recipePanelData.ingredientMetrics.map((ingredient) => (
                              <tr key={ingredient.id}>
                                {visibleRecipeExecutionIngredientColumnDefinitions.map((column) => (
                                  <td key={`${ingredient.id}-${column.key}`}>
                                    {renderRecipeExecutionIngredientColumnValue(column.key, ingredient)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : recipePanelData.ingredientMetrics.length > 0 ? (
                      <div className="empty-state empty-state-inline">
                        <strong>Nenhuma coluna de insumo habilitada para este perfil.</strong>
                      </div>
                    ) : (
                      <div className="empty-state empty-state-inline">
                        <strong>Nenhum insumo ativo cadastrado.</strong>
                        </div>
                      )}
                  </section>
                  ) : null
                  ) : (
                  <section className="inner-panel">
                    <div className="section-heading">
                      <div>
                        <p className="kicker">Composicao</p>
                        <h2>Insumos</h2>
                      </div>
                    </div>

                    {recipePanelData.ingredientMetrics.length > 0 && visibleRecipePreparoIngredientColumnDefinitions.length > 0 ? (
                      <div className="table-wrap">
                        <table className="product-table">
                          <thead>
                            <tr>
                              {visibleRecipePreparoIngredientColumnDefinitions.map((column) => (
                                <th key={column.key}>{column.label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {recipePanelData.ingredientMetrics.map((ingredient) => (
                              <tr key={ingredient.id}>
                                {visibleRecipePreparoIngredientColumnDefinitions.map((column) => (
                                  <td key={`${ingredient.id}-${column.key}`}>
                                    {renderRecipePreparoIngredientColumnValue(column.key, ingredient)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : recipePanelData.ingredientMetrics.length > 0 ? (
                      <div className="empty-state empty-state-inline">
                        <strong>Nenhuma coluna de insumo habilitada para este perfil.</strong>
                      </div>
                    ) : (
                      <div className="empty-state empty-state-inline">
                        <strong>Nenhum insumo ativo cadastrado.</strong>
                      </div>
                    )}
                  </section>
                  )}

                  {recipePanelData.serviceItemMetrics.length > 0 && recipePanelTab === 'PREPARO' ? (
                    <section className="inner-panel">
                      <div className="section-heading">
                        <div>
                          <p className="kicker">Composicao de recipientes</p>
                          <h2>
                            {recipePanelTab === 'PREPARO'
                              ? 'Recipientes de armazenamento'
                              : 'Recipientes de servico'}
                          </h2>
                        </div>
                      </div>

                      {visibleRecipePreparoServiceItemColumnDefinitions.length > 0 ? (
                      <div className="table-wrap">
                        <table className="product-table">
                          <thead>
                            <tr>
                              {visibleRecipePreparoServiceItemColumnDefinitions.map((column) => (
                                <th key={column.key}>{column.label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {recipePanelData.serviceItemMetrics.map((serviceItem) => (
                              <tr key={serviceItem.id}>
                                {visibleRecipePreparoServiceItemColumnDefinitions.map((column) => (
                                  <td key={`${serviceItem.id}-${column.key}`}>
                                    {renderRecipePreparoServiceItemColumnValue(column.key, serviceItem)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      ) : (
                        <div className="empty-state empty-state-inline">
                          <strong>Nenhuma coluna de recipiente habilitada para este perfil.</strong>
                        </div>
                      )}
                    </section>
                  ) : null}

                  {recipePanelTab === 'PREPARO' ? (
                    <>
                      <section className="inner-panel">
                        <div className="section-heading">
                          <div>
                            <p className="kicker">Modo de preparo</p>
                            <h2>Execucao da receita</h2>
                          </div>
                        </div>
                        {recipePanelData.sheet.preparationMode ? (
                          <p className="recipe-copy-block">
                            {recipePanelPreparationModeParts.map((part, index) =>
                              part.type === 'ingredient' ? (
                                <span key={`${part.text}-${index}`} className="recipe-copy-ingredient-group">
                                  <span className="recipe-copy-ingredient-quantity">{part.quantityLabel}</span>
                                  <span className="recipe-highlight-token">{part.text}</span>
                                </span>
                              ) : (
                                <span key={`${part.text}-${index}`}>{part.text}</span>
                              ),
                            )}
                          </p>
                        ) : (
                          <div className="empty-state empty-state-inline">
                            <strong>Modo de preparo nao informado.</strong>
                          </div>
                        )}
                      </section>

                      <section className="inner-panel">
                        <div className="section-heading">
                          <div>
                            <p className="kicker">Validade</p>
                            <h2>Conservacao</h2>
                          </div>
                        </div>
                        <div className="receituario-summary-grid">
                          <article className="receituario-metric-card">
                            <span>In natura</span>
                            <strong>{recipePanelData.sheet.shelfLifeRoom || '-'}</strong>
                          </article>
                          <article className="receituario-metric-card">
                            <span>Refrigerado</span>
                            <strong>{recipePanelData.sheet.shelfLifeRefrigerated || '-'}</strong>
                          </article>
                          <article className="receituario-metric-card">
                            <span>Congelado</span>
                            <strong>{recipePanelData.sheet.shelfLifeFrozen || '-'}</strong>
                          </article>
                        </div>
                      </section>
                    </>
                  ) : (
                    <>
                      {visibleRecipePanelExecutionBlocks.garnishes ? (
                      <section className="inner-panel">
                        <div className="section-heading">
                          <div>
                            <p className="kicker">Composicao complementar</p>
                            <h2>Guarnicoes</h2>
                          </div>
                        </div>

                        {recipePanelData.garnishMetrics.length > 0 && visibleRecipeExecutionGarnishColumnDefinitions.length > 0 ? (
                          <div className="table-wrap">
                            <table className="product-table">
                              <thead>
                                <tr>
                                  {visibleRecipeExecutionGarnishColumnDefinitions.map((column) => (
                                    <th key={column.key}>{column.label}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {recipePanelData.garnishMetrics.map((ingredient) => (
                                  <tr key={ingredient.id}>
                                    {visibleRecipeExecutionGarnishColumnDefinitions.map((column) => (
                                      <td key={`${ingredient.id}-${column.key}`}>
                                        {renderRecipeExecutionGarnishColumnValue(column.key, ingredient)}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : recipePanelData.garnishMetrics.length > 0 ? (
                          <div className="empty-state empty-state-inline">
                            <strong>Nenhuma coluna de guarnicao habilitada para este perfil.</strong>
                          </div>
                        ) : (
                          <div className="empty-state empty-state-inline">
                            <strong>Nenhuma guarnicao ativa cadastrada.</strong>
                          </div>
                        )}
                      </section>
                      ) : null}

                      {visibleRecipePanelExecutionBlocks.preparationMode ? (
                      <section className="inner-panel">
                        <div className="section-heading">
                          <div>
                            <p className="kicker">Modo de preparo</p>
                            <h2>Execucao do servico</h2>
                          </div>
                        </div>
                        {recipePanelData.sheet.preparationMode ? (
                          <p className="recipe-copy-block">
                            {recipePanelPreparationModeParts.map((part, index) =>
                              part.type === 'ingredient' ? (
                                <span key={`${part.text}-${index}`} className="recipe-copy-ingredient-group">
                                  <span className="recipe-copy-ingredient-quantity">{part.quantityLabel}</span>
                                  <span className="recipe-highlight-token">{part.text}</span>
                                </span>
                              ) : (
                                <span key={`${part.text}-${index}`}>{part.text}</span>
                              ),
                            )}
                          </p>
                        ) : (
                          <div className="empty-state empty-state-inline">
                            <strong>Modo de preparo nao informado.</strong>
                          </div>
                        )}
                      </section>
                      ) : null}

                      {visibleRecipePanelExecutionBlocks.description ? (
                      <section className="inner-panel">
                        <div className="section-heading">
                          <div>
                            <p className="kicker">Apresentacao</p>
                            <h2>Descricao</h2>
                          </div>
                        </div>
                        {(() => {
                          const generatedDescription = buildTechnicalSheetGeneratedDescription(recipePanelData.sheet, technicalSheets)
                          return (
                            <div className="recipe-description-card">
                              {generatedDescription.hasContent ? (
                                <p className="recipe-copy-block">{generatedDescription.summary}</p>
                              ) : (
                                <p className="recipe-copy-block">Descricao nao informada.</p>
                              )}
                            </div>
                          )
                        })()}
                      </section>
                      ) : null}

                      {visibleRecipePanelExecutionBlocks.harmonization ? (
                      <section className="inner-panel">
                        <div className="section-heading">
                          <div>
                            <p className="kicker">Servico</p>
                            <h2>Harmonizacao</h2>
                          </div>
                        </div>
                        <p className="recipe-copy-block">
                          {recipePanelData.sheet.harmonization || 'Harmonizacao nao informada.'}
                        </p>
                      </section>
                      ) : null}

                      {visibleRecipePanelExecutionBlocks.flavorProfile ? (
                      <section className="inner-panel">
                        <div className="section-heading">
                          <div>
                            <p className="kicker">Perfil sensorial</p>
                            <h2>Notas de sabor</h2>
                          </div>
                        </div>
                        {(() => {
                          const flavorRatings = getTechnicalSheetFlavorProfileRatingsForDisplay(
                            recipePanelData.sheet,
                            flavorProfiles,
                          )
                          return flavorRatings.length > 0 ? (
                            <div className="receituario-summary-grid receituario-flavor-grid">
                              {flavorRatings.map((rating) => (
                                <article key={rating.flavorProfileId} className="receituario-metric-card">
                                  <span>{rating.label}</span>
                                  <strong>{rating.value}</strong>
                                </article>
                              ))}
                            </div>
                          ) : (
                            <div className="empty-state empty-state-inline">
                              <strong>Nenhum perfil de sabor informado.</strong>
                            </div>
                          )
                        })()}
                      </section>
                      ) : null}

                      {visibleRecipePanelExecutionBlocks.salesArguments ? (
                      <section className="inner-panel">
                        <div className="section-heading">
                          <div>
                            <p className="kicker">Venda</p>
                            <h2>Argumentos de venda</h2>
                          </div>
                        </div>
                        <p className="recipe-copy-block">
                          {recipePanelData.sheet.salesArguments || 'Argumentos de venda nao informados.'}
                        </p>
                      </section>
                      ) : null}

                      {visibleRecipePanelExecutionBlocks.storytelling ? (
                      <section className="inner-panel">
                        <div className="section-heading">
                          <div>
                            <p className="kicker">Narrativa</p>
                            <h2>Storytelling</h2>
                          </div>
                        </div>
                        <p className="recipe-copy-block">
                          {recipePanelData.sheet.storytelling || 'Storytelling nao informado.'}
                        </p>
                      </section>
                      ) : null}

                    </>
                  )}

                  {recipePanelTab === 'PREPARO' ? (
                    <section className="inner-panel">
                      <div className="section-heading">
                        <div>
                          <p className="kicker">Resumo</p>
                          <h2>Dados tecnicos</h2>
                        </div>
                      </div>

                      <div className="receituario-summary-grid receituario-summary-grid-metrics">
                        <article className="receituario-metric-card">
                          <span>Rendimento final</span>
                          <strong>
                            {formatDecimal(recipePanelData.desiredYield)} {getTechnicalSheetYieldUnitLabel(recipePanelData.sheet, technicalSheets, products)}
                          </strong>
                        </article>
                        <article className="receituario-metric-card">
                          <span>RENDIMENTO POR RECEITAS</span>
                          <strong>{formatDecimal(recipePanelData.portionsYield)}</strong>
                        </article>
                        <article className="receituario-metric-card">
                          <span>% alcool final</span>
                          <strong>{formatDecimal(recipePanelData.finalAlcoholPercentage)}%</strong>
                        </article>
                        <article className="receituario-metric-card">
                          <span>Meta de PH</span>
                          <strong>{recipePanelData.sheet.targetPh || '-'}</strong>
                        </article>
                        <article className="receituario-metric-card">
                          <span>Meta de Brix</span>
                          <strong>{recipePanelData.sheet.targetBrix || '-'}</strong>
                        </article>
                        {visibleRecipePreparoHeroFields.sharingSaleFee ? renderSharedPreparationSaleFeeCard(recipePanelData.sharingSaleFeeInfo) : null}
                      </div>
                    </section>
                  ) : null}
                </>
              ) : (
                <div className="empty-state">
                  <strong>Nenhuma receita disponivel.</strong>
                  <p>Cadastre e ative fichas tecnicas de pre-preparo ou execucao para usar o receituario.</p>
                </div>
              ) : (
                <div className="empty-state">
                  <strong>Receituario indisponivel para este perfil.</strong>
                  <p>Habilite a exibicao de ao menos uma aba de receituario no perfil de acesso vinculado a este usuario.</p>
                </div>
              )}
          </div>
        </section>
  )
}
