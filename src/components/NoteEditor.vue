<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick, inject, type Ref } from 'vue'
import type { NoteEntry } from '@/types'
import { useReviewLogs } from '@/composables/useReviewLogs'
import CameraCapture from './CameraCapture.vue'
import AnswerPanel from './AnswerPanel.vue'

const props = defineProps<{
  entry: NoteEntry
  answersHidden: boolean
}>()

const emit = defineEmits<{
  update: []
  reveal: []
  'blur-save': []
  'mount-canvas': [el: HTMLElement]
}>()

function onBlur() {
  emit('blur-save')
}

// Template refs
const questionBody = ref<HTMLDivElement | null>(null)
const questionContentRef = ref<HTMLDivElement | null>(null)
const wrongPanelEl = ref<HTMLDivElement | null>(null)
const correctPanelEl = ref<HTMLDivElement | null>(null)
const questionPanelEl = ref<HTMLDivElement | null>(null)
const answersRowEl = ref<HTMLDivElement | null>(null)
const resizeH = ref<HTMLDivElement | null>(null)
const resizeV = ref<HTMLDivElement | null>(null)

let suppressInput = false

function onQuestionInput() {
  if (suppressInput) return
  if (questionBody.value) {
    props.entry.question = questionBody.value.innerHTML
  }
  emit('update')
}

function onQuestionPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const blob = item.getAsFile()
      if (!blob) continue
      const reader = new FileReader()
      reader.onload = () => {
        const img = document.createElement('img')
        img.src = reader.result as string
        img.style.maxWidth = '100%'
        img.style.borderRadius = '6px'
        const sel = window.getSelection()
        if (!sel) return
        const range = sel.getRangeAt(0)
        range.deleteContents()
        range.insertNode(img)
        range.collapse(false)
        const br = document.createElement('br')
        range.insertNode(br)
        range.setStartAfter(br)
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
        questionBody.value?.focus()
        onQuestionInput()
      }
      reader.readAsDataURL(blob)
      break
    }
  }
}

// Image tools for question panel
const qCamOpen = ref(false)
const qFileInput = ref<HTMLInputElement | null>(null)

function insertQuestionImage(src: string) {
  const el = questionBody.value
  if (!el) return
  el.focus()

  const img = document.createElement('img')
  img.src = src
  img.style.maxWidth = '100%'
  img.style.borderRadius = '6px'

  const sel = window.getSelection()
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0)
    range.deleteContents()
    range.insertNode(img)
    range.collapse(false)
    const br = document.createElement('br')
    range.insertNode(br)
    range.setStartAfter(br)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
  } else {
    el.appendChild(img)
    el.appendChild(document.createElement('br'))
  }
  onQuestionInput()
}

function onQuestionDragOver(e: DragEvent) {
  if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
}

function onQuestionDrop(e: DragEvent) {
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return
  e.preventDefault()
  for (const file of files) {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => insertQuestionImage(reader.result as string)
      reader.readAsDataURL(file)
      break
    }
  }
}

function openQuestionFilePicker() {
  qFileInput.value?.click()
}

function onQuestionFileChange() {
  const file = qFileInput.value?.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => insertQuestionImage(reader.result as string)
  reader.readAsDataURL(file)
  qFileInput.value!.value = ''
}

function onQuestionCamCapture(dataUrl: string) {
  qCamOpen.value = false
  insertQuestionImage(dataUrl)
}

const drawingEnabled = inject<Ref<boolean>>('drawingEnabled', ref(false))
const resizeCanvas = inject<() => void>('resizeCanvas', () => {})

// Responsive: stack answers vertically when container is narrow
const answersNarrow = ref(false)
let answersObserver: ResizeObserver | null = null

onMounted(() => {
  if (!answersRowEl.value) return
  answersObserver = new ResizeObserver((entries) => {
    for (const e of entries) {
      answersNarrow.value = e.contentRect.width < 500
    }
  })
  answersObserver.observe(answersRowEl.value)
})

