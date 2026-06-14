<script setup lang="ts">
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
  isSelected,
  toggleSelect,
  selectRange,
  selectAll,
  deselectAll,
  batchDelete,
  batchTag,
  batchExport,
  notebookEntries,
} = useEntries()

const { notebooks, activeId: activeNotebookId, activeNotebook, selectNotebook, loadNotebooks, restoreLastNotebook, clearLastNotebook } = useNotebooks()
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
} = useReview(notebookEntries)

const { settings } = useReviewSettings()

const {
  drawingEnabled,
  activeTool,
  penColor,
  canUndo,
  canRedo,
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
} = useDrawing()

const { exportJSON, importJSON } = useBackup(notebookEntries, showToast)
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

async function handleEnterNotebook(id: string) {
  selectNotebook(id)
  showNotebookMenu.value = false
  await loadEntries()
}

async function handleCreatedNotebook(id: string) {
  selectNotebook(id)
  showNotebookMenu.value = false
  await loadEntries()
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
    showToast(`已迁移 ${migrated} 条错题到本地文件`)
  }

  // Check for crash recovery
  const recovered = await checkCrashRecovery()
  if (recovered.length > 0) {
    showToast(`已恢复 ${recovered.length} 条未保存的内容`)
  }

  // Restore last notebook — only show menu on first visit
  const lastId = restoreLastNotebook()
  if (lastId && notebooks.value.some(n => n.id === lastId)) {
    selectNotebook(lastId)
    showNotebookMenu.value = false
    await loadEntries()
  }
})

// Crash protection: save snapshot before unload
function onBeforeUnload() {
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
  onSave: () => { if (activeId.value) saveEntry() },
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
  const ids = filteredEntries.value.map(e => e.id)
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
  checkDirtyThen(
    () => createEntry(subject),
    'create',
  )
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
  exportPDF(entries.value)
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
  checkDirtyThen(
    () => { startReview(force) },
    'review',
  )
}

function doStartReview() {
  startReview(false)
}

function handleExitReview() {
  exitReview()
}

// Unsaved modal handlers
async function handleSaveAndProceed() {
  await saveEntry()
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
const filteredIds = computed(() => filteredEntries.value.map(e => e.id))
const navIdx = computed(() => activeId.value ? filteredIds.value.indexOf(activeId.value) : -1)
const canGoPrev = computed(() => navIdx.value > 0)
const canGoNext = computed(() => navIdx.value < filteredIds.value.length - 1 && navIdx.value >= 0)

loadEntries()

watch(activeId, (newId) => {
  if (newId) loadDrawing(newId)
})
</script>

<template>
  <NotebookMenu
    v-if="showNotebookMenu"
    @enter="handleEnterNotebook"
    @open-settings="settingsOpen = true"
  />
  <Workspace
    v-else
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
    @save="saveEntry"
    @mark-dirty="markDirty"
    @blur-save="snapshotSave"
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
    @mount-canvas="(el: HTMLElement) => mountCanvas(el)"
    @toggle-select="toggleSelect"
    @range-select="(ids: string[], from: number, to: number) => selectRange(ids, from, to)"
    @select-all="selectAll"
    @deselect-all="deselectAll"
    @batch-delete="handleBatchDelete"
    @confirm-batch-delete="confirmBatchDelete"
    @cancel-batch-delete="cancelBatchDelete"
    @batch-tag="handleBatchTag"
    @batch-export="handleBatchExport"
    @export-json="exportJSON"
    @export-pdf="handleExportPDF"
    @import-json="importJSON"
    @toggle-stats="statsOpen = !statsOpen"
    @toggle-settings="settingsOpen = !settingsOpen"
    @toggle-dark="toggleDark"
    @change-data-dir="handleChangeDataDir"
    @save-and-proceed="handleSaveAndProceed"
    @discard-and-proceed="handleDiscardAndProceed"
    @cancel-proceed="handleCancelProceed"
  />
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
  <AppToast :message="toastMsg" />
</template>
