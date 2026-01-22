import { useState } from 'react'
import type { DerivedPage, SharedFields } from '../types'
import { generateFsePdf } from '../lib/pdf'

interface PrintButtonProps {
  sharedFields: SharedFields
  pages: DerivedPage[]
}

export function PrintButton({ sharedFields, pages }: PrintButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handlePrint = async () => {
    if (!pages.length) {
      setError("Aucune page à imprimer pour le moment.")
      return
    }
    if (loading) {
      return
    }
    try {
      setLoading(true)
      setError('')
      const pdfBytes = await generateFsePdf({ sharedFields, pages })
      const copy = pdfBytes.slice()
      const blob = new Blob([copy], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      const cleanup = () => {
        if (iframe.parentNode) {
          document.body.removeChild(iframe)
        }
        URL.revokeObjectURL(url)
      }
      iframe.onload = () => {
        const win = iframe.contentWindow
        if (!win) {
          cleanup()
          return
        }
        win.focus()
        win.print()
        if ('onafterprint' in win) {
          win.onafterprint = () => {
            win.onafterprint = null
            cleanup()
          }
        } else {
          setTimeout(cleanup, 5000)
        }
      }
      iframe.src = url
      document.body.appendChild(iframe)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Impossible d'ouvrir la boîte de dialogue d'impression."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="stage-print-button">
      <button type="button" className="btn primary" onClick={handlePrint} disabled={loading}>
        {loading ? 'Préparation…' : 'Imprimer'}
      </button>
      {error && <p className="error print-error">{error}</p>}
    </div>
  )
}
