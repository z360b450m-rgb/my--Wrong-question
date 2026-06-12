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
  rateCard?: (quality: number) => Promise<void>
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
      // 1-5 to rate
      if (!e.ctrlKey && !e.metaKey && actions.answered?.value) {
        const ratings: Record<string, number> = { '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5 }
        if (e.key in ratings) {
          e.preventDefault()
          // Map: key 1→quality 0, key 6→quality 5
          if (e.key === '1') actions.rateCard?.(0)
          else if (e.key === '2') actions.rateCard?.(1)
          else if (e.key === '3') actions.rateCard?.(2)
          else if (e.key === '4') actions.rateCard?.(3)
          else if (e.key === '5') actions.rateCard?.(4)
          else if (e.key === '6') actions.rateCard?.(5)
        }
      }
    }
  }

  onMounted(() => document.addEventListener('keydown', handler))
  onUnmounted(() => document.removeEventListener('keydown', handler))
}