// Review history
const { reviewLogs } = useReviewLogs()
const historyOpen = ref(false)

const entryLogs = computed(() =>
  reviewLogs.value
    .filter(l => l.entryId === props.entry.id)
    .sort((a, b) => a.timestamp - b.timestamp),
)

function qualityNum(q: number | string): number {
  return typeof q === 'number' ? q : Number(q)
}

const QUALITY_DEFS: Record<number, { label: string; color: string }> = {
  0: { label: '遗忘', color: '#ef4444' },
  1: { label: '错误', color: '#f97316' },
  2: { label: '勉强', color: '#f59e0b' },
  3: { label: '困难', color: '#eab308' },
  4: { label: '犹豫', color: '#84cc16' },
  5: { label: '完美', color: '#22c55e' },
}

function qualityInfo(q: number | string) {
  return QUALITY_DEFS[qualityNum(q)] ?? { label: String(q), color: '#9ca3af' }
}

function fmtDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// Set question content when entry changes, without v-html interference
watch(
  () => props.entry.id,
  () => {
    nextTick(() => {
      if (questionBody.value) {
        suppressInput = true
        questionBody.value.innerHTML = props.entry.question
        suppressInput = false
      }
      if (questionContentRef.value) {
        emit('mount-canvas', questionContentRef.value)
      }
    })
  },
  { immediate: true },
)

// Resize logic
interface ResizeState {
  type: 'h' | 'v'
  startX: number
  startY: number
  questionH: number
  answersH: number
  wrongW: number
  correctW: number
  detailH: number
}

let resizeState: ResizeState | null = null

function startResize(e: MouseEvent, type: 'h' | 'v') {
  e.preventDefault()
  if (!questionPanelEl.value || !answersRowEl.value) return

  const qp = questionPanelEl.value
  const ar = answersRowEl.value
  const detailEl = qp.parentElement
  if (!detailEl) return

  resizeState = {
    type,
    startX: e.clientX,
    startY: e.clientY,
    questionH: qp.offsetHeight,
    answersH: ar.offsetHeight,
    wrongW: wrongPanelEl.value?.offsetWidth || 0,
    correctW: correctPanelEl.value?.offsetWidth || 0,
    detailH: detailEl.offsetHeight,
  }
  document.body.classList.add('resizing')
  if (type === 'h') resizeH.value?.classList.add('dragging')
  if (type === 'v') resizeV.value?.classList.add('dragging')
  window.addEventListener('mousemove', onResize)
  window.addEventListener('mouseup', stopResize)
}

function onResize(e: MouseEvent) {
  if (!resizeState) return
  const r = resizeState

  if (r.type === 'h') {
    const deltaY = e.clientY - r.startY
    const gap = 20 // detail gap + handle area
    const minQ = 100
    const minA = 120
    const maxQ = r.detailH - minA - gap
    const newQH = Math.max(minQ, Math.min(maxQ, r.questionH + deltaY))
    const pct = (newQH / (r.detailH - gap)) * 100
    if (questionPanelEl.value) {
      questionPanelEl.value.style.height = pct + '%'
      questionPanelEl.value.style.flex = '0 0 auto'
    }
    if (answersRowEl.value) {
      answersRowEl.value.style.flex = '1'
    }
  }

  if (r.type === 'v') {
    const deltaX = e.clientX - r.startX
    const totalW = r.wrongW + r.correctW
    const minW = 150
    const maxW = totalW - minW
    const newWrongW = Math.max(minW, Math.min(maxW, r.wrongW + deltaX))
    const wrongPct = (newWrongW / totalW) * 100
    if (wrongPanelEl.value) {
      wrongPanelEl.value.style.flex = `0 0 ${wrongPct}%`
    }
    if (correctPanelEl.value) {
      correctPanelEl.value.style.flex = '1'
    }
  }

  resizeCanvas()
}

