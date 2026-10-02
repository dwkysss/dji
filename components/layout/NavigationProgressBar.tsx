"use client";

import React, { useEffect, useState, useRef, Suspense, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function ProgressBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  const trickleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const finishTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupTimerRef = useRef<NodeJS.Timeout | null>(null);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isNavigatingRef = useRef(false);

  // Clear all running timers
  const clearTimers = useCallback(() => {
    if (trickleTimerRef.current) clearInterval(trickleTimerRef.current);
    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    trickleTimerRef.current = null;
    finishTimerRef.current = null;
    cleanupTimerRef.current = null;
    safetyTimeoutRef.current = null;
  }, []);

  // Start progress bar animation
  const startProgress = useCallback(() => {
    clearTimers();
    isNavigatingRef.current = true;
    setProgress(20);
    setIsVisible(true);

    // Trickle progress incrementally up to ~85%
    trickleTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev < 60) {
          return prev + Math.random() * 12 + 6;
        } else if (prev < 82) {
          return prev + Math.random() * 4 + 2;
        } else if (prev < 90) {
          return prev + 0.5;
        }
        return prev;
      });
    }, 200);

    // Safety timeout: automatically finish after 8s so it never gets stuck
    safetyTimeoutRef.current = setTimeout(() => {
      completeProgress();
    }, 8000);
  }, [clearTimers]);

  // Complete progress bar animation
  const completeProgress = useCallback(() => {
    if (!isNavigatingRef.current && !isVisible) return;

    if (trickleTimerRef.current) {
      clearInterval(trickleTimerRef.current);
      trickleTimerRef.current = null;
    }
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }

    setProgress(100);

    // Wait for the bar to slide to 100%, then fade out
    finishTimerRef.current = setTimeout(() => {
      setIsVisible(false);

      // Reset state once faded out
      cleanupTimerRef.current = setTimeout(() => {
        setProgress(0);
        isNavigatingRef.current = false;
      }, 350);
    }, 200);
  }, [isVisible]);

  // Complete progress when pathname or search parameters change
  useEffect(() => {
    completeProgress();
  }, [pathname, searchParams, completeProgress]);

  // Intercept click events on links to start progress instantly
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Ignore right clicks, modifier keys, or default prevented
      if (
        e.button !== 0 ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.shiftKey ||
        e.defaultPrevented
      ) {
        return;
      }

      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;

      const rawHref = anchor.getAttribute("href");
      if (
        !rawHref ||
        rawHref.startsWith("#") ||
        rawHref.startsWith("mailto:") ||
        rawHref.startsWith("tel:") ||
        rawHref.startsWith("javascript:")
      ) {
        return;
      }

      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      try {
        const targetUrl = new URL(anchor.href, window.location.href);
        const currentUrl = new URL(window.location.href);

        // Ignore external navigation
        if (targetUrl.origin !== currentUrl.origin) return;

        // If target is same page + same query, ignore
        if (
          targetUrl.pathname === currentUrl.pathname &&
          targetUrl.search === currentUrl.search
        ) {
          return;
        }

        // Internal navigation detected -> start progress bar immediately!
        startProgress();
      } catch {
        // Invalid URL, do nothing
      }
    };

    // Custom event listeners for programmatic navigation
    const handleStartEvent = () => startProgress();
    const handleStopEvent = () => completeProgress();

    document.addEventListener("click", handleClick, { capture: true });
    window.addEventListener("dji-nav-start", handleStartEvent);
    window.addEventListener("dji-nav-stop", handleStopEvent);

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("dji-nav-start", handleStartEvent);
      window.removeEventListener("dji-nav-stop", handleStopEvent);
      clearTimers();
    };
  }, [startProgress, completeProgress, clearTimers]);

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 h-[3px] z-[99999] pointer-events-none transition-opacity duration-300"
      style={{
        opacity: isVisible ? 1 : 0,
      }}
    >
      {/* Background track */}
      <div
        className="h-full w-full transition-transform duration-200 ease-out origin-left"
        style={{
          transform: `scaleX(${progress / 100})`,
          background: "linear-gradient(90deg, #0070bc 0%, #0ea5e9 60%, #38bdf8 100%)",
          boxShadow: "0 0 10px rgba(0, 112, 188, 0.8), 0 0 5px rgba(14, 165, 233, 0.6)",
        }}
      >
        {/* Glow head */}
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-r from-transparent to-white/70 blur-[1px]" />
      </div>
    </div>
  );
}

export default function NavigationProgressBar() {
  return (
    <Suspense fallback={null}>
      <ProgressBarInner />
    </Suspense>
  );
}
