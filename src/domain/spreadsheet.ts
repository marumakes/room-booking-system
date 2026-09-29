// A spreadsheet as plain tables; the data layer turns it into an .xlsx file.
import type { DataFailure } from './failure'

export const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

// Text, a calendar date ("2026-10-05"), or a London clock time ("2026-10-01T18:00").
// Dates are real date cells, so they sort and filter properly.
export type SheetCell = string | { date: string } | { londonTime: string }

export type SheetTable = {
  name: string
  header: string[]
  rows: SheetCell[][]
  // Column widths in characters, one per header column.
  widths: number[]
}

export type SpreadsheetResult = { ok: true; file: Blob } | { ok: false; failure: DataFailure }

export interface SpreadsheetWriter {
  // One tab per table, in order.
  toXlsx(tables: SheetTable[]): Promise<SpreadsheetResult>
}

// e.g. "room-booking-2026-10-02.xlsx"
export function exportFileName(today: string): string {
  return `room-booking-${today}.xlsx`
}
