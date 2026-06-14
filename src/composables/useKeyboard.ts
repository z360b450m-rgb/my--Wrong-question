import { onMounted, onUnmounted, type Ref, type ComputedRef } from 'vue'

interface KeyboardActions {
  onCreate: (subject?: string) => void
  onSave: () => void
  onToggleReveal: () => void
  onPrev: () => void
  onNext: () => void
  mode?: Ref<'edit' | 'review'>
  isReviewing?: ComputedRef<boolean>
  answered?: Ref<boolean>
  revealAnswer?: () => void
  rateCard?: (rating: number | string) => Promise<void>
  drawingEnabled?: Ref<boolean>
  onUndo?: () => void
  onRedo?: () => void
}

export function useKeyboard(actions: KeyboardActions) {
  function handler(e: KeyboardEvent) {
    const ctrl = e.ctrlKey || e.metaKey

    if (ctrl && e.key === 'n') {
      e.preventDefault()
      actions.onCreate()
      return
    }
    if (ctrl && e.key === 's') {
      e.preventDefault()
      actions.onSave()
      return
    }
    if (ctrl && e.key === 'r') {
      e.preventDefault()
      actions.onToggleReveal()
      return
    }
    if (ctrl && e.key === 'ArrowLeft') {
      const el = document.activeElement
      if (!el || !(el as HTMLElement).isContentEditable) {
        e.preventDefault()
        actions.onPrev()
      }
      return
    }
    if (ctrl && e.key === 'ArrowRight') {
      const el = document.activeElement
      if (!el || !(el as HTMLElement).isContentEditable) {
        e.preventDefault()
        actions.onNext()
      }
      return
    }

    // Drawing undo/redo
    if (actions.drawingEnabled?.value) {
      if (ctrl && e.key === 'z') {
        e.preventDefault()
        actions.onUndo?.()
        return
      }
      if (ctrl && e.key === 'y') {
        e.preventDefault()
        actions.onRedo?.()
        return
      }
    }

    // Review mode shortcuts
    if (actions.mode?.value === 'review') {
      // Space to reveal answer
      if (e.key === ' ' && !e.ctrlKey && !e.metaKey) {
        const el = document.activeElement
        if (!el || (el as HTMLElement).tagName === 'BODY' || (el as HTMLElement).tagName === 'DIV') {
          e.preventDefault()
          if (!actions.answered?.value) {
            actions.revealAnswer?.()
          }
        }
      }
      // Number keys to rate
      if (!e.ctrlKey && !e.metaKey && actions.answered?.value) {
        if (e.key === '1') { e.preventDefault(); actions.rateCard?.('forgot') }
        else if (e.key === '2') { e.preventDefault(); actions.rateCard?.('unfamiliar') }
        else if (e.key === '3') { e.preventDefault(); actions.rateCard?.('mastered') }
      }
    }
  }

  onMounted(() => document.addEventListener('keydown', handler))
  onUnmounted(() => document.removeEventListener('keydown', handler))
}
