import { useEffect, useState } from 'react'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import PDFWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker'

GlobalWorkerOptions.workerPort = new PDFWorker()

interface PdfBackground {
  url: string
  width: number
  height: number
  loading: boolean
  error?: string
}

export function usePdfBackground(path: string): PdfBackground {
  const [data, setData] = useState<PdfBackground>({ url: '', width: 0, height: 0, loading: true })

  useEffect(() => {
    let cancelled = false
    setData({ url: '', width: 0, height: 0, loading: true })

    async function load() {
      try {
        const pdf = await getDocument(path).promise
        const page = await pdf.getPage(1)
        const viewport = page.getViewport({ scale: 2 })
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        if (!context) {
          throw new Error('Canvas non supporté par ce navigateur.')
        }
        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({ canvasContext: context, viewport, canvas }).promise
        if (!cancelled) {
          setData({
            url: canvas.toDataURL('image/png'),
            width: viewport.width,
            height: viewport.height,
            loading: false
          })
        }
      } catch (err) {
        if (!cancelled) {
          setData({
            url: '',
            width: 0,
            height: 0,
            loading: false,
            error: err instanceof Error ? err.message : 'Impossible de charger le modèle.'
          })
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [path])

  return data
}
