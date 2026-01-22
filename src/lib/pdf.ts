import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { pageLayout } from '../layout/pageLayout'
import type { DerivedPage, LayoutKey, SharedFields } from '../types'
import { NAMES_PER_PAGE, pageNames } from './pages'
import { getSignatureColumnStates, getSignatureColumnLayouts } from './signatureGrid'
import { resolveFieldValue } from './fieldValues'

const DEFAULT_FONT_SIZE = 11
const MIN_FONT_SIZE = 6
const TEMPLATE_FALLBACK = '/EmptyFSE.pdf'
const FONT_FALLBACK = '/fonts/DejaVuSans.ttf'

interface Box {
  x: number
  y: number
  width: number
  height: number
}

interface DrawOptions {
  align?: 'left' | 'center' | 'right'
  wrap?: boolean
  minSize?: number
}

export interface PdfBuildOptions {
  sharedFields: SharedFields
  pages: DerivedPage[]
}

async function fetchAsset(path: string): Promise<ArrayBuffer> {
  const response = await fetch(path)
  if (!response.ok) {
    throw new Error(`Impossible de charger la ressource ${path}`)
  }
  return response.arrayBuffer()
}

function boxFromLayout(key: string, page: { width: number; height: number }): Box | null {
  const entry = pageLayout[key]
  if (!entry) {
    return null
  }
  const width = entry.wPercent * page.width
  const height = entry.hPercent * page.height
  const x = entry.xPercent * page.width
  const yFromTop = entry.yPercent * page.height
  const y = page.height - yFromTop - height
  return { x, y, width, height }
}

function wrapText(text: string, width: number, fontSize: number, font: any): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word
    const candidateWidth = font.widthOfTextAtSize(candidate, fontSize)
    if (candidateWidth <= width || current === '') {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }
  })
  if (current) {
    lines.push(current)
  }
  return lines
}

function drawTextFit(
  page: any,
  font: any,
  text: string,
  box: Box,
  options: DrawOptions = {}
) {
  if (!text) {
    return
  }
  const align = options.align ?? 'left'
  const wrap = options.wrap ?? false
  const minSize = options.minSize ?? MIN_FONT_SIZE

  let size = DEFAULT_FONT_SIZE
  let lines: string[] = []
  let lineHeight = 0
  const height = box.height
  const width = box.width
  const safeText = text.trim()
  while (size >= minSize) {
    if (wrap) {
      lines = wrapText(safeText, width, size, font)
    } else {
      lines = [safeText]
    }
    const overflow = lines.some((line) => font.widthOfTextAtSize(line, size) > width)
    lineHeight = size * 1.2
    const totalHeight = lineHeight * lines.length
    if (!overflow && totalHeight <= height) {
      break
    }
    size -= 0.5
  }
  if (size < minSize) {
    size = minSize
    if (wrap) {
      lines = wrapText(safeText, width, size, font)
    } else {
      lines = [safeText]
    }
    lineHeight = size * 1.2
  }
  const totalHeight = lineHeight * lines.length
  let startY = box.y + height - lineHeight
  if (totalHeight < height) {
    startY = box.y + height - (height - totalHeight) / 2 - lineHeight
  }
  lines.forEach((line, idx) => {
    const lineWidth = font.widthOfTextAtSize(line, size)
    let x = box.x
    if (align === 'center') {
      x = box.x + (width - lineWidth) / 2
    } else if (align === 'right') {
      x = box.x + width - lineWidth
    }
    const y = startY - idx * lineHeight + lineHeight * 0.2
    page.drawText(line, {
      x,
      y,
      size,
      font,
      color: rgb(0, 0, 0)
    })
  })
}

export async function generateFsePdf({ sharedFields, pages }: PdfBuildOptions) {
  if (pages.length === 0) {
    throw new Error('Aucune page à exporter.')
  }
  const templatePath = sharedFields.templatePath || TEMPLATE_FALLBACK
  const templateBytes = await fetchAsset(templatePath)
  const fontBytes = await fetchAsset(FONT_FALLBACK)
  const templatePdf = await PDFDocument.load(templateBytes)
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const font = await pdf.embedFont(fontBytes)

  const signatureColumns = getSignatureColumnStates(sharedFields)

  for (const pageInfo of pages) {
    const [base] = await pdf.copyPages(templatePdf, [0])
    pdf.addPage(base)
    const width = base.getWidth()
    const height = base.getHeight()

    const sharedKeys: LayoutKey[] = [
      'theme_origin',
      'intitule',
      'fonds_concerne',
      'commentaire',
      'duree_heures',
      'duree_jours',
      'matin_h1',
      'matin_m1',
      'matin_h2',
      'matin_m2',
      'aprem_h1',
      'aprem_m1',
      'aprem_h2',
      'aprem_m2',
      'nom_surveillant',
      'date',
      'pagination'
    ]

    sharedKeys.forEach((key) => {
      const value = resolveFieldValue(key, sharedFields, pageInfo)
      if (!value) {
        return
      }
      const box = boxFromLayout(key, { width, height })
      if (!box) {
        return
      }
      const centeredKeys: LayoutKey[] = [
        'duree_heures',
        'duree_jours',
        'matin_h1',
        'matin_m1',
        'matin_h2',
        'matin_m2',
        'aprem_h1',
        'aprem_m1',
        'aprem_h2',
        'aprem_m2'
      ]
      const align: DrawOptions['align'] =
        key === 'commentaire' ? 'center' : key === 'date' ? 'right' : centeredKeys.includes(key) ? 'center' : 'left'
      const wrap = key === 'commentaire'
      drawTextFit(base, font, value, box, { align, wrap })
    })

    const namesBox = boxFromLayout('premier_nom_etudiant', { width, height })
    if (namesBox) {
      const mmRatioX = width / 297
      const offset = 3 * mmRatioX
      const rowHeight = namesBox.height / NAMES_PER_PAGE
      const names = pageNames(pageInfo.users)
      names.forEach((name, idx) => {
        const rowBox: Box = {
          x: namesBox.x + offset,
          y: namesBox.y + namesBox.height - rowHeight * (idx + 1),
          width: namesBox.width - offset,
          height: rowHeight
        }
        drawTextFit(base, font, name, rowBox, { align: 'left', wrap: false, minSize: 7 })
      })
    }

    const signatureColumnsLayout = getSignatureColumnLayouts({ width, height })
    if (sharedFields.disableCrossedCells) {
      continue
    }
    signatureColumns.forEach((isActive, columnIdx) => {
      if (isActive) {
        return
      }
      const layout = signatureColumnsLayout[columnIdx]
      if (!layout) {
        return
      }
      const columnWidth = layout.width
      const rowHeight = layout.height / NAMES_PER_PAGE
      for (let row = 0; row < NAMES_PER_PAGE; row += 1) {
        const cellBottom = layout.y + layout.height - rowHeight * row
        const cellTop = cellBottom - rowHeight
        const marginX = columnWidth * 0.05
        const marginY = rowHeight * 0.05
        base.drawLine({
          start: { x: layout.x + marginX, y: cellTop + marginY },
          end: { x: layout.x + columnWidth - marginX, y: cellBottom - marginY },
          thickness: 1,
          color: rgb(0.4, 0.4, 0.4)
        })
      }
    })
  }

  return pdf.save()
}
