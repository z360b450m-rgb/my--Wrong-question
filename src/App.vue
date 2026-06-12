<script setup lang="ts">
import { provide, computed, ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useEntries } from './composables/useEntries'
import { useFilter } from './composables/useFilter'
import { useReview } from './composables/useReview'
import { useDrawing, PEN_COLORS } from './composables/useDrawing'
import { useBackup } from './composables/useBackup'
import { useStats } from './composables/useStats'
import { useKeyboard } from './composables/useKeyboard'
import { useDarkMode } from './composables/useDarkMode'
import AppSidebar from './components/AppSidebar.vue'
import AppToolbar from './components/AppToolbar.vue'
import NoteEditor from './components/NoteEditor.vue'
import ReviewPanel from './components/ReviewPanel.vue'
import DeleteModal from './components/DeleteModal.vue'
import StatsPanel from './components/StatsPanel.vue'
import UnsavedModal from './components/UnsavedModal.vue'
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
} = useEntries()

const {
  activeSubject,
  activeTag,
  searchQuery,
  sortKey,
  sortDir,
  filteredEntries,
  subjectMap,
  tagMap,
  setSubject,
  setTag,
  setSearch,
  setSort,
} = useFilter(entries)

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
  startReview,
  revealAnswer,
  rateCard,
  exitReview,
} = useReview(entries)

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
  mountCanvas,
  setCanvasParent,
} = useDrawing()

const { exportJSON, importJSON } = useBackup(entries, showToast)
const { isDark, toggleDark } = useDarkMode()

const stats = useStats(entries)
const statsOpen = ref(false)

const mainArea = ref<HTMLElement | null>(null)
const canvasMounted = ref(false)

// Unsaved changes flow
const showUnsavedModal = ref(false)
const pendingEntryId = ref<string | null>(null)
const pendingAction = ref<'select' | 'create' | 'review' | null>(null)

