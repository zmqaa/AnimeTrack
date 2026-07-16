"use client";

import { useEffect, useRef, useState } from 'react';

export function useElementSize<T extends HTMLElement>(initialWidth = 600) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(initialWidth);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const updateWidth = (nextWidth: number) => {
      if (nextWidth > 0) setWidth(nextWidth);
    };
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) updateWidth(entry.contentRect.width);
    });

    observer.observe(element);
    updateWidth(element.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

export function useActiveChartItem<T>(items: T[]) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeItem = activeIndex === null ? null : items[activeIndex] ?? null;

  return {
    activeIndex,
    activeItem,
    activate: setActiveIndex,
    clear: () => setActiveIndex(null),
  };
}
