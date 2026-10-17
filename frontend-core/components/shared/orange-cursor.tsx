'use client';

import { useEffect, useRef } from 'react';

const interactiveSelector = 'button, a, input, textarea, select, [role="button"]';

export function OrangeCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const finePointer = window.matchMedia('(pointer: fine)');
    if (!finePointer.matches) return;

    const cursor = cursorRef.current;
    if (!cursor) return;

    document.documentElement.classList.add('custom-cursor-active');

    const handlePointerMove = (event: PointerEvent) => {
      cursor.style.opacity = '1';
      cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate(-50%, -50%)`;
      const target = event.target;
      const isInteractive = target instanceof Element && Boolean(target.closest(interactiveSelector));
      cursor.classList.toggle('is-hovering', isInteractive);
    };

    const handlePointerLeave = () => {
      cursor.style.opacity = '0';
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.documentElement.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.documentElement.removeEventListener('pointerleave', handlePointerLeave);
      document.documentElement.classList.remove('custom-cursor-active');
    };
  }, []);

  return <div ref={cursorRef} className="orange-cursor" aria-hidden="true" />;
}
