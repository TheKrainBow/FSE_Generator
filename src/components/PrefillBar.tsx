import { useMemo, useState, type ChangeEvent } from 'react'
import Papa from 'papaparse'
import type { PrefillPayload, PrefillSource, PrefillUserInput } from '../types'
import { fetchPrefill } from '../services/intra42'

interface PrefillBarProps {
  onPrefill: (payload: PrefillPayload) => void
  onReset: () => void
  hasExistingData?: boolean
}

const MODES: PrefillSource[] = ['csv', 'event', 'exam']
const WARNING_MESSAGE = 'Changer de modèle effacera toutes les données des formulaires.'

export function PrefillBar({ onPrefill, onReset, hasExistingData }: PrefillBarProps) {
  const [mode, setMode] = useState<PrefillSource>('csv')
  const [identifiers, setIdentifiers] = useState<Record<'event' | 'exam', string>>({ event: '', exam: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [csvFileName, setCsvFileName] = useState('')
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([])
  const [csvColumns, setCsvColumns] = useState<string[]>([])
  const [csvSelection, setCsvSelection] = useState<{ firstName?: string; lastName?: string }>({})

  const previewRows = useMemo(() => csvRows.slice(0, 5), [csvRows])

  const handleModeChange = (next: PrefillSource) => {
    if (mode === next) {
      return
    }
    setMode(next)
    setError('')
  }

  const confirmDestructive = () => {
    if (!hasExistingData) {
      return true
    }
    return window.confirm(WARNING_MESSAGE)
  }

  const handleLoad = async () => {
    if (mode === 'csv') {
      handleCsvImport()
      return
    }
    if (!confirmDestructive()) {
      return
    }
    const id = identifiers[mode]
    if (!id?.trim()) {
      setError('Veuillez saisir un identifiant en premier.')
      return
    }
    try {
      setLoading(true)
      setError('')
      const payload = await fetchPrefill(mode, id.trim())
      onPrefill(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de récupérer les données depuis 42.')
    } finally {
      setLoading(false)
    }
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
      error: (err) => {
        setError(err.message || "Impossible d'analyser le CSV.")
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
    const summary = `Import de ${filtered.length} participant(s) depuis le CSV.`
    const payload: PrefillPayload = {
      source: 'csv',
      summary,
      users: filtered,
      fields: {}
    }
    onPrefill(payload)
    setError('')
  }

  const idValue = mode === 'event' || mode === 'exam' ? identifiers[mode] : ''

  return (
    <div className="prefill-bar">
      <div className="prefill-modes">
        {MODES.map((option) => (
          <button
            key={option}
            type="button"
            className={`mode-btn ${mode === option ? 'active' : ''}`}
            onClick={() => handleModeChange(option)}
          >
            {option === 'csv' ? 'CSV' : option === 'event' ? 'Event' : 'Exam'}
          </button>
        ))}
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
      {mode !== 'csv' && (
        <div className="prefill-inputs">
          <label>{mode === 'event' ? 'Event ID' : 'Exam ID'}</label>
          <input
            type="number"
            value={idValue}
            onChange={(event) =>
              setIdentifiers((prev) => ({ ...prev, [mode]: event.target.value }))
            }
            placeholder={mode === 'event' ? '37718' : '12844'}
          />
          <button type="button" className="btn" onClick={handleLoad} disabled={loading}>
            {loading ? 'En cours...' : 'Importer'}
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
    </div>
  )
}
