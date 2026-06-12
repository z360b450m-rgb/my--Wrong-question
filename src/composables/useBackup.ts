import type { NoteEntry } from '@/types'
import { db } from '@/services/db'

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function timestamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`
}

export function useBackup(entries: { value: NoteEntry[] }, onToast: (msg: string) => void) {
  function exportJSON() {
    if (entries.value.length === 0) {
      onToast('暂无错题可导出')
      return
    }
    const json = JSON.stringify(entries.value, null, 2)
    downloadFile(json, `错题本_${timestamp()}.json`, 'application/json')
    onToast(`已导出 ${entries.value.length} 条错题`)
  }

  function importJSON() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'

    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const data = JSON.parse(text)

        if (!Array.isArray(data)) {
          onToast('导入失败：文件格式不正确，需要 JSON 数组')
          return
        }

        let imported = 0
        let skipped = 0

        for (const item of data) {
          if (!item.id || item.question === undefined) {
            skipped++
            continue
          }
          const existing = await db.get(item.id)
          if (existing) {
            skipped++
            continue
          }
          await db.put(item as NoteEntry)
          imported++
        }

        // Reload entries from DB
        const all = await db.getAll()
        entries.value = all

        if (imported === 0 && skipped === 0) {
          onToast('导入失败：未识别到有效错题数据')
        } else {
          let msg = `成功导入 ${imported} 条`
          if (skipped > 0) msg += `，跳过 ${skipped} 条重复`
          onToast(msg)
        }
      } catch {
        onToast('导入失败：无法解析文件')
      }
    }

    input.click()
  }

  return { exportJSON, importJSON }
}
