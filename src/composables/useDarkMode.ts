import { ref } from 'vue'

const isDark = ref(false)

export function useDarkMode() {
  function apply(val: boolean) {
    document.documentElement.classList.toggle('dark', val)
    document.body.classList.toggle('dark', val)
    localStorage.setItem('cuoti-dark', String(val))
  }

  const saved = localStorage.getItem('cuoti-dark')
  if (saved !== null) {
    isDark.value = saved === 'true'
  } else {
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  apply(isDark.value)

  function toggleDark() {
    isDark.value = !isDark.value
    apply(isDark.value)
  }

  return { isDark, toggleDark }
}
