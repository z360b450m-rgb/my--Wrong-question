<script setup lang="ts">
import { ref, watch, onUnmounted, nextTick } from 'vue'
import type { NoteEntry } from '@/types'
import AnswerPanel from './AnswerPanel.vue'

const props = defineProps<{
  entry: NoteEntry
  answersHidden: boolean
}>()

const emit = defineEmits<{
  update: []
  reveal: []
  'blur-save': []
}>()

function onBlur() {
  emit('blur-save')
}

// Template refs
const questionBody = ref<HTMLDivElement | null>(null)
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
}

function stopResize() {
  document.body.classList.remove('resizing')
  resizeH.value?.classList.remove('dragging')
  resizeV.value?.classList.remove('dragging')
  resizeState = null
  window.removeEventListener('mousemove', onResize)
  window.removeEventListener('mouseup', stopResize)
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onResize)
  window.removeEventListener('mouseup', stopResize)
})
</script>

<template>
  <div class="flex-1 flex flex-col overflow-hidden p-4 gap-3">
    <!-- Meta row -->
    <div class="flex items-center gap-2.5 px-1 flex-wrap">
      <input
        type="text"
        class="border border-gray-200 dark:border-gray-700 rounded-md px-2.5 py-1.5 text-xs outline-none bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 dark:text-gray-100 focus:border-accent w-[100px]"
        placeholder="学科（如：数学）"
        :value="entry.subject"
        @input="entry.subject = ($event.target as HTMLInputElement).value; emit('update')"
        @blur="onBlur"
      />
      <input
        type="text"
        class="border border-gray-200 dark:border-gray-700 rounded-md px-2.5 py-1.5 text-xs outline-none bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 dark:text-gray-100 focus:border-accent w-[120px]"
        placeholder="来源（如：月考）"
        :value="entry.source"
        @input="entry.source = ($event.target as HTMLInputElement).value; emit('update')"
        @blur="onBlur"
      />
      <input
        type="text"
        class="flex-1 min-w-[140px] border border-gray-200 dark:border-gray-700 rounded-md px-2.5 py-1.5 text-xs outline-none bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 dark:text-gray-100 focus:border-accent"
        placeholder="标签，逗号分隔"
        :value="entry.tags.join(', ')"
        @input="entry.tags = ($event.target as HTMLInputElement).value.split(',').map(t => t.trim()).filter(Boolean); emit('update')"
        @blur="onBlur"
      />
    </div>

    <!-- Question panel -->
    <div
      ref="questionPanelEl"
      class="flex-shrink-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col overflow-hidden"
      style="height: 35%"
    >
      <div class="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 border-b border-gray-200 dark:border-gray-700 bg-[#fafbfc] dark:bg-gray-800 flex-shrink-0">
        <span class="w-2 h-2 rounded-full bg-accent" />
        题目
      </div>
      <div
        ref="questionBody"
        class="flex-1 px-3.5 py-3 overflow-y-auto text-sm leading-relaxed md-content outline-none min-h-[60px]"
        contenteditable="true"
        data-placeholder="在此输入题目内容…&#10;支持 Markdown 语法，Ctrl+V 粘贴图片"
        @input="onQuestionInput"
        @paste="onQuestionPaste"
        @blur="onBlur"
      />
    </div>

    <!-- Resize handle: question <-> answers -->
    <div
      ref="resizeH"
      class="resize-h flex-shrink-0 h-2 cursor-row-resize bg-transparent hover:bg-accent transition-colors relative -my-0.5"
      @mousedown="startResize($event, 'h')"
    >
      <span class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-0.5 rounded-sm bg-gray-200 resize-h-bar" />
    </div>

    <!-- Answers row -->
    <div ref="answersRowEl" class="flex-1 flex gap-3 min-h-[180px] overflow-hidden">
      <AnswerPanel
        ref="wrongPanelEl"
        type="wrong"
        :hidden="false"
        :model-value="entry.wrongAnswer"
        :entry-id="entry.id"
        @update:model-value="entry.wrongAnswer = $event; emit('update')"
        @reveal="emit('reveal')"
        @blur="onBlur"
      />

      <!-- Resize handle: wrong <-> correct -->
      <div
        ref="resizeV"
        class="resize-v flex-shrink-0 w-2 cursor-col-resize bg-transparent hover:bg-accent transition-colors relative -mx-0.5"
        @mousedown="startResize($event, 'v')"
      >
        <span class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-10 rounded-sm bg-gray-200 resize-v-bar" />
      </div>

      <AnswerPanel
        ref="correctPanelEl"
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
</template>

<style scoped>
.resize-h-bar { background: #e5e7eb; }
.resize-h:hover .resize-h-bar,
.resize-h.dragging .resize-h-bar { background: white; }

.resize-v-bar { background: #e5e7eb; }
.resize-v:hover .resize-v-bar,
.resize-v.dragging .resize-v-bar { background: white; }

.panel-body:empty::before {
  content: attr(data-placeholder);
  color: #cbd5e1;
}
</style>
