<script setup lang="ts">
// @AI-NOTE: 根组件 —— 状态调度中心。数据通过 composables 获取,
// 通过 props 传递、events 收集。禁止在此编写业务逻辑或直接操作存储。
import { provide, computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useEntries } from './composables/useEntries'
import { migrateFromIndexedDB } from './services/db'
import { useFilter } from './composables/useFilter'
import type { SortKey, SortDir } from './composables/useFilter'
import { useReview } from './composables/useReview'
import { useReviewSettings } from './composables/useReviewSettings'
import { useNotebooks } from './composables/useNotebooks'
import { useDrawing } from './composables/useDrawing'
import { useBackup } from './composables/useBackup'
import { useExport } from './composables/useExport'
import { useStats } from './composables/useStats'
import { useKeyboard } from './composables/useKeyboard'
import { useDarkMode } from './composables/useDarkMode'
import { parsePastedText } from './utils/parsePastedText'
import { db } from './services/db'
import Workspace from './components/Workspace.vue'
import NotebookMenu from './components/NotebookMenu.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import AppToast from './components/AppToast.vue'

const {
  entries,
  activeId,
  activeEntry,
  answersHidden,
  isDirty,
  selectedIds,
  selectedCount,
  loadEntries,
  checkCrashRecovery,
  createEntry,
  loadEntry,
  markDirty,
  saveEntry,
  discardChanges,
  snapshotSave,
  deleteCurrent,
  updateEntryTitle,
  reorderEntries,
  toastMsg,
  showToast,
  showDeleteModal,
  openDeleteModal,
  closeDeleteModal,
  // batch
  toggleSelect,
  selectRange,
  selectAll,
  deselectAll,
  batchDelete,
  batchTag,
  batchExport,
  notebookEntries,
} = useEntries()

const {
  notebooks,
  activeId: activeNotebookId,
  activeNotebook,
  selectNotebook,
  loadNotebooks,
  restoreLastNotebook,
  clearLastNotebook,
} = useNotebooks()
const showNotebookMenu = ref(true)

const {
  activeSubject,
  activeTag,
  activeMastery,
  searchQuery,
  sortKey,
  sortDir,
  filteredEntries,
  subjectMap,
  tagMap,
  masteryMap,
  setSubject,
  setTag,
  setMastery,
  setSearch,
  setSort,
} = useFilter(notebookEntries)

const {
  mode,
  reviewQueue,
  currentCard,
  answered,
  reviewedToday,
  elapsedMs,
  dueCount,
  isReviewing,
  progress,
  progressPercent,
  sessionDone,
  sessionRecords,
  totalSessionMs,
  startReview,
  revealAnswer,
  rateCard,
  exitReview,
  dismissSummary,
  loadLogs,
} = useReview(notebookEntries, showToast)

useReviewSettings()

const {
  drawingEnabled,
  activeTool,
  penColor,
  canUndo,
  canRedo,
  currentEntryId,
  toggleDrawing,
  setTool,
  setColor,
  clearCanvas,
  undo,
  redo,
  resizeCanvas,
  loadDrawing,
  mountCanvas,
  setCanvasParent,
  captureDrawing,
  setStoredDrawing,
} = useDrawing(markDirty)

const { exportData, importData } = useBackup(
  () => notebookEntries.value,
  () => activeNotebookId.value ?? '',
  loadEntries,
  showToast,
)
const { exportPDF } = useExport(showToast)
const { isDark, toggleDark } = useDarkMode()

const stats = useStats(notebookEntries)
const statsOpen = ref(false)
const settingsOpen = ref(false)
const isElectron = computed(() => typeof window !== 'undefined' && !!window.electronAPI)

// Unsaved changes flow
const showUnsavedModal = ref(false)
const pendingEntryId = ref<string | null>(null)
const pendingAction = ref<'select' | 'create' | 'review' | null>(null)
const pendingSubject = ref<string>('')
const pendingForceReview = ref(false)

