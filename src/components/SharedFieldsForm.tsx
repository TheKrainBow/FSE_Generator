import { FIELD_SECTIONS } from '../constants/fields'
import type { SharedFields } from '../types'
import { CollapsibleSection } from './CollapsibleSection'

interface SharedFieldsFormProps {
  values: SharedFields
  onChange: (patch: Partial<SharedFields>) => void
}

export function SharedFieldsForm({ values, onChange }: SharedFieldsFormProps) {
  return (
    <div className="field-groups">
      {FIELD_SECTIONS.map((section) => (
        <CollapsibleSection
          key={section.title}
          title={section.title}
          description={section.description}
        >
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
          </CollapsibleSection>
        ))}
    </div>
  )
}
