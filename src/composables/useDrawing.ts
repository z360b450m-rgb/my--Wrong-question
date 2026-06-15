import { ref, onUnmounted, type Ref } from 'vue';

export type DrawTool = 'pen' | 'eraser';

export const PEN_COLORS = [
  { code: '#ef4444', name: '红' },
  { code: '#f97316', name: '橙' },
  { code: '#eab308', name: '黄' },
  { code: '#22c55e', name: '绿' },
  { code: '#3b82f6', name: '蓝' },
  { code: '#a855f7', name: '紫' },
];

export interface DrawingState {
  drawingEnabled: Ref<boolean>;
  activeTool: Ref<DrawTool>;
  penColor: Ref<string>;
  canUndo: Ref<boolean>;
  canRedo: Ref<boolean>;
  toggleDrawing: () => void;
  setTool: (t: DrawTool) => void;
  setColor: (c: string) => void;
  clearCanvas: () => void;
  undo: () => void;
  redo: () => void;
  resizeCanvas: () => void;
  loadDrawing: (entryId: string) => void;
  mountCanvas: (container: HTMLElement) => void;
  setCanvasParent: (el: HTMLElement | null) => void;
  captureDrawing: () => string | null;
  setStoredDrawing: (entryId: string, dataUrl: string) => void;
}

