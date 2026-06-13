<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from 'vue'
import type { NoteEntry } from '@/types'
import type { SessionRecord } from '@/composables/useReview'
import { EASE_BUCKET_DEFS } from '@/composables/useStats'

const props = defineProps<{
  entry: NoteEntry | undefined
  answered: boolean
  elapsedMs: number
  progress: string
  progressPercent: number
  dueCount: number
  reviewedToday: number
  isReviewing: boolean
  sessionDone: boolean
  sessionRecords: SessionRecord[]
  totalSessionMs: number
  reviewQueue: NoteEntry[]
}>()

const emit = defineEmits<{
  reveal: []
  rate: [quality: number, note: string]
  startReview: [force: boolean]
  exitReview: []
  dismissSummary: []
  'mount-canvas': [el: HTMLElement]
}>()

const showCorrect = ref(false)
const note = ref('')
const rated = ref(false)
const questionContentRef = ref<HTMLDivElement | null>(null)
const questionPanelEl = ref<HTMLDivElement | null>(null)
const resizeH = ref<HTMLDivElement | null>(null)

interface ResizeState {
  startY: number
  questionH: number
  containerH: number
}
let resizeState: ResizeState | null = null

function startResize(e: MouseEvent) {
  e.preventDefault()
  if (!questionPanelEl.value) return
  const container = questionPanelEl.value.parentElement
  if (!container) return
  resizeState = {
    startY: e.clientY,
    questionH: questionPanelEl.value.offsetHeight,
    containerH: container.offsetHeight,
  }
  resizeH.value?.classList.add('dragging')
  window.addEventListener('mousemove', onResize)
  window.addEventListener('mouseup', stopResize)
}

function onResize(e: MouseEvent) {
  if (!resizeState || !questionPanelEl.value) return
  const r = resizeState
  const deltaY = e.clientY - r.startY
  const gap = 60
  const minQ = 80
  const minA = 200
  const maxQ = r.containerH - minA - gap
  const newQH = Math.max(minQ, Math.min(maxQ, r.questionH + deltaY))
  questionPanelEl.value.style.flex = '0 0 ' + newQH + 'px'
}

function stopResize() {
  resizeH.value?.classList.remove('dragging')
  resizeState = null
  window.removeEventListener('mousemove', onResize)
  window.removeEventListener('mouseup', stopResize)
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onResize)
  window.removeEventListener('mouseup', stopResize)
})

watch(() => props.entry, () => {
  showCorrect.value = false
  note.value = ''
  nextTick(() => {
    if (questionContentRef.value) {
      emit('mount-canvas', questionContentRef.value)
    }
  })
}, { immediate: true })

function reveal() {
  showCorrect.value = true
  rated.value = false
  emit('reveal')
}

function showWrong() {
  showCorrect.value = false
}

const ratings = [
  { q: 0, label: '重来', desc: '完全忘记', color: 'bg-red-500 hover:bg-red-600' },
  { q: 1, label: '困难', desc: '严重错误', color: 'bg-orange-500 hover:bg-orange-600' },
  { q: 2, label: '勉强', desc: '较大遗漏', color: 'bg-amber-500 hover:bg-amber-600' },
  { q: 3, label: '一般', desc: '有些犹豫', color: 'bg-yellow-500 hover:bg-yellow-600' },
  { q: 4, label: '良好', desc: '基本正确', color: 'bg-lime-500 hover:bg-lime-600' },
  { q: 5, label: '完美', desc: '完全掌握', color: 'bg-emerald-500 hover:bg-emerald-600' },
]

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function formatTotalTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  if (m > 0) {
    const sec = s % 60
    return `${m} 分 ${sec} 秒`
  }
  return `${s} 秒`
}

function entryById(id: string): NoteEntry | undefined {
  return props.reviewQueue.find((e) => e.id === id)
}

function masteryBucket(entry: NoteEntry | undefined) {
  if (!entry || entry.easeFactor === undefined) return null
  return EASE_BUCKET_DEFS.find((b) => entry.easeFactor! >= b.min && entry.easeFactor! < b.max) ?? null
}

const qualityLabels = ['遗忘', '错误', '勉强', '困难', '犹豫', '完美']
const qualityColors = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e']
</script>

