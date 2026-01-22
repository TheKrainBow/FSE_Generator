import { useState, useCallback, useEffect } from 'react'
import type { DerivedPage, SharedFields } from '../types'
import { PagePreview } from './PagePreview'
import { PageThumbnail } from './PageThumbnail'

interface PdfViewerProps {
  pages: DerivedPage[]
  selectedPage: number
  onSelectPage: (index: number) => void
  sharedFields: SharedFields
  backgroundUrl?: string
  backgroundWidth: number
  backgroundHeight: number
  error?: string
}

export function PdfViewer({
  pages,
  selectedPage,
  onSelectPage,
  sharedFields,
  backgroundUrl,
  backgroundWidth,
  backgroundHeight,
  error
}: PdfViewerProps) {
  const currentPage = pages[selectedPage]
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (zoom <= 1) {
      setOffset((prev) => (prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }))
    }
  }, [zoom])

  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault()
    const delta = -event.deltaY
    const zoomStep = delta > 0 ? 0.1 : -0.1
    setZoom((prev) => Math.min(3, Math.max(0.5, prev + zoomStep)))
  }, [])

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (zoom <= 1) return
    setDragging(true)
    setLastPos({ x: event.clientX, y: event.clientY })
  }, [zoom])

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!dragging || !lastPos) return
      const dx = event.clientX - lastPos.x
      const dy = event.clientY - lastPos.y
      setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
      setLastPos({ x: event.clientX, y: event.clientY })
    },
    [dragging, lastPos]
  )

  const handleMouseUp = useCallback(() => {
    setDragging(false)
    setLastPos(null)
  }, [])

  const handleThumbnailWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
      return
    }
    event.preventDefault()
    event.currentTarget.scrollLeft += event.deltaY
  }, [])

  return (
    <div className="pdf-viewer-card">
      <div
        className={`pdf-viewer-canvas ${dragging ? 'grabbing' : zoom > 1 ? 'grab-ready' : ''}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {currentPage ? (
          <PagePreview
            page={currentPage}
            sharedFields={sharedFields}
            backgroundUrl={backgroundUrl}
            backgroundWidth={backgroundWidth}
            backgroundHeight={backgroundHeight}
            zoom={zoom}
            offset={offset}
          />
        ) : (
          <div className="page-preview-placeholder">Aucune page disponible.</div>
        )}
        {error && <p className="error overlay-error">{error}</p>}
      </div>
      <div className="pdf-viewer-thumbnails" onWheel={handleThumbnailWheel}>
        {pages.map((page, idx) => (
          <PageThumbnail
            key={page.index}
            page={page}
            sharedFields={sharedFields}
            backgroundUrl={backgroundUrl}
            backgroundWidth={backgroundWidth}
            backgroundHeight={backgroundHeight}
            selected={idx === selectedPage}
            onSelect={() => onSelectPage(idx)}
          />
        ))}
        {!pages.length && <p className="hint">Ajoutez des participants pour générer des pages.</p>}
      </div>
    </div>
  )
}
