import { useState } from 'react'
import type { DerivedPage, SharedFields } from '../types'
import { generateFsePdf } from '../lib/pdf'

interface PdfDownloadButtonProps {
  sharedFields: SharedFields
  pages: DerivedPage[]
}

export function PdfDownloadButton({ sharedFields, pages }: PdfDownloadButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleClick = async () => {
    if (!pages.length) {
      setError('Rien à exporter pour le moment.')
      return
    }
    try {
      setLoading(true)
      setError('')
      const pdfBytes = await generateFsePdf({ sharedFields, pages })
      const copy = pdfBytes.slice()
      const blob = new Blob([copy], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const date = sharedFields.dateString?.replace(/\//g, '-') || 'export'
      link.download = `FSE_${date}.pdf`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Impossible de générer le PDF.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="export-bar">
      <button className="btn primary" onClick={handleClick} disabled={loading}>
        {loading ? 'Génération...' : 'Télécharger le PDF'}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