<template>
  <div class="flex-1 flex flex-col overflow-hidden p-4 gap-3">
    <!-- Session summary -->
    <template v-if="sessionDone">
      <div class="flex-1 flex flex-col items-center overflow-y-auto">
        <div class="flex flex-col items-center gap-2 py-6">
          <div class="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 class="text-lg font-bold text-gray-800 dark:text-gray-100">复习完成</h2>
          <div class="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span>共 {{ sessionRecords.length }} 题</span>
            <span>总用时 {{ formatTotalTime(totalSessionMs) }}</span>
          </div>
        </div>

        <div class="w-full max-w-lg flex flex-col gap-2 pb-10">
          <div
            v-for="(rec, i) in sessionRecords"
            :key="rec.entryId"
            class="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl"
          >
            <span class="text-[11px] text-gray-300 dark:text-gray-600 w-5 tabular-nums">{{ i + 1 }}</span>
            <span
              class="w-2.5 h-2.5 rounded-full flex-shrink-0"
              :style="{ backgroundColor: rec.quality < qualityColors.length ? qualityColors[rec.quality] : '#9ca3af' }"
            />
            <div class="flex-1 min-w-0">
              <div class="text-[13px] text-gray-800 dark:text-gray-200 truncate" v-html="entryById(rec.entryId)?.question || '(无题目)'" />
              <div class="flex items-center gap-2 mt-0.5">
                <span class="text-[10px] text-gray-400 dark:text-gray-500">{{ entryById(rec.entryId)?.subject || '' }}</span>
                <span
                  v-if="masteryBucket(entryById(rec.entryId))"
                  class="text-[10px] px-1.5 py-px rounded-full text-white"
                  :style="{ backgroundColor: masteryBucket(entryById(rec.entryId))!.color }"
                >{{ masteryBucket(entryById(rec.entryId))!.label }}</span>
              </div>
            </div>
            <span class="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums flex-shrink-0">{{ formatTime(rec.elapsedMs) }}</span>
            <span
              class="text-[11px] font-medium flex-shrink-0 w-8 text-right"
              :style="{ color: rec.quality < qualityColors.length ? qualityColors[rec.quality] : '#9ca3af' }"
            >{{ rec.quality < qualityLabels.length ? qualityLabels[rec.quality] : rec.quality }}</span>
          </div>
        </div>

        <button
          class="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:brightness-110 transition-all active:scale-95 mb-10"
          @click="emit('dismissSummary')"
        >
          返回编辑
        </button>
      </div>
    </template>

    <!-- Review card -->
    <template v-else-if="entry">
      <!-- Progress bar + timer -->
      <div class="flex items-center gap-3 px-1 flex-shrink-0">
        <div class="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            class="h-full bg-accent rounded-full transition-all duration-300"
            :style="{ width: progressPercent + '%' }"
          />
        </div>
        <span class="text-xs tabular-nums font-medium min-w-[60px] text-right"
          :class="answered ? 'text-gray-400 dark:text-gray-500' : 'text-accent'">
          {{ formatTime(elapsedMs) }}
        </span>
        <span class="text-xs text-gray-400 dark:text-gray-500 font-medium tabular-nums">{{ progress }}</span>
        <span class="text-[10px] text-gray-300 dark:text-gray-600 tabular-nums">今日已复习 {{ reviewedToday }}</span>
      </div>

      <!-- Question -->
      <div
        ref="questionPanelEl"
        class="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm flex flex-col overflow-hidden"
        style="flex: 2 1 0%; min-height: 80px"
      >
        <div class="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800 bg-[#fafbfc] dark:bg-gray-800 flex-shrink-0">
          <span class="w-2 h-2 rounded-full bg-accent" />
          题目
          <span v-if="entry.subject" class="ml-auto text-[10px] text-gray-300 dark:text-gray-600">{{ entry.subject }}</span>
        </div>
        <div class="flex-1 overflow-y-auto">
          <div ref="questionContentRef" style="position: relative; min-height: 100%;">
            <div class="px-3.5 py-3 text-sm leading-relaxed md-content" v-html="entry.question || '<span class=\'text-gray-300\'>无题目内容</span>'" />
          </div>
        </div>
      </div>

      <!-- Resize handle: question <-> answers -->
      <div
        ref="resizeH"
        class="resize-h flex-shrink-0 h-2 cursor-row-resize bg-transparent hover:bg-accent/20 transition-colors relative -my-0.5 rounded"
        @mousedown="startResize($event)"
      >
        <span class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-0.5 rounded-sm bg-gray-200 dark:bg-gray-600 resize-h-bar" />
      </div>

      <!-- Wrong answer: expanded by default, clickable header when collapsed -->
      <div
        class="flex flex-col overflow-hidden rounded-lg border transition-all duration-300"
        :class="!showCorrect
          ? 'flex-1 min-h-0 bg-red-50 border-red-100 dark:bg-red-500/10 dark:border-red-500/20'
          : 'flex-shrink-0 bg-red-50/30 dark:bg-red-500/5 border-red-100/50 dark:border-red-500/10 cursor-pointer hover:brightness-[0.97]'"
        @click="showCorrect ? showWrong() : undefined"
      >
        <div class="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-600 dark:text-red-400 border-b border-red-100 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 flex-shrink-0">
          <span class="w-2 h-2 rounded-full bg-red-400" />
          错误答案
          <span v-if="showCorrect" class="ml-auto text-[10px] text-red-500 dark:text-red-400">点击查看</span>
        </div>
        <div v-if="!showCorrect" class="flex-1 overflow-y-auto px-3.5 py-3 text-sm leading-relaxed md-content text-gray-800 dark:text-gray-200" v-html="entry.wrongAnswer || '<span class=\'text-gray-300 dark:text-gray-600\'>无内容</span>'" />
        <div v-else class="flex items-center justify-center py-4">
          <span class="text-sm font-medium text-red-500 dark:text-red-400">点击显示错误答案</span>
        </div>
      </div>

      <!-- Correct answer: collapsed by default, clickable header when collapsed -->
      <div
        class="flex flex-col overflow-hidden rounded-lg border transition-all duration-300"
        :class="showCorrect
          ? 'flex-1 min-h-0 bg-emerald-50 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20'
          : 'flex-shrink-0 bg-emerald-50 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20 cursor-pointer hover:brightness-[0.97]'"
        @click="!showCorrect ? reveal() : undefined"
      >
        <div class="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border-b border-emerald-100 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 flex-shrink-0">
          <span class="w-2 h-2 rounded-full bg-emerald-400" />
          正确答案
          <span v-if="!showCorrect" class="ml-auto text-[10px] text-emerald-500 dark:text-emerald-400">点击查看</span>
        </div>
        <div
          v-if="showCorrect"
          class="flex-1 overflow-y-auto px-3.5 py-3 text-sm leading-relaxed md-content text-gray-800 dark:text-gray-200"
          v-html="entry.correctAnswer || '<span class=\'text-gray-300 dark:text-gray-600\'>无内容</span>'"
        />
        <div v-else class="flex items-center justify-center py-4">
          <span class="text-sm font-medium text-emerald-500 dark:text-emerald-400">点击显示正确答案</span>
        </div>
      </div>

      <!-- Review note -->
      <div v-if="answered && !rated" class="flex-shrink-0 flex flex-col gap-1.5">
        <label class="text-[11px] font-semibold text-gray-400 dark:text-gray-500">复习批注</label>
        <textarea
          v-model="note"
          class="w-full h-20 resize-none rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600"
          placeholder="记录这次复习的收获或思路…"
        />
      </div>

      <!-- Rating buttons -->
      <div v-if="answered && !rated" class="flex-shrink-0 flex gap-2">
        <button
          v-for="r in ratings"
          :key="r.q"
          class="flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-lg text-white text-xs font-medium transition-all hover:brightness-110 active:scale-[0.97]"
          :class="r.color"
          :title="r.desc"
          @click="rated = true; emit('rate', r.q, note)"
        >
          <span class="text-sm font-bold">{{ r.q }}</span>
          <span>{{ r.label }}</span>
        </button>
      </div>

      <!-- Exit review -->
      <button
        class="flex-shrink-0 self-center px-3 py-1.5 rounded-md border border-gray-100 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 ease-out active:scale-95"
        @click="emit('exitReview')"
      >
        退出复习
      </button>
    </template>
    <div v-else class="flex-1 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">暂无复习卡片</div>
  </div>
</template>

<style scoped>
.resize-h-bar { background: #e5e7eb; }
.dark .resize-h-bar { background: #4b5563; }
.resize-h:hover .resize-h-bar,
.resize-h.dragging .resize-h-bar { background: #6366f1; }
.dark .resize-h:hover .resize-h-bar,
.dark .resize-h.dragging .resize-h-bar { background: #818cf8; }
</style>
