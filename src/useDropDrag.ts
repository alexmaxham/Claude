import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';

interface Drag {
  id: string;
  dx: number;
  dy: number;
  over: string | null;
}

/**
 * Pointer drag from one drop zone to another (board columns, calendar days), for
 * mouse and touch. Zones are elements with `data-drop-zone`; `onDrop` gets the
 * item, the zone's value and where it was let go.
 */
export function useDropDrag(onDrop: (id: string, zone: string, at: { x: number; y: number }) => void) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  const start = (e: PointerEvent<HTMLElement>, id: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const x0 = e.clientX;
    const y0 = e.clientY;
    let current: Drag = { id, dx: 0, dy: 0, over: null };
    setDrag(current);

    const move = (ev: globalThis.PointerEvent) => {
      const zone = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-drop-zone]');
      current = { id, dx: ev.clientX - x0, dy: ev.clientY - y0, over: zone?.dataset.dropZone ?? null };
      setDrag(current);
    };
    const finish = (ev: globalThis.PointerEvent, cancelled: boolean) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      setDrag(null);
      if (!cancelled && current.over) onDropRef.current(current.id, current.over, { x: ev.clientX, y: ev.clientY });
    };
    const up = (ev: globalThis.PointerEvent) => finish(ev, false);
    const cancel = (ev: globalThis.PointerEvent) => finish(ev, true);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  };

  const styleFor = (id: string): CSSProperties | undefined =>
    drag?.id === id ? { transform: `translate(${drag.dx}px, ${drag.dy}px) rotate(${Math.max(-4, Math.min(4, drag.dx / 40))}deg)` } : undefined;

  return { start, styleFor, draggingId: drag?.id ?? null, over: drag?.over ?? null };
}
