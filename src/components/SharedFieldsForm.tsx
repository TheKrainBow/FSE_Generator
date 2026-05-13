import { FIELD_SECTIONS } from '../constants/fields'
import { getSurveillantOptions, matchSurveillantLabel } from '../lib/surveillants'
import type { SharedFields } from '../types'
import { CollapsibleSection } from './CollapsibleSection'

interface SharedFieldsFormProps {
  values: SharedFields
  onChange: (patch: Partial<SharedFields>) => void
}

export function SharedFieldsForm({ values, onChange }: SharedFieldsFormProps) {
  const surveillantOptions = getSurveillantOptions()
  const selectedSurveillant = matchSurveillantLabel(values.teacherFirstName, values.teacherLastName) ?? ''

  return (
    <div className="field-groups">
      {FIELD_SECTIONS.map((section) => (
        <CollapsibleSection
          key={section.title}
          title={section.title}
          description={section.description}
        >
          {section.title === 'Surveillant & date' ? (
            <div className="field-grid">
              <label className="field-item">
                <span>Surveillant</span>
                <select
                  value={selectedSurveillant}
                  disabled={!surveillantOptions.length}
                  onChange={(event) => {
                    if (!event.target.value) {
                      onChange({
                        teacherFirstName: '',
                        teacherLastName: ''
                      })
                      return
                    }
                    const option = surveillantOptions.find((entry) => entry.label === event.target.value)
                    onChange({
                      teacherFirstName: option?.firstName ?? '',
                      teacherLastName: option?.lastName ?? ''
                    })
                  }}
                >
                  <option value="">Aucun surveillant</option>
                  {!surveillantOptions.length && <option disabled value="__missing__">Variable not defined: VITE_SURVEILLANTS</option>}
                  {surveillantOptions.map((option) => (
                    <option key={option.label} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {section.fields.slice(1).map((field) => {
                const name = field.name
                const value = values[name]
                return (
                  <label key={field.name} className="field-item">
                    <span>{field.label}</span>
                    <input
                      type="text"
                      value={(typeof value === 'string' ? value : '') ?? ''}
                      placeholder={field.placeholder}
                      onChange={(event) => onChange({ [name]: event.target.value } as Partial<SharedFields>)}
                    />
                    {field.helper && <small className="hint">{field.helper}</small>}
                  </label>
                )
              })}
            </div>
          ) : (
            <div className="field-grid">
              {section.fields.map((field) => {
                const name = field.name
                const value = values[name]
                if (field.type === 'checkbox') {
                  return (
                    <label key={field.name} className="checkbox-inline">
                      <input
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={(event) => onChange({ [name]: event.target.checked } as Partial<SharedFields>)}
                      />
                      <span>{field.label}</span>
                    </label>
                  )
                }
                return (
                  <label key={field.name} className="field-item">
                    <span>{field.label}</span>
                    <input
                      type={field.type === 'number' ? 'number' : 'text'}
                      value={(typeof value === 'string' ? value : '') ?? ''}
                      placeholder={field.placeholder}
                      onChange={(event) => onChange({ [name]: event.target.value } as Partial<SharedFields>)}
                    />
                    {field.helper && <small className="hint">{field.helper}</small>}
                  </label>
                )
              })}
            </div>
          )}
        </CollapsibleSection>
      ))}
    </div>
  )
}