async function handleEnterNotebook(id: string) {
  selectNotebook(id)
  showNotebookMenu.value = false
  await loadEntries()
  await loadLogs()
}

function handleReturnToMenu() {
  clearLastNotebook()
  showNotebookMenu.value = true
  activeId.value = null
}

onMounted(async () => {
  await loadNotebooks()

  // Migrate from IndexedDB to file storage on first launch in Electron
  const migrated = await migrateFromIndexedDB()
  if (migrated > 0) {
    await loadEntries()
    await loadLogs()
    showToast(`已迁移 ${migrated} 条错题到本地文件`)
  }

  // Check for crash recovery
  const recovered = await checkCrashRecovery()
  if (recovered.length > 0) {
    showToast(`已恢复 ${recovered.length} 条未保存的内容`)
  }

  // Restore last notebook — only show menu on first visit
  const lastId = restoreLastNotebook()
  if (lastId && notebooks.value.some((n) => n.id === lastId)) {
    selectNotebook(lastId)
    showNotebookMenu.value = false
    await loadEntries()
    await loadLogs()
  }
})

// Crash protection: save snapshot before unload
function onBeforeUnload() {
  syncDrawingToEntry()
  snapshotSave()
}
onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onUnmounted(() => window.removeEventListener('beforeunload', onBeforeUnload))

provide('toast', showToast)
provide('setCanvasParent', setCanvasParent)
provide('drawingEnabled', drawingEnabled)
provide('resizeCanvas', resizeCanvas)

useKeyboard({
  onCreate: () => handleCreate(),
  onSave: () => {
    if (activeId.value) handleSave()
  },
  onToggleReveal: () => {
    if (mode.value === 'review') {
      if (!answered.value) revealAnswer()
    } else {
      answersHidden.value = !answersHidden.value
    }
  },
  onPrev: () => navigate(-1),
  onNext: () => navigate(1),
  mode,
  isReviewing,
  answered,
  revealAnswer,
  rateCard,
  drawingEnabled,
  onUndo: () => undo(),
  onRedo: () => redo(),
})

function navigate(dir: number) {
  if (!activeId.value) return
  const ids = filteredEntries.value.map((e) => e.id)
  const idx = ids.indexOf(activeId.value)
  const newIdx = idx + dir
  if (newIdx >= 0 && newIdx < ids.length) {
    if (isDirty.value) {
      pendingEntryId.value = ids[newIdx]
      pendingAction.value = 'select'
      showUnsavedModal.value = true
      return
    }
    loadEntry(ids[newIdx])
  }
}

function checkDirtyThen(action: () => void, nextAction: 'select' | 'create' | 'review') {
  if (isDirty.value) {
    pendingAction.value = nextAction
    showUnsavedModal.value = true
  } else {
    action()
  }
}

function handleCreate(subject?: string) {
  pendingSubject.value = subject || ''
  checkDirtyThen(() => createEntry(subject), 'create')
}

function doCreate() {
  createEntry(pendingSubject.value || undefined)
}

function handleDelete() {
  openDeleteModal()
}

function handleConfirmDelete() {
  deleteCurrent()
}

// Batch import
const showBatchImport = ref(false)
const batchImportText = ref('')
const batchImportLoading = ref(false)

function handleOpenBatchImport() {
  batchImportText.value = ''
  showBatchImport.value = true
}

