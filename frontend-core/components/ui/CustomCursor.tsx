'use client';

import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

export function CustomCursor() {
  const [mounted, setMounted] = useState(false);
  const [isPointerDevice, setIsPointerDevice] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  // Exact coordinates for Core dot
  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);

  // Physics-based delayed spring coordinates for Trail ring (The Aura)
  const springConfig = { stiffness: 150, damping: 15, mass: 0.5 };
  const trailX = useSpring(mouseX, springConfig);
  const trailY = useSpring(mouseY, springConfig);

  useEffect(() => {
    // Only enable on client devices with fine pointer (mouse/trackpad), not touch screens
    const mediaQuery = window.matchMedia('(pointer: fine)');
    setIsPointerDevice(mediaQuery.matches);
    setMounted(true);

    if (!mediaQuery.matches) return;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      if (!isVisible) setIsVisible(true);

      const target = e.target as HTMLElement | null;
      if (!target) {
        setIsHovered(false);
        return;
      }

      const isInteractive = Boolean(
        target.closest(
          'a, button, [role="button"], input, textarea, select, label, [data-cursor="pointer"], [data-cursor="hover"]'
        )
      );
      setIsHovered(isInteractive);
    };

    const handleMouseDown = () => setIsPressed(true);
    const handleMouseUp = () => setIsPressed(false);
    const handleMouseLeave = () => setIsVisible(false);
    const handleMouseEnter = () => setIsVisible(true);

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [isVisible, mouseX, mouseY]);

  if (!mounted || !isPointerDevice) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[99999] overflow-hidden"
    >
      {/* 2. The Trail (The Aura): Spring-delayed ring */}
      <motion.div
        className="fixed top-0 left-0 rounded-full border"
        style={{
          x: trailX,
          y: trailY,
          translateX: '-50%',
          translateY: '-50%',
          width: 32,
          height: 32,
        }}
        animate={{
          scale: isHovered || isPressed ? 0 : 1,
          opacity: isVisible && !isHovered && !isPressed ? 1 : 0,
          backgroundColor: 'rgba(99, 102, 241, 0.04)',
          borderColor: '#6366F1',
          boxShadow: '0 0 10px rgba(99, 102, 241, 0.25)',
        }}
        transition={{
          scale: { duration: 0.12, ease: 'easeOut' },
          opacity: { duration: 0.1, ease: 'easeOut' },
        }}
      />

      {/* 1. The Core (Pen Nib/Dot): Solid Cyan, instant tracking */}
      <motion.div
        className="fixed top-0 left-0 h-1.5 w-1.5 rounded-full bg-[#06B6D4] shadow-[0_0_8px_#06B6D4]"
        style={{
          x: mouseX,
          y: mouseY,
          translateX: '-50%',
          translateY: '-50%',
        }}
        animate={{
          scale: isPressed ? 1.35 : isHovered ? 1.2 : 1,
          opacity: isVisible ? 1 : 0,
        }}
        transition={{
          duration: 0.15,
          ease: 'easeOut',
        }}
      />
    </div>
  );
}

export default CustomCursor;