onMounted(async () => {
  nextTick(() => {
    if (mainArea.value && !canvasMounted.value) {
      mountCanvas(mainArea.value)
      canvasMounted.value = true
    }
  })
  // Check for crash recovery
  const recovered = await checkCrashRecovery()
  if (recovered.length > 0) {
    showToast(`已恢复 ${recovered.length} 条未保存的内容`)
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
  checkDirtyThen(
    () => createEntry(subject),
    'create',
  )
}

function doCreate() {
  createEntry()
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
  checkDirtyThen(
    () => startReview(force),
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
</script>

<template>
  <div class="flex h-screen bg-white dark:bg-gray-900">
    <AppSidebar
      :entries="entries"
      :filtered-entries="filteredEntries"
      :active-id="activeId"
      :active-subject="activeSubject"
      :active-tag="activeTag"
      :sort-key="sortKey"
      :sort-dir="sortDir"
      :subject-map="subjectMap"
      :tag-map="tagMap"
      :due-count="dueCount"
      :mode="mode"
      :selected-ids="selectedIds"
      :selected-count="selectedCount"
      @select="handleSelectEntry"
      @filter-subject="setSubject"
      @filter-tag="setTag"
      @quick-create="handleCreate"
      @rename="updateEntryTitle"
      @start-review="handleStartReview"
      @set-sort="(key, dir) => setSort(key, dir)"
      @reorder="reorderEntries"
      @toggle-select="toggleSelect"
      @range-select="(ids, from, to) => selectRange(ids, from, to)"
      @select-all="selectAll"
      @deselect-all="deselectAll"
      @batch-delete="handleBatchDelete"
      @batch-tag="handleBatchTag"
      @batch-export="handleBatchExport"
    />

    <main class="flex-1 flex flex-col min-w-0">
      <AppToolbar
        :active-id="activeId"
        :answers-hidden="answersHidden"
        :can-go-prev="canGoPrev"
        :can-go-next="canGoNext"
        :search-query="searchQuery"
        :mode="mode"
        :due-count="dueCount"
        :progress="progress"
        :drawing-enabled="drawingEnabled"
        :stats-open="statsOpen"
        :is-dirty="isDirty"
        @new="handleCreate()"
        @save="saveEntry"
        @reveal="mode === 'review' ? revealAnswer() : (answersHidden = !answersHidden)"
        @delete="handleDelete"
        @prev="navigate(-1)"
        @next="navigate(1)"
        @search="setSearch"
        @toggleMode="mode === 'review' ? handleExitReview() : handleStartReview()"
        @toggleDrawing="toggleDrawing"
        @toggleStats="statsOpen = !statsOpen"
        @exportJSON="exportJSON"
        @importJSON="importJSON"
      />

      <div ref="mainArea" class="flex-1 flex flex-col min-h-0 canvas-host">
        <NoteEditor
          v-if="mode === 'edit' && activeEntry"
          :entry="activeEntry"
          :answers-hidden="answersHidden"
          @update="markDirty"
          @blur-save="snapshotSave"
          @reveal="answersHidden = false"
        />

        <ReviewPanel
          v-else-if="mode === 'review'"
          :entry="currentCard!"
          :answered="answered"
          :elapsed-ms="elapsedMs"
          :progress="progress"
          :due-count="dueCount"
          :reviewed-today="reviewedToday"
          :is-reviewing="isReviewing"
          @reveal="revealAnswer"
          @rate="(q: number, note: string) => rateCard(q, note)"
          @start-review="(force: boolean) => handleStartReview(force)"
          @exit-review="handleExitReview"
        />

        <div v-else class="flex-1 flex flex-col items-center justify-center gap-4 bg-gray-50/50 dark:bg-gray-900/50">
          <div class="w-24 h-24 rounded-full bg-accent/10 dark:bg-accent/20 flex items-center justify-center text-accent">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </div>
          <h2 class="text-lg font-bold text-gray-700 dark:text-gray-200">开始记录你的知识盲点</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400">Ctrl+N 快速新建 · 支持 Markdown · 可直接粘贴图片</p>
        </div>
      </div>

      <!-- Floating drawing toolbar -->
      <div
        v-if="drawingEnabled"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 px-2.5 py-2"
      >
        <button
          class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ease-out active:scale-95"
          :class="activeTool === 'pen' ? 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300'"
          @click="setTool('pen')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          笔
        </button>

        <div class="w-px h-4 bg-gray-200" />
        <button
          v-for="c in PEN_COLORS"
          :key="c.code"
          class="w-6 h-6 rounded-full transition-all duration-200 ease-out active:scale-90 border-2 flex-shrink-0"
          :class="penColor === c.code && activeTool === 'pen' ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'"
          :style="{ backgroundColor: c.code }"
          :title="c.name"
          @click="setColor(c.code)"
        />

        <div class="w-px h-4 bg-gray-200" />
        <button
          class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ease-out active:scale-95"
          :class="activeTool === 'eraser' ? 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300'"
          @click="setTool('eraser')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8L14.6 1.6c.8-.8 2-.8 2.8 0L21 5.2c.8.8.8 2 0 2.8L12 17"/><line x1="6" y1="20" x2="11" y2="20"/>
          </svg>
          橡皮
        </button>

        <div class="w-px h-4 bg-gray-200" />
        <button
          class="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ease-out active:scale-95"
          :class="canUndo ? 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800' : 'text-gray-300 dark:text-gray-600 cursor-default'"
          :disabled="!canUndo"
          @click="undo()"
          title="撤销 Ctrl+Z"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
          </svg>
        </button>
        <button
          class="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ease-out active:scale-95"
          :class="canRedo ? 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800' : 'text-gray-300 dark:text-gray-600 cursor-default'"
          :disabled="!canRedo"
          @click="redo()"
          title="重做 Ctrl+Y"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/>
          </svg>
        </button>
        <div class="w-px h-4 bg-gray-200" />
        <button
          class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900 dark:bg-red-950 transition-all duration-200 ease-out active:scale-95 font-medium"
          @click="clearCanvas"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          </svg>
          清除
        </button>
      </div>
    </main>

    <DeleteModal
      :visible="showDeleteModal"
      @confirm="handleConfirmDelete"
      @cancel="closeDeleteModal"
    />

    <!-- Batch delete confirmation -->
    <div
      v-if="showBatchDeleteConfirm"
      class="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div class="absolute inset-0 bg-black/30" @click="cancelBatchDelete" />
      <div class="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-800 p-6 w-[360px] max-w-[90vw]">
        <div class="flex items-center gap-2.5 mb-3">
          <div class="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            </svg>
          </div>
          <div>
            <h3 class="text-[15px] font-bold text-gray-800 dark:text-gray-100">批量删除</h3>
            <p class="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">确定要删除选中的 {{ selectedCount }} 条错题吗？此操作不可撤销。</p>
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-5">
          <button
            class="px-4 py-2 rounded-lg text-[13px] font-medium border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 ease-out active:scale-95"
            @click="cancelBatchDelete"
          >
            取消
          </button>
          <button
            class="px-4 py-2 rounded-lg text-[13px] font-medium bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900 transition-all duration-200 ease-out active:scale-95"
            @click="confirmBatchDelete"
          >
            删除 {{ selectedCount }} 条
          </button>
        </div>
      </div>
    </div>

    <UnsavedModal
      :visible="showUnsavedModal"
      @save="handleSaveAndProceed"
      @discard="handleDiscardAndProceed"
      @cancel="handleCancelProceed"
    />

    <Transition name="stats">
      <StatsPanel
        v-if="statsOpen"
        :stats="stats"
        @close="statsOpen = false"
      />
    </Transition>

    <AppToast :message="toastMsg" />

    <!-- Dark mode toggle (bottom-left) -->
    <button
      class="fixed bottom-6 left-6 z-50 flex items-center justify-center w-9 h-9 rounded-full shadow-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-300 hover:scale-110 active:scale-90 transition-all duration-200 ease-out shadow-sm"
      title="切换暗色模式"
      @click="toggleDark"
    >
      <svg v-if="!isDark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
      </svg>
      <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    </button>
  </div>
</template>
