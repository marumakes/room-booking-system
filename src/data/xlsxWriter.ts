import type { Cell, Row, Sheet } from 'write-excel-file/browser'
import { DataFailure } from '../domain/failure'
import type { SheetCell, SheetTable, SpreadsheetWriter } from '../domain/spreadsheet'

// Excel number formats for date cells, e.g. "Mon 5 Oct 2026" and "1 Oct 2026 18:00".
const DATE_FORMAT = 'ddd d mmm yyyy'
const DATE_TIME_FORMAT = 'd mmm yyyy hh:mm'

// Excel has no time zones, so London clock times are stored as if UTC and shown as written.
function toCell(cell: SheetCell): Cell {
  if (typeof cell === 'string') {
    // Typed as text, so a name like "=SUM(A1)" is never run as a formula.
    return cell === '' ? null : { value: cell, type: String }
  }

  if ('date' in cell) {
    return { value: new Date(`${cell.date}T00:00:00Z`), type: Date, format: DATE_FORMAT }
  }

  return { value: new Date(`${cell.londonTime}:00Z`), type: Date, format: DATE_TIME_FORMAT }
}

// Bold header row, frozen so it stays visible when scrolling.
function toSheet(table: SheetTable): Sheet<never> {
  const header: Row = table.header.map((h) => ({ value: h, type: String, fontWeight: 'bold' }))
  return {
    sheet: table.name,
    data: [header, ...table.rows.map((row) => row.map(toCell))],
    columns: table.widths.map((width) => ({ width })),
    stickyRowsCount: 1,
  }
}

// .xlsx files via write-excel-file. The library is loaded on first use, so it isn't in the main bundle.
export const xlsxWriter: SpreadsheetWriter = {
  async toXlsx(tables) {
    try {
      const { default: writeXlsxFile } = await import('write-excel-file/browser')
      const file = await writeXlsxFile(tables.map(toSheet)).toBlob()
      return { ok: true, file }
    } catch (error) {
      // Usually the library failing to download (offline).
      console.error('Spreadsheet export failed', error)
      return { ok: false, failure: DataFailure.Unknown }
    }
  },
}
