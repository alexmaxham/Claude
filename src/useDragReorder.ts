import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';

interface Drag {
  id: string;
  from: number;
  over: number;
  dy: number;
  height: number;
  category: string | null;
}

/**
 * Pointer-based drag and drop for a vertical list (works with mouse and touch).
 * Dropping on another row reorders; dropping on an element with
 * `data-drop-category` hands the item to `onDropCategory` instead.
 */
export function useDragReorder(
  ids: string[],
  onReorder: (ids: string[]) => void,
  onDropCategory: (id: string, categoryId: string) => void,
) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const mids = useRef<number[]>([]);

  const start = (e: PointerEvent<HTMLElement>, id: string) => {
    if (e.button !== 0) return;
    const from = ids.indexOf(id);
    const rows = ids.map((x) => document.querySelector<HTMLElement>(`[data-task-id="${CSS.escape(x)}"]`));
    if (from < 0 || rows.some((r) => !r)) return;
    e.preventDefault();
    const rects = rows.map((r) => r!.getBoundingClientRect());
    mids.current = rects.map((r) => r.top + r.height / 2);
    const gap = rects.length > 1 ? rects[1].top - rects[0].bottom : 8;
    const startY = e.clientY;
    let current: Drag = { id, from, over: from, dy: 0, height: rects[from].height + gap, category: null };
    setDrag(current);

    const move = (ev: globalThis.PointerEvent) => {
      const dy = ev.clientY - startY;
      const center = mids.current[from] + dy;
      let over = from;
      while (over < ids.length - 1 && center > mids.current[over + 1]) over++;
      while (over > 0 && center < mids.current[over - 1]) over--;
      const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-drop-category]');
      current = { ...current, dy, over, category: target?.dataset.dropCategory ?? null };
      setDrag(current);
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', cancel);
      setDrag(null);
      if (current.category) onDropCategory(current.id, current.category);
      else if (current.over !== current.from) {
        const next = ids.filter((x) => x !== current.id);
        next.splice(current.over, 0, current.id);
        onReorder(next);
      }
    };
    const cancel = () => {
      current = { ...current, over: current.from, category: null };
      end();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', cancel);
  };

  /** Transform for each row: the dragged one follows the pointer, the others make room. */
  const styleFor = (id: string): CSSProperties | undefined => {
    if (!drag) return undefined;
    const i = ids.indexOf(id);
    if (id === drag.id) return { transform: `translateY(${drag.dy}px) scale(${drag.category ? 0.92 : 1.02})` };
    if (drag.category) return undefined;
    if (drag.from < i && i <= drag.over) return { transform: `translateY(${-drag.height}px)` };
    if (drag.over <= i && i < drag.from) return { transform: `translateY(${drag.height}px)` };
    return { transform: 'translateY(0)' };
  };

  return { start, styleFor, draggingId: drag?.id ?? null, overCategory: drag?.category ?? null };
}
