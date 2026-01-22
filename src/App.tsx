import { useEffect, useMemo, useReducer, useState } from 'react'
import './App.css'
import { PrefillBar } from './components/PrefillBar'
import { UserListPanel } from './components/UserListPanel'
import { SharedFieldsForm } from './components/SharedFieldsForm'
import { usePdfBackground } from './hooks/usePdfBackground'
import { buildPages } from './lib/pages'
import { fseReducer, initialState } from './state/fseReducer'
import type { PrefillPayload } from './types'
import { PdfViewer } from './components/PdfViewer'
import { CollapsibleSection } from './components/CollapsibleSection'
import { PrintButton } from './components/PrintButton'

function App() {
  const [state, dispatch] = useReducer(fseReducer, initialState)
  const pages = useMemo(() => buildPages(state.users, state.extraPages), [state.users, state.extraPages])
  const [selectedPage, setSelectedPage] = useState(0)
  const templatePath = state.sharedFields.templatePath
  const template = usePdfBackground(templatePath)
  const hasSharedFieldData = Object.entries(state.sharedFields).some(
    ([key, value]) => key !== 'templatePath' && Boolean(value)
  )
  const hasFormData = state.users.length > 0 || state.extraPages > 0 || hasSharedFieldData

  useEffect(() => {
    setSelectedPage((prev) => Math.min(prev, Math.max(pages.length - 1, 0)))
  }, [pages.length])

  const handlePrefill = (payload: PrefillPayload) => {
    dispatch({ type: 'apply-prefill', payload })
    setSelectedPage(0)
  }

  const handleReset = () => {
    dispatch({ type: 'reset-empty' })
    setSelectedPage(0)
  }

  return (
    <div className="shell">
      <div className="app-frame">
        <aside className="sidebar">
          <PrefillBar onPrefill={handlePrefill} onReset={handleReset} hasExistingData={hasFormData} />
          <section className="details-card">
            <div className="details-card-header">
              <h2>Détails FSE</h2>
            </div>
            <CollapsibleSection title="Participants" badge={state.users.length}>
              <UserListPanel
                users={state.users}
                onAdd={(user) => dispatch({ type: 'add-user', user })}
                onRemove={(id) => dispatch({ type: 'remove-user', id })}
                onUpdate={(id, patch) => dispatch({ type: 'update-user', id, patch })}
                hideHeader
              />
            </CollapsibleSection>
          <SharedFieldsForm
            values={state.sharedFields}
            onChange={(patch) => dispatch({ type: 'update-shared', patch })}
          />
          <CollapsibleSection title="Pages vides">
            <div className="extra-pages">
              <label>Pages vides</label>
              <input
                type="number"
                min={0}
                value={state.extraPages}
                onChange={(event) =>
                  dispatch({ type: 'set-extra-pages', count: Number(event.target.value) || 0 })
                }
              />
              <label className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={state.sharedFields.hideTotalPagination}
                  onChange={(event) =>
                    dispatch({ type: 'update-shared', patch: { hideTotalPagination: event.target.checked } })
                  }
                />
                Masquer le total dans la pagination
              </label>
            </div>
          </CollapsibleSection>
        </section>
        </aside>
        <section className="stage">
          <PrintButton sharedFields={state.sharedFields} pages={pages} />
          <PdfViewer
            pages={pages}
            selectedPage={selectedPage}
            onSelectPage={(idx) => setSelectedPage(idx)}
            sharedFields={state.sharedFields}
            backgroundUrl={template.url}
            backgroundWidth={template.width}
            backgroundHeight={template.height}
            error={template.error}
          />
        </section>
      </div>
    </div>
  )
}

export default App
