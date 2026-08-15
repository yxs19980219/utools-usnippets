/**
 * Pattern Vault (模式库) — preload 服务
 *
 * uTools 规范要求：
 * 1. CommonJS 规范（require / module.exports）
 * 2. 源码可读：不打包、不压缩、不混淆
 * 3. 最小权限：只暴露数据/文件能力，不暴露整个 fs 模块
 *
 * 边界：
 * - 本文件只做数据与文件能力，不涉及任何 UI 逻辑
 * - 渲染进程一律经 lib/db.ts 访问 window.services，不散落直调
 *
 * 说明：utools.db 与 utools.* 系统 API 在渲染进程全局同样可用，
 * 但为了数据入口统一，数据库能力在此集中透传。
 */
const fs = require('node:fs')
const path = require('node:path')

// ---------------------------------------------------------------
// 数据库（记录/分类存 utools.db 文档，随账号同步，合规）
// ---------------------------------------------------------------
const db = {
  /** 创建或更新文档（更新时 doc 必须携带 _rev，否则失败） */
  put(doc) {
    return utools.db.promises.put(doc)
  },
  /** 按 id 取文档，不存在返回 null */
  get(id) {
    return utools.db.promises.get(id)
  },
  /** 删除文档（可传文档对象或 id） */
  remove(docOrId) {
    return utools.db.promises.remove(docOrId)
  },
  /** 批量写文档，返回 DbResult[] */
  bulkDocs(docs) {
    return utools.db.promises.bulkDocs(docs)
  },
  /** 按 id 前缀取文档数组 */
  allDocs(idStartsWith) {
    return utools.db.promises.allDocs(idStartsWith)
  },
}

// ---------------------------------------------------------------
// 附件（图片，≤10M，只能创建不能更新；删除附件用 remove(附件id)）
// ---------------------------------------------------------------
const attachment = {
  /**
   * 存储附件。附件只能被创建不能被更新，创建的附件最大不超过 10M。
   * @param {string} id 附件文档 id（如 pattern/<patternId>/img-<ts>）
   * @param {Uint8Array|ArrayBuffer} data 图片二进制
   * @param {string} mime 如 image/png
   */
  async put(id, data, mime) {
    const buf = data instanceof Uint8Array ? data : new Uint8Array(data)
    return utools.db.promises.postAttachment(id, buf, mime)
  },
  /** 取附件二进制，不存在返回 null */
  get(id) {
    return utools.db.promises.getAttachment(id)
  },
  /** 取附件 mime 类型 */
  getType(id) {
    return utools.db.promises.getAttachmentType(id)
  },
  /**
   * 删除附件（uTools 文档未提供 removeAttachment，
   * 附件为独立文档 id，用 remove(id) 删除；失败返回错误结果）
   */
  remove(id) {
    return utools.db.promises.remove(id)
  },
}

// ---------------------------------------------------------------
// 文件（仅导入/导出 JSON 用：对话框 + 读写一体，最小权限）
// ---------------------------------------------------------------
const file = {
  /**
   * 弹出打开文件对话框，读取文本内容。
   * 用户取消返回 null。
   */
  openTextFile(options) {
    const files = utools.showOpenDialog(
      Object.assign({ properties: ['openFile'] }, options)
    )
    if (!files || files.length === 0) return null
    return fs.readFileSync(files[0], { encoding: 'utf-8' })
  },

  /**
   * 弹出保存文件对话框，写入文本内容。
   * 用户取消返回 null，成功返回文件路径。
   */
  saveTextFile(options, content) {
    const savePath = utools.showSaveDialog(
      Object.assign({}, options)
    )
    if (!savePath) return null
    fs.writeFileSync(savePath, content, { encoding: 'utf-8' })
    return savePath
  },

  /**
   * 弹出保存文件对话框，写入二进制内容（导出图片用）。
   * 用户取消返回 null，成功返回文件路径。
   */
  saveBinaryFile(options, data) {
    const savePath = utools.showSaveDialog(
      Object.assign({}, options)
    )
    if (!savePath) return null
    const buf = data instanceof Uint8Array ? data : new Uint8Array(data)
    fs.writeFileSync(savePath, buf)
    return savePath
  },

  /**
   * 静默写入 userData 目录下的文件（导入前备份用）。
   * 最小权限：只允许固定目录，不暴露任意路径写能力。
   * @param {string} filename 仅文件名（basename），防路径穿越
   * @param {string} content 文本内容
   * @returns {string|null} 成功返回完整路径，失败返回 null
   */
  writeUserDataFile(filename, content) {
    try {
      const name = path.basename(filename)
      const dir = utools.getPath('userData')
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      const target = path.join(dir, name)
      fs.writeFileSync(target, content, { encoding: 'utf-8' })
      return target
    } catch (e) {
      return null
    }
  },
}

window.services = { db, attachment, file }
