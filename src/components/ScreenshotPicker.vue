<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const emit = defineEmits<{
  capture: [dataUrl: string]
  close: []
}>()

interface Source {
  id: string
  name: string
  thumbnail: string
  appIcon: string | null
}

const sources = ref<Source[]>([])
const loading = ref(true)
const error = ref('')
const capturing = ref<string | null>(null)
const video = ref<HTMLVideoElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)

onMounted(async () => {
  try {
    const api = window.electronAPI
    if (!api) {
      error.value = '截屏功能仅在桌面端可用'
      loading.value = false
      return
    }
    sources.value = await api.getDesktopSources()
  } catch (e) {
    error.value = '获取屏幕源失败'
  }
  loading.value = false
})

async function captureSource(source: Source) {
  capturing.value = source.id
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: source.id,
        },
      },
    } as any)

    if (!video.value) return

    video.value.srcObject = stream
    await video.value.play()

    // Wait a frame for video to render
    await new Promise((r) => setTimeout(r, 200))

    const c = canvas.value!
    const v = video.value
    c.width = v.videoWidth
    c.height = v.videoHeight
    const ctx = c.getContext('2d')!
    ctx.drawImage(v, 0, 0)
    const dataUrl = c.toDataURL('image/png')
    emit('capture', dataUrl)

    // Cleanup
    stream.getTracks().forEach((t) => t.stop())
    video.value.srcObject = null
  } catch {
    // Fallback: use thumbnail if live capture fails
    emit('capture', source.thumbnail)
  }
  capturing.value = null
}

onUnmounted(() => {
  if (video.value?.srcObject) {
    const stream = video.value.srcObject as MediaStream
    stream.getTracks().forEach((t) => t.stop())
  }
})
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="emit('close')">
    <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden w-[680px] max-w-[94vw] max-h-[90vh] flex flex-col">
      <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <h2 class="text-[15px] font-bold text-gray-800 dark:text-gray-100">选择截屏区域</h2>
        <button
          class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all active:scale-90"
          @click="emit('close')"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-4">
        <div v-if="loading" class="flex items-center justify-center py-20 text-sm text-gray-400 dark:text-gray-500">
          正在获取窗口列表…
        </div>
        <div v-else-if="error" class="flex items-center justify-center py-20 text-sm text-gray-400 dark:text-gray-500">
          {{ error }}
        </div>
        <div v-else class="grid grid-cols-3 gap-3">
          <button
            v-for="s in sources"
            :key="s.id"
            class="relative flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-accent hover:bg-accent/5 transition-all duration-200 active:scale-[0.98] overflow-hidden"
            :class="{ 'border-accent bg-accent/10': capturing === s.id }"
            @click="captureSource(s)"
          >
            <!-- Thumbnail -->
            <div class="w-full aspect-[4/3] rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0">
              <img :src="s.thumbnail" class="w-full h-full object-cover" />
            </div>
            <!-- Loading overlay -->
            <div
              v-if="capturing === s.id"
              class="absolute inset-0 bg-white/60 dark:bg-gray-900/60 rounded-xl flex items-center justify-center"
            >
              <div class="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
            <!-- Name -->
            <span class="text-[11px] text-gray-600 dark:text-gray-300 font-medium truncate w-full text-center leading-tight">
              {{ s.name }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <video ref="video" class="hidden" />
    <canvas ref="canvas" class="hidden" />
  </div>
</template>
