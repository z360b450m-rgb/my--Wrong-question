<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import CameraCapture from './CameraCapture.vue'

const props = defineProps<{
  type: 'wrong' | 'correct'
  hidden: boolean
  modelValue: string
  entryId: string
}>()

const emit = defineEmits<{
  'update:modelValue': [html: string]
  reveal: []
  blur: []
}>()

const bodyRef = ref<HTMLDivElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const camOpen = ref(false)
const wrapperRef = ref<HTMLDivElement | null>(null)

const isWrong = props.type === 'wrong'
const label = isWrong ? '错误答案' : '正确答案'
const dotClass = isWrong ? 'bg-red-400' : 'bg-emerald-400'

const panelBg = isWrong
  ? 'bg-red-50 border-red-100 dark:bg-red-500/10 dark:border-red-500/20'
  : 'bg-emerald-50 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20'
const headerBg = isWrong
  ? 'bg-red-50 dark:bg-red-500/10'
  : 'bg-emerald-50 dark:bg-emerald-500/10'
const headerBorder = isWrong
  ? 'border-red-100 dark:border-red-500/20'
  : 'border-emerald-100 dark:border-emerald-500/20'
const headerText = isWrong
  ? 'text-red-600 dark:text-red-400'
  : 'text-emerald-600 dark:text-emerald-400'
const hiddenBg = isWrong
  ? 'bg-red-50 dark:bg-red-500/10'
  : 'bg-emerald-50 dark:bg-emerald-500/10'
const hiddenColor = isWrong ? 'text-red-500 dark:text-red-400' : 'text-emerald-500 dark:text-emerald-400'

let suppressInput = false

const showHidden = computed(() => props.type === 'correct' && props.hidden)

watch(
  () => props.entryId,
  () => {
    nextTick(() => {
      if (bodyRef.value) {
        suppressInput = true
        bodyRef.value.innerHTML = props.modelValue
        suppressInput = false
      }
    })
  },
  { immediate: true },
)

function onInput() {
  if (suppressInput) return
  if (bodyRef.value) {
    emit('update:modelValue', bodyRef.value.innerHTML)
  }
}

function insertImageAtCursor(src: string) {
  const el = bodyRef.value
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
    const br = document.createElement('br')
    el.appendChild(br)
  }
  onInput()
}

function onPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const blob = item.getAsFile()
      if (!blob) continue
      const reader = new FileReader()
      reader.onload = () => {
        insertImageAtCursor(reader.result as string)
      }
      reader.readAsDataURL(blob)
      break
    }
  }
}

function onDragOver(e: DragEvent) {
  if (e.dataTransfer?.types.includes('Files')) {
    e.preventDefault()
  }
}

function onDrop(e: DragEvent) {
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return
  e.preventDefault()
  for (const file of files) {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => {
        insertImageAtCursor(reader.result as string)
      }
      reader.readAsDataURL(file)
      break
    }
  }
}

function openFilePicker() {
  fileInput.value?.click()
}

function onFileChange() {
  const file = fileInput.value?.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    insertImageAtCursor(reader.result as string)
  }
  reader.readAsDataURL(file)
  fileInput.value!.value = ''
}

function onCameraCapture(dataUrl: string) {
  camOpen.value = false
  insertImageAtCursor(dataUrl)
}
</script>

<template>
  <div
    class="answer-panel flex-1 flex flex-col overflow-hidden rounded-lg border"
    :class="panelBg"
  >
    <div
      class="panel-label flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b flex-shrink-0"
      :class="[headerBg, headerBorder, headerText]"
    >
      <span class="w-2 h-2 rounded-full" :class="dotClass" />
      {{ label }}
    </div>

    <div v-if="!showHidden" ref="wrapperRef" class="flex-1 relative group">
      <div
        ref="bodyRef"
        class="panel-body w-full h-full px-3.5 py-3 overflow-y-auto text-sm leading-relaxed md-content outline-none text-gray-800 dark:text-gray-200"
        contenteditable="true"
        :data-placeholder="'输入' + label + '…'"
        @input="onInput"
        @paste="onPaste"
        @dragover="onDragOver"
        @drop="onDrop"
        @blur="emit('blur')"
      />

      <!-- Image tools -->
      <div class="absolute right-2 bottom-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button
          class="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-200 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-all active:scale-90"
          title="拍照"
          @click="camOpen = true"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </button>
        <button
          class="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-200 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-all active:scale-90"
          title="导入图片"
          @click="openFilePicker"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </button>
        <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFileChange" />
      </div>
    </div>

    <div
      v-else
      class="flex-1 flex items-center justify-center cursor-pointer select-none rounded-b-lg transition-all duration-200 ease-out active:scale-[0.98]"
      :class="[hiddenBg, hiddenColor]"
      @click="emit('reveal')"
    >
      <span class="text-sm font-medium">点击显示{{ label }}</span>
    </div>
  </div>

  <CameraCapture
    v-if="camOpen"
    @capture="onCameraCapture"
    @close="camOpen = false"
  />
</template>

<style scoped>
.panel-body:empty::before {
  content: attr(data-placeholder);
  color: #cbd5e1;
}
.dark .panel-body:empty::before {
  color: #4b5563;
}
</style>