// ===================================================================
// @AI-GUIDE: 画笔批注引擎 (Canvas 操作层)
// 例外模块 —— 本 composable 是唯一允许直接操作 Canvas DOM 的业务模块。
// 画笔/橡皮/撤销重做/颜色管理等绘图状态均在此管理。
// 绘图数据通过 memory Map 缓存, 保存时写入 entry.drawing 字段。
// DrawingState 返回值类型必须向后兼容。
// ===================================================================
export function useDrawing(): DrawingState {
  const drawingEnabled = ref(false);
  const activeTool = ref<DrawTool>('pen');
  const penColor = ref(PEN_COLORS[0].code);

  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let drawing = false;
  let lastPos = { x: 0, y: 0 };
  let ro: ResizeObserver | null = null;

  // Per-entry drawing store
  const drawingStore = new Map<string, string>();
  let currentEntryId: string | null = null;

  // Undo/redo history
  const undoStack: string[] = [];
  const redoStack: string[] = [];
  const MAX_HISTORY = 50;
  const canUndo = ref(false);
  const canRedo = ref(false);

  function updateHistoryFlags() {
    canUndo.value = undoStack.length > 0;
    canRedo.value = redoStack.length > 0;
  }

  function saveSnapshot() {
    if (!canvas) return;
    undoStack.push(canvas.toDataURL());
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack.length = 0;
    updateHistoryFlags();
  }

  function restoreSnapshot(dataUrl: string): Promise<void> {
    return new Promise((resolve) => {
      if (!canvas || !ctx) {
        resolve();
        return;
      }
      const img = new Image();
      img.onload = () => {
        ctx!.save();
        ctx!.setTransform(1, 0, 0, 1, 0, 0);
        ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
        ctx!.drawImage(img, 0, 0);
        ctx!.restore();
        resolve();
      };
      img.onerror = () => resolve();
      img.src = dataUrl;
    });
  }

  async function undo() {
    if (undoStack.length === 0) return;
    redoStack.push(canvas!.toDataURL());
    const prev = undoStack.pop()!;
    await restoreSnapshot(prev);
    updateHistoryFlags();
  }

  async function redo() {
    if (redoStack.length === 0) return;
    undoStack.push(canvas!.toDataURL());
    const next = redoStack.pop()!;
    await restoreSnapshot(next);
    updateHistoryFlags();
  }

  function resize() {
    if (!canvas || !ctx) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const dpr = window.devicePixelRatio || 1;
    // Use scroll dimensions to cover full content area (supports scrolling)
    const w = parent.scrollWidth || parent.clientWidth;
    const h = parent.scrollHeight || parent.clientHeight;
    if (w === 0 || h === 0) return;
    const physicalWidth = w * dpr;
    const physicalHeight = h * dpr;
    if (canvas.width !== physicalWidth || canvas.height !== physicalHeight) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) tempCtx.drawImage(canvas, 0, 0);

      canvas.width = physicalWidth;
      canvas.height = physicalHeight;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(tempCanvas, 0, 0);
      ctx.restore();
    }
  }

  function getPos(e: MouseEvent | Touch): { x: number; y: number } {
    if (!canvas) return { x: 0, y: 0 };
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onStart(e: MouseEvent | Touch) {
    if (!ctx) return;
    saveSnapshot();
    drawing = true;
    const { x, y } = getPos(e);
    lastPos = { x, y };
    ctx.beginPath();
    ctx.moveTo(x, y);

    if (activeTool.value === 'pen') {
      ctx.strokeStyle = penColor.value;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 1;
      ctx.shadowColor = penColor.value;
    } else {
      ctx.lineWidth = 24;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'destination-out';
      ctx.shadowBlur = 0;
    }
  }

  function onMove(e: MouseEvent | Touch) {
    if (!drawing || !ctx) return;
    const { x, y } = getPos(e);
    const midX = lastPos.x + (x - lastPos.x) / 2;
    const midY = lastPos.y + (y - lastPos.y) / 2;
    ctx.quadraticCurveTo(lastPos.x, lastPos.y, midX, midY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(midX, midY);
    lastPos = { x, y };
  }

  function onEnd() {
    if (!drawing) return;
    drawing = false;
    if (ctx) ctx.closePath();
  }

  function onMouseDown(e: MouseEvent) {
    e.preventDefault();
    onStart(e);
  }
  function onMouseMove(e: MouseEvent) {
    onMove(e);
  }
  function onMouseUp() {
    onEnd();
  }
  function onTouchStart(e: TouchEvent) {
    if (e.touches.length === 1) {
      e.preventDefault();
      onStart(e.touches[0]);
    }
  }
  function onTouchMove(e: TouchEvent) {
    if (e.touches.length === 1) {
      e.preventDefault();
      onMove(e.touches[0]);
    }
  }
  function onTouchEnd() {
    onEnd();
  }

  function mountCanvas(container: HTMLElement) {
    // Save current canvas content before teardown
    let savedImage: HTMLCanvasElement | null = null;
    if (canvas && canvas.width > 0 && canvas.height > 0) {
      savedImage = document.createElement('canvas');
      savedImage.width = canvas.width;
      savedImage.height = canvas.height;
      const savedCtx = savedImage.getContext('2d');
      if (savedCtx) savedCtx.drawImage(canvas, 0, 0);
    }

    // Clean up old canvas
    if (canvas && canvas.parentElement) {
      canvas.parentElement.removeChild(canvas);
      window.removeEventListener('resize', resize);
      if (ro) ro.disconnect();
    }

    canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = drawingEnabled.value ? 'auto' : 'none';
    canvas.style.zIndex = '10';
    ctx = canvas.getContext('2d');

    container.classList.add('relative');
    container.appendChild(canvas);

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);

    resize();
    window.addEventListener('resize', resize);

    ro = new ResizeObserver(() => resize());
    ro.observe(container);

    // Restore saved content onto the new canvas
    if (savedImage && savedImage.width > 0 && savedImage.height > 0 && ctx) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(savedImage, 0, 0);
      ctx.restore();
    }
  }

  function setCanvasParent(el: HTMLElement | null) {
    if (!canvas || !el) return;
    const computed = getComputedStyle(el);
    if (computed.position === 'static') {
      el.style.position = 'relative';
    }
    el.appendChild(canvas);
    resize();
  }

  function loadDrawing(entryId: string) {
    if (!canvas) return;
    if (currentEntryId === entryId) return;

    // Save current drawing for the entry we're leaving
    if (currentEntryId) {
      drawingStore.set(currentEntryId, canvas.toDataURL());
    }

    currentEntryId = entryId;

    // Reset undo/redo for the new entry
    undoStack.length = 0;
    redoStack.length = 0;
    updateHistoryFlags();

    // Restore saved drawing or start blank — clear synchronously first to avoid
    // flashing the previous entry's drawing before the async image load completes.
    if (ctx) {
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    }
    if (drawingStore.has(entryId)) {
      restoreSnapshot(drawingStore.get(entryId)!);
    }
  }

  function resizeCanvas() {
    resize();
  }

  function clearCanvas() {
    if (!canvas || !ctx) return;
    saveSnapshot();
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  }

  function captureDrawing(): string | null {
    if (!canvas || canvas.width === 0 || canvas.height === 0) return null;
    return canvas.toDataURL();
  }

  function setStoredDrawing(entryId: string, dataUrl: string) {
    drawingStore.set(entryId, dataUrl);
  }

  function toggleDrawing() {
    drawingEnabled.value = !drawingEnabled.value;
    if (!drawingEnabled.value && canvas) {
      canvas.style.pointerEvents = 'none';
    } else if (drawingEnabled.value && canvas) {
      canvas.style.pointerEvents = 'auto';
      resize();
    }
    // Reset to pen on open
    if (drawingEnabled.value) {
      activeTool.value = 'pen';
    }
  }

  function setTool(t: DrawTool) {
    activeTool.value = t;
  }
  function setColor(c: string) {
    penColor.value = c;
    activeTool.value = 'pen';
  }

  onUnmounted(() => {
    window.removeEventListener('resize', resize);
    if (canvas) {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    }
  });

  return {
    drawingEnabled,
    activeTool,
    penColor,
    canUndo,
    canRedo,
    toggleDrawing,
    setTool,
    setColor,
    clearCanvas,
    undo,
    redo,
    resizeCanvas,
    loadDrawing,
    mountCanvas,
    setCanvasParent,
    captureDrawing,
    setStoredDrawing,
  };
}
