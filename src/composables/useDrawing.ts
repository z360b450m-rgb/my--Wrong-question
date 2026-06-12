import { ref, onUnmounted, nextTick, type Ref } from 'vue'

export type DrawTool = 'pen' | 'eraser'

export const PEN_COLORS = [
  { code: '#ef4444', name: '红' },
  { code: '#f97316', name: '橙' },
  { code: '#eab308', name: '黄' },
  { code: '#22c55e', name: '绿' },
  { code: '#3b82f6', name: '蓝' },
  { code: '#a855f7', name: '紫' },
]

export interface DrawingState {
  drawingEnabled: Ref<boolean>
  activeTool: Ref<DrawTool>
  penColor: Ref<string>
  toggleDrawing: () => void
  setTool: (t: DrawTool) => void
  setColor: (c: string) => void
  clearCanvas: () => void
  mountCanvas: (container: HTMLElement) => void
}

export function useDrawing(): DrawingState {
  const drawingEnabled = ref(false)
  const activeTool = ref<DrawTool>('pen')
  const penColor = ref(PEN_COLORS[0].code)

  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let drawing = false

  function resize() {
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return
    const r = parent.getBoundingClientRect()
    if (canvas.width !== r.width || canvas.height !== r.height) {
      canvas.width = r.width
      canvas.height = r.height
    }
  }

  function getPos(e: MouseEvent | Touch): { x: number; y: number } {
    if (!canvas) return { x: 0, y: 0 }
    const r = canvas.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function onStart(e: MouseEvent | Touch) {
    if (!ctx) return
    drawing = true
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)

    if (activeTool.value === 'pen') {
      ctx.strokeStyle = penColor.value
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.globalCompositeOperation = 'source-over'
    } else {
      ctx.lineWidth = 24
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.globalCompositeOperation = 'destination-out'
    }
  }

  function onMove(e: MouseEvent | Touch) {
    if (!drawing || !ctx) return
    const { x, y } = getPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function onEnd() {
    if (!drawing) return
    drawing = false
    if (ctx) ctx.closePath()
  }

  function onMouseDown(e: MouseEvent) { e.preventDefault(); onStart(e) }
  function onMouseMove(e: MouseEvent) { onMove(e) }
  function onMouseUp() { onEnd() }
  function onTouchStart(e: TouchEvent) {
    if (e.touches.length === 1) {
      e.preventDefault()
      onStart(e.touches[0])
    }
  }
  function onTouchMove(e: TouchEvent) {
    if (e.touches.length === 1) {
      e.preventDefault()
      onMove(e.touches[0])
    }
  }
  function onTouchEnd() { onEnd() }

  function mountCanvas(container: HTMLElement) {
    canvas = document.createElement('canvas')
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '10'
    ctx = canvas.getContext('2d')

    container.style.position = 'relative'
    container.appendChild(canvas)

    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('mouseleave', onMouseUp)
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd)

    resize()
    window.addEventListener('resize', resize)

    // Observe container size changes
    const ro = new ResizeObserver(() => resize())
    ro.observe(container)
  }

  function clearCanvas() {
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  function toggleDrawing() {
    drawingEnabled.value = !drawingEnabled.value
    if (!drawingEnabled.value && canvas) {
      canvas.style.pointerEvents = 'none'
    } else if (drawingEnabled.value && canvas) {
      canvas.style.pointerEvents = 'auto'
      resize()
    }
    // Reset to pen on open
    if (drawingEnabled.value) {
      activeTool.value = 'pen'
    }
  }

  function setTool(t: DrawTool) { activeTool.value = t }
  function setColor(c: string) {
    penColor.value = c
    activeTool.value = 'pen'
  }

  onUnmounted(() => {
    window.removeEventListener('resize', resize)
    if (canvas) {
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('mouseleave', onMouseUp)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
    }
  })

  return {
    drawingEnabled,
    activeTool,
    penColor,
    toggleDrawing,
    setTool,
    setColor,
    clearCanvas,
    mountCanvas,
  }
}
