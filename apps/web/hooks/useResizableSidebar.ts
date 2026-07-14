'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type ResizableSidebarOptions = {
  /** localStorage key prefix. Width and collapsed state are stored under it. */
  storageKey: string;
  defaultWidth: number;
  min: number;
  max: number;
  /** Drag narrower than this and the panel collapses. */
  snap: number;
  /** Rendered width while collapsed. 0 hides the panel entirely. */
  collapsedWidth: number;
};

/**
 * Shared drag-to-resize + collapse behaviour for the app's left panels
 * (dashboard nav, chat conversations, briefing). Keeping one implementation
 * means the snap threshold, persistence, and drag feel stay identical across
 * all three rather than drifting apart.
 */
export function useResizableSidebar({
  storageKey,
  defaultWidth,
  min,
  max,
  snap,
  collapsedWidth,
}: ResizableSidebarOptions) {
  const [width, setWidth] = useState(defaultWidth);
  const [collapsed, setCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);

  const startX = useRef(0);
  const startWidth = useRef(defaultWidth);
  const currentWidth = useRef(defaultWidth);
  const collapsedRef = useRef(false);

  const widthKey = `${storageKey}-width`;
  const collapsedKey = `${storageKey}-collapsed`;

  useEffect(() => {
    const savedWidth = localStorage.getItem(widthKey);
    if (savedWidth) {
      const w = Number(savedWidth);
      if (w >= min && w <= max) {
        setWidth(w);
        currentWidth.current = w;
      }
    }
    if (localStorage.getItem(collapsedKey) === '1') {
      setCollapsed(true);
      collapsedRef.current = true;
    }
  }, [widthKey, collapsedKey, min, max]);

  const toggle = useCallback(() => {
    setCollapsed(c => {
      const next = !c;
      collapsedRef.current = next;
      localStorage.setItem(collapsedKey, next ? '1' : '0');
      return next;
    });
  }, [collapsedKey]);

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startX.current = e.clientX;
    // Measure from the rail's real edge so dragging right re-expands it.
    startWidth.current = collapsedRef.current ? collapsedWidth : currentWidth.current;
    setDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function onMove(ev: MouseEvent) {
      const raw = startWidth.current + ev.clientX - startX.current;
      if (raw < snap) {
        if (!collapsedRef.current) {
          collapsedRef.current = true;
          setCollapsed(true);
        }
        return;
      }
      if (collapsedRef.current) {
        collapsedRef.current = false;
        setCollapsed(false);
      }
      const w = Math.min(max, Math.max(min, raw));
      currentWidth.current = w;
      setWidth(w);
    }

    function onUp() {
      setDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem(widthKey, String(currentWidth.current));
      localStorage.setItem(collapsedKey, collapsedRef.current ? '1' : '0');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [collapsedWidth, snap, min, max, widthKey, collapsedKey]);

  return {
    width: collapsed ? collapsedWidth : width,
    collapsed,
    dragging,
    toggle,
    startDrag,
  };
}
