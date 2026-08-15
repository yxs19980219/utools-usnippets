/**
 * uTools 全局类型声明（以 utools-dev skill references/utools-api.md 为准）
 * 只声明本插件实际使用到的 API，签名已逐条对照文档。
 */

interface DbDoc {
  _id: string
  _rev?: string
  [key: string]: unknown
}

interface DbResult {
  id: string
  rev?: string
  ok?: boolean
  error?: boolean
  name?: string
  message?: string
}

interface PluginEnterAction {
  code: string
  type: 'text' | 'img' | 'file' | 'regex' | 'over' | 'window'
  payload: unknown
  from: 'main' | 'panel' | 'hotkey' | 'reirect'
  option?: { mainPush: boolean }
}

interface UtoolsDb {
  promises: {
    put(doc: DbDoc): Promise<DbResult>
    get(id: string): Promise<DbDoc | null>
    remove(docOrId: DbDoc | string): Promise<DbResult>
    bulkDocs(docs: DbDoc[]): Promise<DbResult[]>
    allDocs(idStartsWith?: string): Promise<DbDoc[]>
    allDocs(ids: string[]): Promise<DbDoc[]>
    postAttachment(
      id: string,
      attachment: Buffer | Uint8Array,
      type: string
    ): Promise<DbResult>
    getAttachment(id: string): Promise<Uint8Array | null>
    getAttachmentType(id: string): Promise<string>
  }
}

interface Utools {
  db: UtoolsDb
  dbStorage: {
    setItem(key: string, value: unknown): void
    getItem(key: string): unknown
    removeItem(key: string): void
  }
  copyText(text: string): boolean
  /** 用系统默认方式打开外部链接（markdown 编辑器链接点击） */
  shellOpenExternal(url: string): void
  isDarkColors(): boolean
  getPath(name: string): string
  showOpenDialog(options: Record<string, unknown>): string[] | undefined
  showSaveDialog(options: Record<string, unknown>): string | undefined
  onPluginEnter(callback: (action: PluginEnterAction) => void): void
  onPluginOut(callback: (isKill: boolean) => void): void
  onPluginDetach(callback: () => void): void
  onDbPull(callback: (docs: DbDoc[]) => void): void
  setSubInput(
    onChange: (details: { text: string }) => void,
    placeholder?: string,
    isFocus?: boolean
  ): boolean
  removeSubInput(): boolean
  setExpendHeight(height: number): boolean
  hideMainWindow(isRestorePreWindow?: boolean): boolean
}

interface UtoolsServices {
  db: {
    put(doc: DbDoc): Promise<DbResult>
    get(id: string): Promise<DbDoc | null>
    remove(docOrId: DbDoc | string): Promise<DbResult>
    bulkDocs(docs: DbDoc[]): Promise<DbResult[]>
    allDocs(idStartsWith?: string): Promise<DbDoc[]>
  }
  attachment: {
    put(
      id: string,
      data: Uint8Array | ArrayBuffer,
      mime: string
    ): Promise<DbResult>
    get(id: string): Promise<Uint8Array | null>
    getType(id: string): Promise<string>
    remove(id: string): Promise<DbResult>
  }
  file: {
    openTextFile(options: Record<string, unknown>): string | null
    saveTextFile(
      options: Record<string, unknown>,
      content: string
    ): string | null
    saveBinaryFile(
      options: Record<string, unknown>,
      data: Uint8Array | ArrayBuffer
    ): string | null
    writeUserDataFile(filename: string, content: string): string | null
  }
}

interface Window {
  utools: Utools
  services: UtoolsServices
}
