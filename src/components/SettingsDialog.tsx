/**
 * components/SettingsDialog.tsx —— 设置面板
 * 深色跟随、默认语言、JSON 导入/导出
 */
import { useState } from 'react'
import { DownloadIcon, UploadIcon } from 'lucide-react'
import { useUi } from '@/stores/ui'
import { useSettings } from '@/stores/settings'
import { useRecords } from '@/stores/records'
import { useCategories } from '@/stores/categories'
import { useToast } from '@/lib/toast'
import { LANGUAGES } from '@/lib/languages'
import { exportAllToFile, importFromFile } from '@/lib/import-export'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const DARK_OPTIONS = [
  { value: 'system', label: '跟随 uTools / 系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
]

export function SettingsDialog() {
  const open = useUi((s) => s.settingsOpen)
  const setOpen = useUi((s) => s.setSettingsOpen)
  const { darkMode, defaultLanguage, set } = useSettings()
  const toast = useToast((s) => s.show)
  const [busy, setBusy] = useState(false)

  const handleExport = async () => {
    setBusy(true)
    try {
      const path = await exportAllToFile()
      if (path) toast(`已导出：${path}`)
    } catch (e) {
      toast(`导出失败：${e instanceof Error ? e.message : String(e)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleImport = async () => {
    setBusy(true)
    try {
      const result = await importFromFile()
      if (result === null) return // 用户取消
      await Promise.all([
        useRecords.getState().load(),
        useCategories.getState().load(),
      ])
      toast(
        `导入完成：记录 ${result.patterns} / 分类 ${result.categories} / 附件 ${result.attachments}`
      )
    } catch (e) {
      toast(`导入失败：${e instanceof Error ? e.message : String(e)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>
            偏好设置保存在本机（dbStorage），记录/分类数据随 uTools 账号同步。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Label>深色模式</Label>
            <Select
              value={darkMode}
              onValueChange={(v) => set({ darkMode: v as typeof darkMode })}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DARK_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label>默认语言（新建片段）</Label>
            <Select
              value={defaultLanguage}
              onValueChange={(v) => set({ defaultLanguage: v })}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <Label>数据</Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={busy}
                onClick={() => void handleExport()}
              >
                <DownloadIcon />
                导出 JSON（记录 + 分类 + 附件）
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={busy}
                onClick={() => void handleImport()}
              >
                <UploadIcon />
                导入 JSON
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              导入为合并语义：与现有记录 id 冲突时自动生成新 id，不会覆盖现有数据；导入前会自动备份现有库到 uTools 数据目录。
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
