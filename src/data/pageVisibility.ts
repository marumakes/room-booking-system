// Calls back when the page comes back into view, e.g. a phone is unlocked or the tab is reopened.
// Mobile browsers pause background tabs, so live updates may have been missed meanwhile. Returns unsubscribe.
export function onPageVisible(callback: () => void): () => void {
  const listener = () => {
    if (document.visibilityState === 'visible') {
      callback()
    }
  }

  document.addEventListener('visibilitychange', listener)
  return () => document.removeEventListener('visibilitychange', listener)
}
