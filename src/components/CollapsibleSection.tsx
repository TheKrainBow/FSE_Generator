import { useState } from 'react'
import type { ReactNode } from 'react'

interface CollapsibleSectionProps {
  title: string
  description?: string
  defaultOpen?: boolean
  children: ReactNode
  badge?: string | number
}

export function CollapsibleSection({
  title,
  description,
  defaultOpen = true,
  children,
  badge
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={`collapsible ${open ? 'open' : 'closed'}`}>
      <button
        type="button"
        className="collapsible-header"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span className="collapsible-chevron">{open ? '▾' : '▸'}</span>
        <div className="collapsible-info">
          <h3>{title}</h3>
          {badge !== undefined && <span className="badge">{badge}</span>}
        </div>
      </button>
      {open && (
        <div className="collapsible-body">
          {description && <p className="hint">{description}</p>}
          {children}
        </div>
      )}
    </div>
  )
}
