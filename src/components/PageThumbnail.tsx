import type { DerivedPage, SharedFields } from '../types'
import { PageSurface } from './PageSurface'

interface PageThumbnailProps {
  page: DerivedPage
  sharedFields: SharedFields
  backgroundUrl?: string
  backgroundWidth: number
  backgroundHeight: number
  selected: boolean
  onSelect: () => void
}

export function PageThumbnail({
  page,
  sharedFields,
  backgroundUrl,
  backgroundWidth,
  backgroundHeight,
  selected,
  onSelect
}: PageThumbnailProps) {
  if (!backgroundWidth || !backgroundHeight) {
    return (
      <button type="button" className={`page-thumbnail ${selected ? 'selected' : ''}`} onClick={onSelect}>
        <div className="page-thumbnail-placeholder">…</div>
        <span className="page-label">{page.index}</span>
      </button>
    )
  }
  const availableWidth = 180
  const availableHeight = 110
  const scale = Math.min(availableWidth / backgroundWidth, availableHeight / backgroundHeight)

  return (
    <button
      type="button"
      className={`page-thumbnail ${selected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div className="page-thumbnail-inner">
        <div
          className="page-thumbnail-surface"
          style={{
            width: backgroundWidth,
            height: backgroundHeight,
            transform: `scale(${scale})`,
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
      </div>
      <span className="page-label">{page.index}</span>
    </button>
  )
}
