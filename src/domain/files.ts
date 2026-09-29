// Saves a generated file (e.g. a calendar or spreadsheet) to the user's device.
export interface FileSaver {
  save(fileName: string, contents: string | Blob, mimeType: string): void
}