async function handleConfirmBatchImport() {
  if (!batchImportText.value.trim() || !activeNotebookId.value) return

  batchImportLoading.value = true
  try {
    const parsed = parsePastedText(batchImportText.value, activeNotebookId.value)
    const now = Date.now()
    for (const item of parsed) {
      const entry = {
        id:
          'cuoti_' +
          now +
          '_' +
          Math.random().toString(36).slice(2, 7) +
          '_' +
          parsed.indexOf(item),
        notebookId: activeNotebookId.value,
        title: (item.question || '').slice(0, 40),
        question: item.question || '',
        wrongAnswer: item.wrongAnswer || '',
        correctAnswer: item.correctAnswer || '',
        subject: item.subject || '未分类',
        source: item.source || '批量导入',
        tags: item.tags || [],
        masteryLevel: 0,
        consecutivePasses: 0,
        nextReviewDate: 0,
        createdAt: now + parsed.indexOf(item),
        updatedAt: now + parsed.indexOf(item),
      }
      await db.put(JSON.parse(JSON.stringify(entry)))
    }
    await loadEntries()
    showToast(`已导入 ${parsed.length} 道错题`)
    showBatchImport.value = false
  } catch (err) {
    console.error('Batch import failed:', err)
    showToast('批量导入失败，请重试')
  } finally {
    batchImportLoading.value = false
  }
}

// Batch actions
const showBatchDeleteConfirm = ref(false)

function handleBatchDelete() {
  showBatchDeleteConfirm.value = true
}

function confirmBatchDelete() {
  showBatchDeleteConfirm.value = false
  batchDelete(Array.from(selectedIds.value))
  showToast(`已删除 ${selectedCount.value} 条错题`)
}

function cancelBatchDelete() {
  showBatchDeleteConfirm.value = false
}

function handleBatchTag(tags: string[]) {
  batchTag(Array.from(selectedIds.value), tags)
  showToast(`已为 ${selectedCount.value} 条错题添加标签`)
}

function handleBatchExport() {
  batchExport(Array.from(selectedIds.value))
}

function handleExportPDF() {
  exportPDF(notebookEntries.value)
}

async function handleChangeDataDir() {
  if (!window.electronAPI) {
    showToast('此功能仅在桌面端可用')
    return
  }
  const newDir = await window.electronAPI.setDataDir()
  showToast('数据目录已更改为：' + newDir)
}

function handleSelectEntry(id: string) {
  if (mode.value === 'review') exitReview()
  if (activeId.value === id) return
  if (isDirty.value) {
    pendingEntryId.value = id
    pendingAction.value = 'select'
    showUnsavedModal.value = true
    return
  }
  loadEntry(id)
}

function handleStartReview(force = false) {
  if (!force && dueCount.value === 0) {
    showToast('今日复习已完成')
    return
  }
  pendingForceReview.value = force
  checkDirtyThen(() => {
    startReview(force)
  }, 'review')
}

function handleMountCanvas(el: HTMLElement, entryId: string) {
  // Sync drawing to the entry we're leaving before switching
  if (currentEntryId.value && currentEntryId.value !== entryId) {
    const oldEntry = entries.value.find((e) => e.id === currentEntryId.value)
    if (oldEntry) {
      const dataUrl = captureDrawing()
      if (dataUrl) {
        oldEntry.drawing = dataUrl
      } else {
        delete oldEntry.drawing
      }
    }
  }

  mountCanvas(el)
  // Pre-populate store from persisted drawing data
  const entry = entries.value.find((e) => e.id === entryId)
  if (entry?.drawing) {
    setStoredDrawing(entryId, entry.drawing)
  }
  loadDrawing(entryId)
}

function syncDrawingToEntry() {
  if (!activeId.value) return
  const entry = entries.value.find((e) => e.id === activeId.value)
  if (!entry) return
  const dataUrl = captureDrawing()
  if (dataUrl) {
    entry.drawing = dataUrl
  } else {
    delete entry.drawing
  }
}

async function handleSave() {
  syncDrawingToEntry()
  await saveEntry()
}

function handleBlurSave() {
  syncDrawingToEntry()
  snapshotSave()
}

function doStartReview() {
  startReview(pendingForceReview.value)
}

function handleExitReview() {
  exitReview()
}

// Unsaved modal handlers
async function handleSaveAndProceed() {
  await handleSave()
  proceedAfterSave()
}

function handleDiscardAndProceed() {
  discardChanges()
  proceedAfterSave()
}

