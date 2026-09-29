import type { FileSaver } from '../domain/files'

// Browser download via a temporary object URL.
export const browserFileSaver: FileSaver = {
  save(fileName, contents, mimeType) {
    const url = URL.createObjectURL(new Blob([contents], { type: mimeType }))
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)
  },
}
