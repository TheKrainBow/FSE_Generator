import { useMemo, useState, type ChangeEvent } from 'react'
import Papa from 'papaparse'
import type { PrefillPayload, PrefillUserInput } from '../types'
import { CampusCalendarModal } from './CampusCalendarModal'

interface PrefillBarProps {
  onPrefill: (payload: PrefillPayload) => void
  onReset: () => void
  hasExistingData?: boolean
}

const WARNING_MESSAGE = 'Changer de modèle effacera toutes les données des formulaires.'

type ToolMode = 'csv' | 'calendar'

export function PrefillBar({ onPrefill, onReset, hasExistingData }: PrefillBarProps) {
  const [mode, setMode] = useState<ToolMode>('csv')
  const [error, setError] = useState('')
  const [csvFileName, setCsvFileName] = useState('')
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([])
  const [csvColumns, setCsvColumns] = useState<string[]>([])
  const [csvSelection, setCsvSelection] = useState<{ firstName?: string; lastName?: string }>({})
  const [calendarOpen, setCalendarOpen] = useState(false)

  const previewRows = useMemo(() => csvRows.slice(0, 5), [csvRows])

  const confirmDestructive = () => {
    if (!hasExistingData) {
      return true
    }
    return window.confirm(WARNING_MESSAGE)
  }

  const handleModeChange = (next: ToolMode) => {
    if (mode === next) {
      return
    }
    setMode(next)
    setError('')
    setCalendarOpen(false)
  }

  const handleCsvFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    setError('')
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = (results.data || []).filter((row) => row && typeof row === 'object')
        const columns = Object.keys(rows[0] ?? {}).filter((col) => col !== '')
        setCsvRows(rows)
        setCsvColumns(columns)
        setCsvFileName(file.name)
        setCsvSelection((prev) => ({
          lastName: prev.lastName && columns.includes(prev.lastName) ? prev.lastName : columns[0],
          firstName:
            prev.firstName && columns.includes(prev.firstName)
              ? prev.firstName
              : columns[1] || columns[0]
        }))
      },
      error: (parseError) => {
        setError(parseError.message || "Impossible d'analyser le CSV.")
        setCsvRows([])
        setCsvColumns([])
      }
    })
  }

  const handleCsvImport = () => {
    if (!csvRows.length) {
      setError('Veuillez choisir un fichier CSV avant.')
      return
    }
    if (!csvSelection.firstName || !csvSelection.lastName) {
      setError('Veuillez sélectionner les colonnes pour Nom et Prénom.')
      return
    }
    if (!confirmDestructive()) {
      return
    }
    const users: PrefillUserInput[] = csvRows.map((row) => ({
      firstName: String(row[csvSelection.firstName!] ?? '').trim(),
      lastName: String(row[csvSelection.lastName!] ?? '').trim()
    }))
    const filtered = users.filter((user) => user.firstName || user.lastName)
    if (!filtered.length) {
      setError('Aucun participant valide trouvé dans le CSV avec les colonnes choisies.')
      return
    }
    const payload: PrefillPayload = {
      source: 'csv',
      summary: `Import de ${filtered.length} participant(s) depuis le CSV.`,
      users: filtered,
      fields: {}
    }
    onPrefill(payload)
    setError('')
  }

  return (
    <div className="prefill-bar">
      <div className="prefill-modes">
        <button
          type="button"
          className={`mode-btn ${mode === 'csv' ? 'active' : ''}`}
          onClick={() => handleModeChange('csv')}
        >
          CSV
        </button>
      <button
        type="button"
        className={`mode-btn ${mode === 'calendar' ? 'active' : ''}`}
        onClick={() => handleModeChange('calendar')}
      >
          Event / exam
        </button>
      </div>

      {mode === 'csv' && (
        <div className="csv-import">
          <label className="csv-upload">
            <span>{csvFileName ? `Fichier chargé : ${csvFileName}` : 'Importer avec un CSV'}</span>
            <input type="file" accept=".csv,text/csv" onChange={handleCsvFile} />
          </label>
          {csvColumns.length > 0 && (
            <>
              <div className="csv-mapping">
                <label>
                  Colonne nom
                  <select
                    value={csvSelection.lastName ?? ''}
                    onChange={(event) =>
                      setCsvSelection((prev) => ({ ...prev, lastName: event.target.value || undefined }))
                    }
                  >
                    {csvColumns.map((column) => (
                      <option key={column} value={column}>
                        {column || '(Vide)'}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Colonne prénom
                  <select
                    value={csvSelection.firstName ?? ''}
                    onChange={(event) =>
                      setCsvSelection((prev) => ({ ...prev, firstName: event.target.value || undefined }))
                    }
                  >
                    {csvColumns.map((column) => (
                      <option key={column} value={column}>
                        {column || '(Vide)'}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button type="button" className="btn" onClick={handleCsvImport}>
                Importer le CSV
              </button>
              <div className="csv-preview">
                <div className="csv-preview-header">Aperçu (premières {previewRows.length} lignes)</div>
                <div className="csv-preview-table">
                  <table>
                    <thead>
                      <tr>
                        {csvColumns.map((column) => (
                          <th key={column}>{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, idx) => (
                        <tr key={idx}>
                          {csvColumns.map((column) => (
                            <td key={column}>{row[column]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {mode === 'calendar' && (
        <div className="calendar-launcher">
          <p className="hint">Ouvre le calendrier 42 du mois en cours pour choisir un event ou un exam.</p>
          <button type="button" className="btn primary" onClick={() => setCalendarOpen(true)}>
            Ouvrir le calendrier
          </button>
        </div>
      )}

      <button
        type="button"
        className="btn ghost"
        onClick={() => {
          if (!confirmDestructive()) {
            return
          }
          onReset()
          setCsvRows([])
          setCsvColumns([])
          setCsvFileName('')
          setCsvSelection({})
        }}
      >
        Réinitialiser
      </button>

      {error && <div className="error">{error}</div>}

      <CampusCalendarModal
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        onPrefill={onPrefill}
        hasExistingData={hasExistingData}
      />
    </div>
  )
}
