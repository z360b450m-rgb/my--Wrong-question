<script setup lang="ts">
import { provide, computed, ref, onMounted, nextTick } from 'vue'
import { useEntries } from './composables/useEntries'
import { useFilter } from './composables/useFilter'
import { useReview } from './composables/useReview'
import { useDrawing, PEN_COLORS } from './composables/useDrawing'
import { useBackup } from './composables/useBackup'
import { useStats } from './composables/useStats'
import { useKeyboard } from './composables/useKeyboard'
import AppSidebar from './components/AppSidebar.vue'
import AppToolbar from './components/AppToolbar.vue'
import NoteEditor from './components/NoteEditor.vue'
import ReviewPanel from './components/ReviewPanel.vue'
import DeleteModal from './components/DeleteModal.vue'
import StatsPanel from './components/StatsPanel.vue'
import AppToast from './components/AppToast.vue'

const {
  entries,
  activeId,
  activeEntry,
  answersHidden,
  loadEntries,
  createEntry,
  loadEntry,
  saveCurrent,
  deleteCurrent,
  updateEntryTitle,
  reorderEntries,
  toastMsg,
  showToast,
  showDeleteModal,
  openDeleteModal,
  closeDeleteModal,
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
  toggleDrawing,
  setTool,
  setColor,
  clearCanvas,
  mountCanvas,
} = useDrawing()

const { exportJSON, importJSON } = useBackup(entries, showToast)

const stats = useStats(entries)
const statsOpen = ref(false)

const mainArea = ref<HTMLElement | null>(null)
const canvasMounted = ref(false)

onMounted(() => {
  nextTick(() => {
    if (mainArea.value && !canvasMounted.value) {
      mountCanvas(mainArea.value)
      canvasMounted.value = true
    }
  })
})

provide('toast', showToast)

useKeyboard({
  onCreate: createEntry,
  onSave: saveCurrent,
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
})

function navigate(dir: number) {
  if (!activeId.value) return
  const ids = filteredEntries.value.map(e => e.id)
  const idx = ids.indexOf(activeId.value)
  const newIdx = idx + dir
  if (newIdx >= 0 && newIdx < ids.length) {
    loadEntry(ids[newIdx])
  }
}

function handleCreate(subject?: string) {
  createEntry(subject)
}

function handleDelete() {
  openDeleteModal()
}

function handleConfirmDelete() {
  deleteCurrent()
}

function handleSelectEntry(id: string) {
  if (mode.value === 'review') exitReview()
  loadEntry(id)
}

function handleStartReview(force = false) {
  startReview(force)
}

function handleExitReview() {
  exitReview()
}

// Navigation state (edit mode only)
const filteredIds = computed(() => filteredEntries.value.map(e => e.id))
const navIdx = computed(() => activeId.value ? filteredIds.value.indexOf(activeId.value) : -1)
const canGoPrev = computed(() => navIdx.value > 0)
const canGoNext = computed(() => navIdx.value < filteredIds.value.length - 1 && navIdx.value >= 0)

loadEntries()
</script>

<template>
  <div class="flex h-screen">
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
      @select="handleSelectEntry"
      @filter-subject="setSubject"
      @filter-tag="setTag"
      @quick-create="handleCreate"
      @rename="updateEntryTitle"
      @start-review="handleStartReview"
      @set-sort="(key, dir) => setSort(key, dir)"
      @reorder="reorderEntries"
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
        @new="handleCreate()"
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
          @update="saveCurrent"
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
          @rate="(q: number) => rateCard(q)"
          @start-review="(force: boolean) => handleStartReview(force)"
          @exit-review="handleExitReview"
        />

        <div v-else class="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="opacity-25">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          <p class="text-sm">选择或创建一条错题</p>
          <span class="text-xs opacity-70">Ctrl+N 快速新建 · 支持 Markdown · 可直接粘贴图片</span>
        </div>
      </div>

      <!-- Floating drawing toolbar -->
      <div
        v-if="drawingEnabled"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-white rounded-xl shadow-lg border border-gray-200 px-2.5 py-2"
      >
        <!-- Pen tool -->
        <button
          class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
          :class="activeTool === 'pen' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-600'"
          @click="setTool('pen')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          笔
        </button>

        <!-- Color swatches -->
        <div class="w-px h-4 bg-gray-200" />
        <button
          v-for="c in PEN_COLORS"
          :key="c.code"
          class="w-6 h-6 rounded-full transition-all border-2 flex-shrink-0"
          :class="penColor === c.code && activeTool === 'pen' ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'"
          :style="{ backgroundColor: c.code }"
          :title="c.name"
          @click="setColor(c.code)"
        />

        <!-- Eraser -->
        <div class="w-px h-4 bg-gray-200" />
        <button
          class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
          :class="activeTool === 'eraser' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-600'"
          @click="setTool('eraser')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8L14.6 1.6c.8-.8 2-.8 2.8 0L21 5.2c.8.8.8 2 0 2.8L12 17"/><line x1="6" y1="20" x2="11" y2="20"/>
          </svg>
          橡皮
        </button>

        <!-- Clear -->
        <div class="w-px h-4 bg-gray-200" />
        <button
          class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-red-500 hover:bg-red-50 transition-all font-medium"
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

    <Transition name="stats">
      <StatsPanel
        v-if="statsOpen"
        :stats="stats"
        @close="statsOpen = false"
      />
    </Transition>

    <AppToast :message="toastMsg" />
  </div>
</template>
