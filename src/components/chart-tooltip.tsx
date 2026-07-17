"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Tooltip für die Charts — bewusst per Portal an den Body.
 *
 * Recharts positioniert seinen Tooltip über ein transform auf einem Wrapper.
 * Ein transform erzeugt einen Backdrop Root, und backdrop-filter weichzeichnet
 * nur, was INNERHALB dieses Roots hinter dem Element liegt — im Wrapper steckt
 * aber nichts außer dem Tooltip selbst. Dort ist Blur deshalb prinzipiell
 * wirkungslos, egal wie das CSS aussieht.
 *
 * Am Body hängend hat der Tooltip die ganze Seite hinter sich und der Blur
 * greift. Positioniert wird am Cursor, weil die Koordinaten von Recharts sich
 * auf den Chart-Container beziehen, nicht auf den Viewport.
 */
/**
 * Letzte bekannte Mausposition, dauerhaft mitgeschrieben.
 *
 * Ein Listener, der erst beim Aktivieren startet, kennt die Position noch
 * nicht — der Tooltip erschiene dann erst bei der nächsten Mausbewegung und
 * bliebe beim Stehenbleiben ganz aus. Deshalb läuft die Aufzeichnung immer,
 * und der Tooltip weiß schon beim ersten Rendern, wohin er gehört.
 */
let lastMouse: { x: number; y: number } | null = null;
if (typeof window !== "undefined") {
  window.addEventListener(
    "mousemove",
    (e) => { lastMouse = { x: e.clientX, y: e.clientY }; },
    { passive: true }
  );
}

export function ChartTooltip({
  active,
  children,
  width = 220,
  height = 110,
}: {
  active?: boolean;
  children: React.ReactNode;
  width?: number;
  height?: number;
}) {
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!active) return;
    setCursor(lastMouse);
    const onMove = (e: MouseEvent) => setCursor({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [active]);

  if (!mounted || !active || !cursor) return null;

  // An den Rändern spiegeln statt überlaufen zu lassen
  const OFFSET = 16;
  const flipX = cursor.x + OFFSET + width > window.innerWidth;
  const flipY = cursor.y + OFFSET + height > window.innerHeight;

  return createPortal(
    <div
      className="glass-float pointer-events-none fixed z-[100] rounded-xl px-4 py-3 text-xs"
      style={{
        left: flipX ? cursor.x - width - OFFSET : cursor.x + OFFSET,
        top: flipY ? Math.max(8, cursor.y - height - OFFSET) : cursor.y + OFFSET,
        minWidth: width,
      }}
    >
      {children}
    </div>,
    document.body
  );
}
