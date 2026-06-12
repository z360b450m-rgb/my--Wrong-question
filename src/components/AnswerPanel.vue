<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'

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

const isWrong = props.type === 'wrong'
const label = isWrong ? '错误答案' : '正确答案'
const dotClass = isWrong ? 'bg-red-400' : 'bg-emerald-400'

const panelBg = isWrong
  ? 'bg-red-50 border-red-100 dark:bg-red-500/10 dark:border-red-500/20'
  : 'bg-emerald-50 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20'
const panelBorder = ''
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

// Set initial content when entry changes, without v-html interference
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
        bodyRef.value?.focus()
        onInput()
      }
      reader.readAsDataURL(blob)
      break
    }
  }
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

    <div
      v-if="!showHidden"
      ref="bodyRef"
      class="panel-body flex-1 px-3.5 py-3 overflow-y-auto text-sm leading-relaxed md-content outline-none text-gray-800 dark:text-gray-200"
      contenteditable="true"
      :data-placeholder="'输入' + label + '…'"
      @input="onInput"
      @paste="onPaste"
      @blur="emit('blur')"
    />

    <div
      v-else
      class="flex-1 flex items-center justify-center cursor-pointer select-none rounded-b-lg transition-all duration-200 ease-out active:scale-[0.98]"
      :class="[hiddenBg, hiddenColor]"
      @click="emit('reveal')"
    >
      <span class="text-sm font-medium">点击显示{{ label }}</span>
    </div>
  </div>
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
