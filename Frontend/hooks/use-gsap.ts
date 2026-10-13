'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Animate elements into view on scroll.
 * Usage: const ref = useScrollReveal<HTMLDivElement>()
 *        <div ref={ref}> ... </div>
 */
export function useScrollReveal<T extends HTMLElement>(options?: {
  y?: number;
  opacity?: number;
  duration?: number;
  stagger?: number;
  selector?: string;
}) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const targets = options?.selector ? el.querySelectorAll(options.selector) : [el];

    const ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        {
          y: options?.y ?? 32,
          opacity: options?.opacity ?? 0,
        },
        {
          y: 0,
          opacity: 1,
          duration: options?.duration ?? 0.8,
          stagger: options?.stagger ?? 0,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 88%',
            toggleActions: 'play none none none',
          },
        }
      );
    }, el);

    return () => ctx.revert();
  }, [options?.duration, options?.opacity, options?.stagger, options?.selector, options?.y]);

  return ref;
}

/**
 * Animate a single element on mount (no scroll trigger).
 */
export function useMountReveal<T extends HTMLElement>(delay = 0) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    gsap.fromTo(
      el,
      { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.9, delay, ease: 'power3.out' }
    );
  }, [delay]);

  return ref;
}
