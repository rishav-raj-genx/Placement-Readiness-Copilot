'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  AlertTriangle,
  Eye,
  Lock,
  PhoneOff,
  ShieldAlert,
  ShieldCheck,
  Timer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface ProctoredGuardProps {
  children: React.ReactNode;
}

export function ProctoredGuard({ children }: ProctoredGuardProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [showExitWarning, setShowExitWarning] = useState(false);
  const [pendingNavigationUrl, setPendingNavigationUrl] = useState<string | null>(null);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Timer for active interview duration
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format elapsed time (MM:SS)
  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // 1. Browser Tab Close / Reload Trap (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Proctored Assessment in progress. If you leave now, your session will be interrupted.';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // 2. Browser Back / Forward History Trap (popstate)
  useEffect(() => {
    // Push an entry to history so back button is captured
    window.history.pushState({ proctored: true }, '', window.location.href);

    const handlePopState = (e: PopStateEvent) => {
      // Re-push state to keep user on the page
      window.history.pushState({ proctored: true }, '', window.location.href);
      setShowExitWarning(true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 3. Intercept all Link Clicks across the page (capture phase)
  useEffect(() => {
    const handleClickCapture = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
      if (anchor.getAttribute('data-bypass-proctor') === 'true') return;

      try {
        const targetUrl = new URL(anchor.href, window.location.origin);
        if (targetUrl.pathname !== pathname) {
          e.preventDefault();
          e.stopPropagation();
          setPendingNavigationUrl(targetUrl.pathname);
          setShowExitWarning(true);
        }
      } catch {
        // Safe ignore
      }
    };

    document.addEventListener('click', handleClickCapture, true);
    return () => document.removeEventListener('click', handleClickCapture, true);
  }, [pathname]);

  // 4. Focus Loss & Tab Switching Monitor (visibilitychange & blur)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsWindowFocused(false);
        setTabSwitchCount((count) => {
          const next = count + 1;
          toast.warning(`⚠️ Proctored Alert: Tab switch or window minimization detected (${next} incident${next > 1 ? 's' : ''}). All focus losses are recorded.`);
          return next;
        });
      } else {
        setIsWindowFocused(true);
      }
    };

    const handleBlur = () => {
      setIsWindowFocused(false);
    };

    const handleFocus = () => {
      setIsWindowFocused(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // 5. Prevent Keyboard Shortcuts from triggering navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent Ctrl+R / Cmd+R / F5
      if ((e.key === 'r' || e.key === 'R') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setShowExitWarning(true);
      }
      if (e.key === 'F5') {
        e.preventDefault();
        setShowExitWarning(true);
      }
      // Prevent Alt + Left Arrow
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        setShowExitWarning(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Allow explicit user confirmed exit
  const handleConfirmedExit = useCallback(() => {
    setShowExitWarning(false);
    toast.info('Assessment session closed.');
    if (pendingNavigationUrl) {
      router.push(pendingNavigationUrl);
    } else {
      router.push('/dashboard/interview');
    }
  }, [pendingNavigationUrl, router]);

  return (
    <div className="relative min-h-screen bg-background">
      {/* Top Proctored Assessment Status Bar */}
      <div className="sticky top-0 z-50 flex h-12 items-center justify-between border-b border-stone-800 bg-[#1e1715]/95 px-4 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-red-900/60 bg-red-950/40 px-2.5 py-1 text-xs font-semibold text-red-300">
            <Lock className="h-3.5 w-3.5 text-[#D93829]" />
            <span>Proctored Exam Mode Active</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-stone-400">
            <Timer className="h-3.5 w-3.5 text-stone-500" />
            <span>Duration: {formatElapsed(elapsedSeconds)}</span>
          </div>
        </div>

        {/* Center / Right Proctored Signals */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isWindowFocused ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isWindowFocused ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            </span>
            <span className="font-mono text-[11px] text-stone-400 hidden md:inline">
              {isWindowFocused ? 'Focused on assessment' : 'Window out of focus'}
            </span>
          </div>

          {tabSwitchCount > 0 && (
            <Badge variant="outline" className="border-amber-800/80 bg-amber-950/40 text-amber-300 text-[10px] font-mono">
              <Eye className="mr-1 h-3 w-3" /> {tabSwitchCount} blur{tabSwitchCount > 1 ? 's' : ''}
            </Badge>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExitWarning(true)}
            className="h-7 rounded-lg border-red-900/50 bg-red-950/30 text-[11px] font-semibold text-red-300 hover:bg-red-900/40 hover:text-white"
          >
            <PhoneOff className="mr-1 h-3 w-3" /> Exit
          </Button>
        </div>
      </div>

      {/* Main Assessment View */}
      <div className="w-full">
        {children}
      </div>

      {/* Proctored Warning Dialog on Navigation Attempt */}
      <AlertDialog open={showExitWarning} onOpenChange={setShowExitWarning}>
        <AlertDialogContent className="border border-red-900/60 bg-[#28201E] text-stone-100 max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-950/60 border border-red-800 text-red-400 shrink-0">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <AlertDialogTitle className="text-base font-bold text-stone-100">
                  Assessment in Progress
                </AlertDialogTitle>
                <p className="text-xs text-red-300 font-mono mt-0.5">
                  Navigation is Restricted During Exam
                </p>
              </div>
            </div>

            <AlertDialogDescription className="text-xs text-stone-300 leading-relaxed pt-2">
              You are currently inside an active proctored interview session. Navigating away, switching routes, or closing this tab will pause or forfeit your session.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Session Proctoring Metrics */}
          <div className="my-2 rounded-xl border border-stone-800 bg-stone-900/80 p-3.5 space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between text-stone-400">
              <span>Current Status:</span>
              <span className="text-emerald-400 font-semibold">Active Assessment</span>
            </div>
            <div className="flex items-center justify-between text-stone-400">
              <span>Time Elapsed:</span>
              <span className="text-stone-200">{formatElapsed(elapsedSeconds)}</span>
            </div>
            <div className="flex items-center justify-between text-stone-400">
              <span>Tab Switches Logged:</span>
              <span className={tabSwitchCount > 0 ? 'text-amber-400 font-semibold' : 'text-emerald-400'}>
                {tabSwitchCount} incident{tabSwitchCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <AlertDialogFooter className="flex flex-col sm:flex-row gap-2 pt-1">
            <AlertDialogAction
              onClick={() => {
                setShowExitWarning(false);
                setPendingNavigationUrl(null);
              }}
              className="bg-[#D93829] hover:bg-[#C22F21] text-white font-semibold text-xs py-2 shadow-md"
            >
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Stay in Assessment
            </AlertDialogAction>
            <Button
              variant="outline"
              onClick={handleConfirmedExit}
              className="border-stone-800 text-stone-400 hover:bg-stone-800 hover:text-stone-200 text-xs py-2"
            >
              Abandon & Leave
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
