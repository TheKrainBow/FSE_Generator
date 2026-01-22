import type { CSSProperties } from 'react'
import type { DerivedPage, SharedFields, LayoutKey } from '../types'
import { pageLayout } from '../layout/pageLayout'
import { resolveFieldValue } from '../lib/fieldValues'
import { NAMES_PER_PAGE, pageNames } from '../lib/pages'
import { getSignatureColumnStates } from '../lib/signatureGrid'

const SIGNATURE_KEYS: LayoutKey[] = [
  'signature_col_morning1',
  'signature_col_afternoon1',
  'signature_col_morning2',
  'signature_col_afternoon2',
  'signature_col_morning3',
  'signature_col_afternoon3',
  'signature_col_morning4',
  'signature_col_afternoon4',
  'signature_col_morning5',
  'signature_col_afternoon5'
]

interface PageSurfaceProps {
  page: DerivedPage
  sharedFields: SharedFields
  backgroundUrl?: string
  width: number
  height: number
}

function areaStyle(key: keyof typeof pageLayout): CSSProperties {
  const entry = pageLayout[key]
  return {
    left: `${entry.xPercent * 100}%`,
    top: `${entry.yPercent * 100}%`,
    width: `${entry.wPercent * 100}%`,
    height: `${entry.hPercent * 100}%`
  }
}

export function PageSurface({ page, sharedFields, backgroundUrl, width, height }: PageSurfaceProps) {
  const names = pageNames(page.users)
  const signatureColumns = getSignatureColumnStates(sharedFields)
  return (
    <div className="page-surface" style={{ width, height }}>
      {backgroundUrl ? <img src={backgroundUrl} alt="FSE" draggable={false} /> : <div className="page-placeholder" />}
      <div className="page-overlay">
        <div className="field" style={areaStyle('theme_origin')}>
          {resolveFieldValue('theme_origin', sharedFields, page)}
        </div>
        <div className="field" style={areaStyle('intitule')}>
          {resolveFieldValue('intitule', sharedFields, page)}
        </div>
        <div className="field" style={areaStyle('fonds_concerne')}>
          {resolveFieldValue('fonds_concerne', sharedFields, page)}
        </div>
        <div className="field multiline" style={areaStyle('commentaire')}>
          {resolveFieldValue('commentaire', sharedFields, page)}
        </div>
        <div className="field center" style={areaStyle('duree_heures')}>
          {resolveFieldValue('duree_heures', sharedFields, page)}
        </div>
        <div className="field center" style={areaStyle('duree_jours')}>
          {resolveFieldValue('duree_jours', sharedFields, page)}
        </div>
        <div className="field center" style={areaStyle('matin_h1')}>
          {resolveFieldValue('matin_h1', sharedFields, page)}
        </div>
        <div className="field center" style={areaStyle('matin_m1')}>
          {resolveFieldValue('matin_m1', sharedFields, page)}
        </div>
        <div className="field center" style={areaStyle('matin_h2')}>
          {resolveFieldValue('matin_h2', sharedFields, page)}
        </div>
        <div className="field center" style={areaStyle('matin_m2')}>
          {resolveFieldValue('matin_m2', sharedFields, page)}
        </div>
        <div className="field center" style={areaStyle('aprem_h1')}>
          {resolveFieldValue('aprem_h1', sharedFields, page)}
        </div>
        <div className="field center" style={areaStyle('aprem_m1')}>
          {resolveFieldValue('aprem_m1', sharedFields, page)}
        </div>
        <div className="field center" style={areaStyle('aprem_h2')}>
          {resolveFieldValue('aprem_h2', sharedFields, page)}
        </div>
        <div className="field center" style={areaStyle('aprem_m2')}>
          {resolveFieldValue('aprem_m2', sharedFields, page)}
        </div>
        <div className="field" style={areaStyle('nom_surveillant')}>
          {resolveFieldValue('nom_surveillant', sharedFields, page)}
        </div>
        <div className="field right" style={areaStyle('date')}>
          {resolveFieldValue('date', sharedFields, page)}
        </div>
        <div className="field" style={areaStyle('pagination')}>
          {resolveFieldValue('pagination', sharedFields, page)}
        </div>
        <div className="names" style={areaStyle('premier_nom_etudiant')}>
          {[...Array(NAMES_PER_PAGE)].map((_, idx) => (
            <div className="name-row" key={idx}>
              <span>{names[idx] ?? ''}</span>
            </div>
          ))}
        </div>
        <div className="signature-columns">
          {SIGNATURE_KEYS.map((key, columnIdx) => {
            const active = signatureColumns[columnIdx]
            return (
              <div key={key} className={`signature-column ${active ? 'active' : 'blocked'}`} style={areaStyle(key)}>
                {!active && !sharedFields.disableCrossedCells &&
                  Array.from({ length: NAMES_PER_PAGE }).map((_, rowIdx) => (
                    <div key={`${key}-${rowIdx}`} className="signature-cell">
                      <svg className="signature-line" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <line x1="5" y1="95" x2="95" y2="5" />
                      </svg>
                    </div>
                  ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