function stopResize() {
  document.body.classList.remove('resizing')
  resizeH.value?.classList.remove('dragging')
  resizeV.value?.classList.remove('dragging')
  resizeState = null
  window.removeEventListener('mousemove', onResize)
  window.removeEventListener('mouseup', stopResize)
  resizeCanvas()
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onResize)
  window.removeEventListener('mouseup', stopResize)
  answersObserver?.disconnect()
})
</script>

<template>
  <div class="flex-1 flex flex-col overflow-hidden p-4 gap-3">
    <!-- Meta row -->
    <div class="flex items-center gap-2.5 px-1 flex-wrap">
      <input
        type="text"
        class="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-lg px-2.5 py-1.5 text-xs outline-none text-gray-800 dark:text-gray-100 focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all w-[100px]"
        placeholder="学科（如：言语）"
        :value="entry.subject"
        @input="entry.subject = ($event.target as HTMLInputElement).value; emit('update')"
        @blur="onBlur"
      />
      <input
        type="text"
        class="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-lg px-2.5 py-1.5 text-xs outline-none text-gray-800 dark:text-gray-100 focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all w-[120px]"
        placeholder="来源（如：月考）"
        :value="entry.source"
        @input="entry.source = ($event.target as HTMLInputElement).value; emit('update')"
        @blur="onBlur"
      />
      <input
        type="text"
        class="flex-1 min-w-[140px] border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-lg px-2.5 py-1.5 text-xs outline-none text-gray-800 dark:text-gray-100 focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
        placeholder="标签，逗号分隔"
        :value="entry.tags.join(', ')"
        @input="entry.tags = ($event.target as HTMLInputElement).value.split(',').map(t => t.trim()).filter(Boolean); emit('update')"
        @blur="onBlur"
      />
    </div>

    <!-- Review history timeline -->
    <div
      v-if="entryLogs.length > 0"
      class="mx-1 border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden flex-shrink-0"
    >
      <button
        class="w-full flex items-center justify-between px-3 py-1.5 text-[11px] text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        @click="historyOpen = !historyOpen"
      >
        <span class="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          复习历史 ({{ entryLogs.length }})
        </span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
          class="transition-transform duration-200"
          :class="{ 'rotate-180': historyOpen }"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div v-if="historyOpen" class="px-3 pb-2.5 overflow-x-auto">
        <div class="flex items-start min-w-max pt-1">
          <template v-for="(log, i) in entryLogs" :key="log.id">
            <div class="flex flex-col items-center gap-0.5 flex-shrink-0" style="min-width: 44px;">
              <span
                class="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 ring-white dark:ring-gray-900"
                :style="{ backgroundColor: qualityInfo(log.quality).color }"
              />
              <span class="text-[9px] text-gray-400 dark:text-gray-500 leading-none">{{ fmtDate(log.timestamp) }}</span>
              <span class="text-[9px] font-medium leading-none" :style="{ color: qualityInfo(log.quality).color }">
                {{ qualityInfo(log.quality).label }}
              </span>
            </div>
            <div
              v-if="i < entryLogs.length - 1"
              class="flex-shrink-0 h-px mt-[5px] w-5 bg-gray-200 dark:bg-gray-700"
            />
          </template>
        </div>
      </div>
    </div>

    <!-- Question panel -->
    <div
      ref="questionPanelEl"
      class="flex-shrink-0 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm flex flex-col overflow-hidden"
      style="height: 35%"
    >
      <div class="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800 bg-[#fafbfc] dark:bg-gray-800 flex-shrink-0">
        <span class="w-2 h-2 rounded-full bg-accent" />
        题目
      </div>
      <div class="flex-1 overflow-y-auto">
        <div ref="questionContentRef" style="position: relative; min-height: 100%;">
          <div class="relative group h-full">
            <div
              ref="questionBody"
              class="px-3.5 py-3 text-sm leading-relaxed md-content outline-none min-h-[60px] h-full"
              :contenteditable="drawingEnabled ? 'false' : 'true'"
            data-placeholder="在此输入题目内容…&#10;支持 Markdown 语法，Ctrl+V 粘贴图片"
            @input="onQuestionInput"
            @paste="onQuestionPaste"
            @dragover="onQuestionDragOver"
            @drop="onQuestionDrop"
            @blur="onBlur"
          />
            <!-- Image tools -->
            <div v-if="!drawingEnabled" class="absolute right-2 bottom-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button
                class="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-200 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-all active:scale-90"
                title="拍照"
                @click="qCamOpen = true"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
                </svg>
              </button>
              <button
                class="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-200 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-all active:scale-90"
                title="导入图片"
                @click="openQuestionFilePicker"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                </svg>
              </button>
              <input ref="qFileInput" type="file" accept="image/*" class="hidden" @change="onQuestionFileChange" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Resize handle: question <-> answers -->
    <div
      ref="resizeH"
      class="resize-h flex-shrink-0 h-2 cursor-row-resize bg-transparent hover:bg-accent transition-colors relative -my-0.5"
      @mousedown="startResize($event, 'h')"
    >
      <span class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-0.5 rounded-sm bg-gray-200 dark:bg-gray-600 resize-h-bar" />
    </div>

    <!-- Answers row -->
    <div
      ref="answersRowEl"
      class="flex-1 flex gap-3 min-h-[180px] overflow-hidden"
      :class="answersNarrow ? 'flex-col' : ''"
    >
      <div ref="wrongPanelEl" class="flex-1 flex min-h-0">
        <AnswerPanel
          type="wrong"
          :hidden="false"
          :model-value="entry.wrongAnswer"
          :entry-id="entry.id"
          @update:model-value="entry.wrongAnswer = $event; emit('update')"
          @reveal="emit('reveal')"
          @blur="onBlur"
        />
      </div>

      <!-- Resize handle: wrong <-> correct (hidden in narrow mode) -->
      <div
        v-if="!answersNarrow"
        ref="resizeV"
        class="resize-v flex-shrink-0 w-3 cursor-col-resize bg-transparent hover:bg-accent/20 transition-colors relative -mx-0.5 rounded"
        @mousedown="startResize($event, 'v')"
      >
        <span class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-12 rounded-sm bg-gray-200 dark:bg-gray-600 resize-v-bar" />
      </div>

      <div ref="correctPanelEl" class="flex-1 flex min-h-0">
        <AnswerPanel
          type="correct"
          :hidden="answersHidden"
          :model-value="entry.correctAnswer"
          :entry-id="entry.id"
          @update:model-value="entry.correctAnswer = $event; emit('update')"
          @reveal="emit('reveal')"
          @blur="onBlur"
        />
      </div>
    </div>

    <CameraCapture
      v-if="qCamOpen"
      @capture="onQuestionCamCapture"
      @close="qCamOpen = false"
    />
  </div>
</template>

<style scoped>
.resize-h-bar { background: #e5e7eb; }
.dark .resize-h-bar { background: #4b5563; }
.resize-h:hover .resize-h-bar,
.resize-h.dragging .resize-h-bar { background: white; }
.dark .resize-h:hover .resize-h-bar,
.dark .resize-h.dragging .resize-h-bar { background: #6366f1; }

.resize-v-bar { background: #e5e7eb; }
.dark .resize-v-bar { background: #4b5563; }
.resize-v:hover .resize-v-bar,
.resize-v.dragging .resize-v-bar { background: white; }
.dark .resize-v:hover .resize-v-bar,
.dark .resize-v.dragging .resize-v-bar { background: #6366f1; }

.panel-body:empty::before {
  content: attr(data-placeholder);
  color: #cbd5e1;
}
.dark .panel-body:empty::before {
  color: #4b5563;
}
</style>
