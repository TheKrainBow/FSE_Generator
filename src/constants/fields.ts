import type { SharedFieldName } from '../types'

export interface FieldDescriptor {
  name: SharedFieldName
  label: string
  placeholder?: string
  helper?: string
  type?: 'text' | 'number' | 'checkbox'
}

export interface FieldSection {
  title: string
  description?: string
  fields: FieldDescriptor[]
}

export const FIELD_SECTIONS: FieldSection[] = [
  {
    title: 'Informations générales',
    fields: [
      { name: 'themeObjet', label: 'Thème / Objet', placeholder: 'Exam 06/01/2026' },
      { name: 'intitule', label: 'Intitulé', placeholder: 'Piscine C4' },
      { name: 'fondsConcerne', label: 'Fonds concerné', placeholder: 'FSE+' },
      { name: 'comment', label: 'Commentaire', placeholder: 'Exam' },
      {
        name: 'disableCrossedCells',
        label: 'Débloquer les cases vides',
        type: 'checkbox',
      }
    ]
  },
  {
    title: 'Durée',
    fields: [
      { name: 'eventHourDuration', label: 'Durée (heures)', type: 'number' },
      { name: 'eventDaysDuration', label: 'Durée (jours)', type: 'number' }
    ]
  },
  {
    title: 'Créneaux du matin',
    fields: [
      { name: 'morningStartAtHour', label: 'Début heure', type: 'number' },
      { name: 'morningStartAtMinute', label: 'Début minute', type: 'number' },
      { name: 'morningEndAtHour', label: 'Fin heure', type: 'number' },
      { name: 'morningEndAtMinute', label: 'Fin minute', type: 'number' }
    ]
  },
  {
    title: "Créneaux de l'après-midi",
    fields: [
      { name: 'afternoonStartAtHour', label: 'Début heure', type: 'number' },
      { name: 'afternoonStartAtMinute', label: 'Début minute', type: 'number' },
      { name: 'afternoonEndAtHour', label: 'Fin heure', type: 'number' },
      { name: 'afternoonEndAtMinute', label: 'Fin minute', type: 'number' }
    ]
  },
  {
    title: 'Surveillant & date',
    fields: [
      { name: 'teacherFirstName', label: 'Prénom du surveillant' },
      { name: 'teacherLastName', label: 'Nom du surveillant' },
      { name: 'dateString', label: 'Date', placeholder: '06/01/2026' }
    ]
  }
]

export const PAGE_INLINE_FIELDS: FieldDescriptor[] = [
  FIELD_SECTIONS[0].fields[0],
  FIELD_SECTIONS[0].fields[1],
  FIELD_SECTIONS[0].fields[2],
  FIELD_SECTIONS[0].fields[3],
  FIELD_SECTIONS[FIELD_SECTIONS.length - 1].fields[2]
]

export const SHARED_FIELD_BINDINGS: Record<SharedFieldName, string | null> = {
  themeObjet: 'theme_origin',
  intitule: 'intitule',
  fondsConcerne: 'fonds_concerne',
  comment: 'commentaire',
  eventHourDuration: 'duree_heures',
  eventDaysDuration: 'duree_jours',
  morningStartAtHour: 'matin_h1',
  morningStartAtMinute: 'matin_m1',
  morningEndAtHour: 'matin_h2',
  morningEndAtMinute: 'matin_m2',
  afternoonStartAtHour: 'aprem_h1',
  afternoonStartAtMinute: 'aprem_m1',
  afternoonEndAtHour: 'aprem_h2',
  afternoonEndAtMinute: 'aprem_m2',
  teacherFirstName: 'nom_surveillant',
  teacherLastName: 'nom_surveillant',
  dateString: 'date',
  disableCrossedCells: null,
  hideTotalPagination: null,
  templatePath: null
}