function handleCancelProceed() {
  pendingEntryId.value = null
  pendingAction.value = null
  pendingSubject.value = ''
  showUnsavedModal.value = false
}

function proceedAfterSave() {
  showUnsavedModal.value = false
  const action = pendingAction.value
  pendingAction.value = null
  if (action === 'select' && pendingEntryId.value) {
    loadEntry(pendingEntryId.value)
    pendingEntryId.value = null
  } else if (action === 'create') {
    doCreate()
  } else if (action === 'review') {
    doStartReview()
  }
}

// Navigation state (edit mode only)
const filteredIds = computed(() => filteredEntries.value.map((e) => e.id))
const navIdx = computed(() => (activeId.value ? filteredIds.value.indexOf(activeId.value) : -1))
const canGoPrev = computed(() => navIdx.value > 0)
const canGoNext = computed(() => navIdx.value < filteredIds.value.length - 1 && navIdx.value >= 0)

loadEntries()
loadLogs()

watch(activeId, (_newId) => {
  // loadDrawing is called from handleMountCanvas after the canvas is ready
})
</script>

<template>
  <!-- @AI-VIEW: DOM 可自由重构。样式仅限 Tailwind CSS 工具类。严禁内联 style 或自定义 CSS。 -->
  <Transition name="page">
    <NotebookMenu
      v-if="showNotebookMenu"
      key="menu"
      @enter="handleEnterNotebook"
      @open-settings="settingsOpen = true"
    />
    <Workspace
      v-else
      key="workspace"
      :notebook-name="activeNotebook?.name ?? ''"
      :entries="notebookEntries"
      :filtered-entries="filteredEntries"
      :active-id="activeId"
      :active-entry="activeEntry"
      :answers-hidden="answersHidden"
      :is-dirty="isDirty"
      :selected-ids="selectedIds"
      :selected-count="selectedCount"
      :subject-map="subjectMap"
      :tag-map="tagMap"
      :mastery-map="masteryMap"
      :due-count="dueCount"
      :mode="mode"
      :search-query="searchQuery"
      :sort-key="sortKey"
      :sort-dir="sortDir"
      :can-go-prev="canGoPrev"
      :can-go-next="canGoNext"
      :progress="progress"
      :progress-percent="progressPercent"
      :drawing-enabled="drawingEnabled"
      :active-tool="activeTool"
      :pen-color="penColor"
      :can-undo="canUndo"
      :can-redo="canRedo"
      :show-delete-modal="showDeleteModal"
      :show-batch-delete-confirm="showBatchDeleteConfirm"
      :show-unsaved-modal="showUnsavedModal"
      :stats-open="statsOpen"
      :settings-open="settingsOpen"
      :is-electron="isElectron"
      :is-dark="isDark"
      :current-card="currentCard"
      :answered="answered"
      :elapsed-ms="elapsedMs"
      :reviewed-today="reviewedToday"
      :is-reviewing="isReviewing"
      :session-done="sessionDone"
      :session-records="sessionRecords"
      :total-session-ms="totalSessionMs"
      :review-queue="reviewQueue"
      :active-subject="activeSubject"
      :active-tag="activeTag"
      :active-mastery="activeMastery"
      :stats="stats"
      @return-to-menu="handleReturnToMenu"
      @select="handleSelectEntry"
      @filter-subject="setSubject"
      @filter-tag="setTag"
      @filter-mastery="setMastery"
      @filter-search="setSearch"
      @set-sort="(key: SortKey, dir?: SortDir) => setSort(key, dir)"
      @reorder="reorderEntries"
      @quick-create="handleCreate"
      @rename="updateEntryTitle"
      @save="handleSave"
      @mark-dirty="markDirty"
      @blur-save="handleBlurSave"
      @delete="handleDelete"
      @confirm-delete="handleConfirmDelete"
      @close-delete-modal="closeDeleteModal"
      @prev="navigate(-1)"
      @next="navigate(1)"
      @wheel-nav="navigate"
      @start-review="handleStartReview"
      @exit-review="handleExitReview"
      @toggle-mode="mode === 'review' ? handleExitReview() : handleStartReview()"
      @reveal="mode === 'review' ? revealAnswer() : (answersHidden = !answersHidden)"
      @rate-card="(r: number | string, note: string) => rateCard(r, note)"
      @dismiss-summary="dismissSummary"
      @toggle-drawing="toggleDrawing"
      @set-tool="setTool"
      @set-color="setColor"
      @undo="undo"
      @redo="redo"
      @clear-canvas="clearCanvas"
      @mount-canvas="(el: HTMLElement, entryId: string) => handleMountCanvas(el, entryId)"
      @toggle-select="toggleSelect"
      @range-select="(ids: string[], from: number, to: number) => selectRange(ids, from, to)"
      @select-all="selectAll"
      @deselect-all="deselectAll"
      @batch-delete="handleBatchDelete"
      @confirm-batch-delete="confirmBatchDelete"
      @cancel-batch-delete="cancelBatchDelete"
      @batch-tag="handleBatchTag"
      @batch-export="handleBatchExport"
      @export-json="exportData"
      @export-pdf="handleExportPDF"
      @import-json="importData"
      @import-text="handleOpenBatchImport"
      @toggle-stats="statsOpen = !statsOpen"
      @toggle-settings="settingsOpen = !settingsOpen"
      @toggle-dark="toggleDark"
      @change-data-dir="handleChangeDataDir"
      @save-and-proceed="handleSaveAndProceed"
      @discard-and-proceed="handleDiscardAndProceed"
      @cancel-proceed="handleCancelProceed"
    />
  </Transition>
  <Transition name="stats">
    <SettingsPanel
      v-if="settingsOpen"
      :is-dark="isDark"
      :is-electron="isElectron"
      @close="settingsOpen = false"
      @toggle-dark="toggleDark"
      @change-data-dir="handleChangeDataDir"
    />
  </Transition>
  <!-- Batch text import modal -->
  <Transition name="stats">
    <div
      v-if="showBatchImport"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      @click.self="showBatchImport = false"
    >
      <div
        class="bg-white dark:bg-[#1e1e1c] rounded-2xl shadow-xl border border-gray-200 dark:border-[#2e2e2c] w-full max-w-lg mx-4 p-6"
      >
        <h2 class="text-[15px] font-semibold text-gray-800 dark:text-brand-light-gray mb-1">
          批量导入错题
        </h2>
        <p class="text-[12px] text-gray-400 dark:text-brand-mid mb-4">
          粘贴带序号的题目文本，支持 "答案：" 或 "解析：" 分割。示例格式：<br />
          <code class="text-[11px]">1. 题目内容... 答案：正确答案</code>
        </p>
        <textarea
          v-model="batchImportText"
          class="w-full h-48 px-3 py-2 text-[13px] rounded-lg border border-gray-200 dark:border-[#2e2e2c] bg-gray-50 dark:bg-[#141412] text-gray-700 dark:text-brand-light-gray focus:outline-none focus:border-accent/40 resize-none"
          placeholder="在此粘贴题目文本..."
          :disabled="batchImportLoading"
        />
        <div class="flex justify-end gap-2 mt-4">
          <button
            class="px-4 py-1.5 text-[12px] rounded-lg text-gray-500 dark:text-brand-mid hover:bg-gray-100 dark:hover:bg-[#2a2a28] transition-colors"
            @click="showBatchImport = false"
            :disabled="batchImportLoading"
          >
            取消
          </button>
          <button
            class="px-4 py-1.5 text-[12px] font-medium rounded-lg bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            :disabled="!batchImportText.trim() || batchImportLoading"
            @click="handleConfirmBatchImport"
          >
            {{ batchImportLoading ? '导入中...' : '一键导入' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
  <AppToast :message="toastMsg" />
</template>
