// =====================================================================
// useDraggable — reusable drag-by-handle hook for modals/popups
// Extracted from the proven PropertyPackModal drag logic.
// Usage:
//   const { posStyle, handleProps, resetPos } = useDraggable({ open });
//   <div style={{...panelStyle, ...posStyle}}>
//     <div {...handleProps}>  // header = drag handle
// posStyle gives position:absolute + top/left once dragged (else {} = use your default).
// handleProps spreads onMouseDown/onTouchStart + cursor:move + userSelect:none.
// Buttons inside the handle are ignored (so close/× still work).
// =====================================================================
import { useState, useRef, useCallback, useEffect } from "react";

export function useDraggable({ open, defaultPos = null } = {}) {
  const [pos, setPos] = useState(defaultPos); // {x,y} top-left, or null = caller's default
  const ref = useRef(null);

  // reset to default each time it (re)opens
  useEffect(() => { if (open) setPos(defaultPos); }, [open]);

  const onDragStart = useCallback((clientX, clientY) => {
    const node = ref.current;
    const rect = node ? node.getBoundingClientRect() : { left: clientX, top: clientY };
    const offX = clientX - rect.left;
    const offY = clientY - rect.top;
    const move = (cx, cy) => {
      const w = node ? node.offsetWidth : 480;
      let nx = cx - offX, ny = cy - offY;
      nx = Math.max(8, Math.min(nx, window.innerWidth - w - 8));
      ny = Math.max(8, Math.min(ny, window.innerHeight - 48));
      setPos({ x: nx, y: ny });
    };
    const mm = (e) => move(e.clientX, e.clientY);
    const tm = (e) => { const t = e.touches[0]; if (t) move(t.clientX, t.clientY); };
    const up = () => {
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", tm);
      window.removeEventListener("touchend", up);
    };
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", tm, { passive: false });
    window.addEventListener("touchend", up);
  }, []);

  const handleProps = {
    onMouseDown: (e) => { if (e.target.closest("button")) return; e.preventDefault(); onDragStart(e.clientX, e.clientY); },
    onTouchStart: (e) => { if (e.target.closest("button")) return; const t = e.touches[0]; if (t) onDragStart(t.clientX, t.clientY); },
    title: "Drag to move",
    style: { cursor: "move", userSelect: "none" },
  };

  const posStyle = pos ? { position: "absolute", left: pos.x, top: pos.y, margin: 0 } : {};

  return { ref, pos, setPos, posStyle, handleProps, resetPos: () => setPos(defaultPos) };
}
