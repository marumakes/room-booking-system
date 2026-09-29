import { NoticeKind, type Notice } from './notice'

// Small white pills that sit on the tinted bar.
const noticeButtonClass = 'rounded-full bg-surface px-3.5 py-1.5 text-sm font-medium text-ink shadow-sm transition hover:bg-sunk'

type NoticeBarProps = {
  notice: Notice
  onCalendar: () => void
  onDismiss: () => void
}

// Result of the last claim or release. Success is announced politely; errors interrupt.
export function NoticeBar({ notice, onCalendar, onDismiss }: NoticeBarProps) {
  const success = notice.kind === NoticeKind.Success

  return (
    <div
      role={success ? 'status' : 'alert'}
      className={`flex flex-wrap items-center justify-between gap-3 rounded-3xl px-5 py-4 ${
        success ? 'bg-success-soft text-success-ink' : 'bg-danger-soft text-danger-ink'
      }`}
    >
      <p className="font-medium">{notice.text}</p>
      <div className="flex gap-2">
        {notice.offerCalendar && (
          <button type="button" className={noticeButtonClass} onClick={onCalendar}>
            Add to calendar
          </button>
        )}
        <button type="button" className={noticeButtonClass} onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  )
}
