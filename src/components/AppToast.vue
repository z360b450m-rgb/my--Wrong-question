<script setup lang="ts">
import { watch, ref } from 'vue'

const props = defineProps<{ message: string }>()
const visible = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.message,
  (msg) => {
    if (!msg) return
    visible.value = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      visible.value = false
    }, 1600)
  },
)
</script>

<template>
  <Transition name="toast">
    <div
      v-if="visible"
      class="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm z-[1000] pointer-events-none whitespace-nowrap"
    >
      {{ message }}
    </div>
  </Transition>
</template>

<style scoped>
.toast-enter-active { animation: toast-in 0.3s ease; }
.toast-leave-active { animation: toast-in 0.3s ease reverse; }
@keyframes toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(10px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
</style>
