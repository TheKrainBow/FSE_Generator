import type { DerivedPage, SharedFields } from '../types'
import { PageSurface } from './PageSurface'
import { useEffect, useState } from 'react'
import { useElementSize } from '../hooks/useSize'

interface PagePreviewProps {
  page: DerivedPage
  sharedFields: SharedFields
  backgroundUrl?: string
  backgroundWidth: number
  backgroundHeight: number
  zoom: number
  offset: { x: number; y: number }
}

export function PagePreview({
  page,
  sharedFields,
  backgroundUrl,
  backgroundWidth,
  backgroundHeight,
  zoom,
  offset
}: PagePreviewProps) {
  const [ref, size] = useElementSize<HTMLDivElement>()
  const [fitScale, setFitScale] = useState(1)
  const hasBackground = backgroundWidth > 0 && backgroundHeight > 0
  useEffect(() => {
    if (!hasBackground) {
      setFitScale(1)
      return
    }
    if (!size.width || !size.height) {
      return
    }
    const next = Math.min(size.width / backgroundWidth, size.height / backgroundHeight)
    setFitScale(Math.min(1, next))
  }, [size, backgroundWidth, backgroundHeight, hasBackground])
  const appliedScale = fitScale * zoom

  return (
    <div className="page-preview" ref={ref}>
      {hasBackground ? (
        <div
          className="page-preview-inner"
          style={{
            width: backgroundWidth,
            height: backgroundHeight,
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${appliedScale})`,
            transformOrigin: 'center center'
          }}
        >
          <PageSurface
            page={page}
            sharedFields={sharedFields}
            backgroundUrl={backgroundUrl}
            width={backgroundWidth}
            height={backgroundHeight}
          />
        </div>
      ) : (
        <div className="page-preview-placeholder">Chargement du modèle…</div>
      )}
    </div>
  )
}
