import { useState } from 'react'
import { isClosed } from '../domain/claims'
import { siteToday } from '../domain/dates'
import type { RoomsData } from '../domain/rooms'
import { XLSX_MIME_TYPE, exportFileName } from '../domain/spreadsheet'
import { exportTables } from './exportSheets'
import { DATA_FAILURE_MESSAGES } from './messages'
import { NoticeKind, type Notice } from './notice'
import { useRepos } from './repos'
import { ErrorText, pillButtonClass } from './Screen'

type ExportButtonProps = {
  data: RoomsData
  onDone: (notice: Notice) => void
}

// Committee only: downloads the editable .xlsx (day grids, claims list, history).
// Warns afterwards if sign-up is still open, since the file may then go out of date.
export function ExportButton({ data, onDone }: ExportButtonProps) {
  const { history, spreadsheets, files } = useRepos()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function download() {
    setBusy(true)
    setError(null)
    const loaded = await history.loadHistory()
    const written = loaded.ok ? await spreadsheets.toXlsx(exportTables(data, loaded.entries)) : loaded
    setBusy(false)

    if (!written.ok) {
      setError(DATA_FAILURE_MESSAGES[written.failure])
      return
    }

    files.save(exportFileName(siteToday()), written.file, XLSX_MIME_TYPE)
    const stillOpen = isClosed(data.closesAt) ? '' : ' Sign-up is still open, so claims may still change.'
    onDone({ kind: NoticeKind.Success, text: `Spreadsheet downloaded.${stillOpen}` })
  }

  return (
    <div>
      <button type="button" className={pillButtonClass} disabled={busy} onClick={() => void download()}>
        {busy ? 'Preparing spreadsheet…' : 'Download spreadsheet'}
      </button>
      <ErrorText message={error} />
    </div>
  )
}
