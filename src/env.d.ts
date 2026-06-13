interface Window {
  electronAPI?: {
    platform: string
    getAll: () => Promise<any[]>
    get: (id: string) => Promise<any | null>
    put: (entry: any) => Promise<void>
    delete: (id: string) => Promise<void>
    putSnapshot: (snapshot: any) => Promise<void>
    getSnapshot: (entryId: string) => Promise<any | null>
    getAllSnapshots: () => Promise<any[]>
    deleteSnapshot: (entryId: string) => Promise<void>
    deleteAllSnapshots: () => Promise<void>
    getDataDir: () => Promise<string>
    setDataDir: () => Promise<string>
    exportAll: () => Promise<string>
    importAll: (entries: any[]) => Promise<void>
  }
}
