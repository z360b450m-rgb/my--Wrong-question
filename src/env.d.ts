interface DesktopSource {
  id: string
  name: string
  thumbnail: string
  appIcon: string | null
}

interface Window {
  electronAPI?: {
    platform: string
    getAll: (notebookId: string) => Promise<any[]>
    get: (notebookId: string, id: string) => Promise<any | null>
    put: (entry: any) => Promise<void>
    delete: (notebookId: string, id: string) => Promise<void>
    putSnapshot: (notebookId: string, snapshot: any) => Promise<void>
    getSnapshot: (notebookId: string, entryId: string) => Promise<any | null>
    getAllSnapshots: (notebookId: string) => Promise<any[]>
    deleteSnapshot: (notebookId: string, entryId: string) => Promise<void>
    deleteAllSnapshots: (notebookId: string) => Promise<void>
    getDataDir: () => Promise<string>
    setDataDir: () => Promise<string>
    exportAll: () => Promise<string>
    importAll: (notebookId: string, entries: any[]) => Promise<void>
    exportArchive: () => Promise<{ success: boolean; message: string; count?: number }>
    importArchive: (
      keepReviewState: boolean,
    ) => Promise<{ success: boolean; message: string; count?: number }>
    getAllReviewLogs: (notebookId: string) => Promise<any[]>
    addReviewLog: (notebookId: string, log: any) => Promise<void>
    deleteReviewLogsByEntry: (notebookId: string, entryId: string) => Promise<void>
    getAllNotebooks: () => Promise<any[]>
    putNotebook: (notebook: any) => Promise<void>
    deleteNotebook: (id: string) => Promise<void>
    getDesktopSources: () => Promise<DesktopSource[]>
  }
}
