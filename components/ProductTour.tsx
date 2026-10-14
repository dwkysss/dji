"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, X, Lightbulb, HelpCircle, Check } from "lucide-react";

export type ProductTourStep = {
  target: string;
  title: string;
  description: string;
  badge?: string;
  tips?: string[];
};

type ProductTourProps = {
  steps: ProductTourStep[];
  isOpen: boolean;
  onClose: () => void;
  accentClass?: string;
  buttonClass?: string;
};

export default function ProductTour({
  steps,
  isOpen,
  onClose,
  accentClass = "text-sky-600",
  buttonClass = "bg-[#0070bc] hover:bg-[#004777]",
}: ProductTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [tourRect, setTourRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setStepIndex(0);
      setTourRect(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || steps.length === 0) return;

    const currentStep = steps[stepIndex];
    if (!currentStep) return;

    let targetElement = document.querySelector(`[data-tour="${currentStep.target}"]`);

    const updateTourRect = () => {
      if (!targetElement) {
        targetElement = document.querySelector(`[data-tour="${currentStep.target}"]`);
      }
      if (!targetElement) {
        setTourRect(null);
        return;
      }

      const rect = targetElement.getBoundingClientRect();
      setTourRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };

    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      const isTall = rect.height > (typeof window !== "undefined" ? window.innerHeight : 768) * 0.45;
      targetElement.scrollIntoView({
        behavior: "smooth",
        block: isTall ? "start" : "center",
        inline: "nearest",
      });
    }

    const t1 = setTimeout(updateTourRect, 100);
    const t2 = setTimeout(updateTourRect, 280);

    window.addEventListener("resize", updateTourRect);
    window.addEventListener("scroll", updateTourRect, true);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", updateTourRect);
      window.removeEventListener("scroll", updateTourRect, true);
    };
  }, [isOpen, stepIndex, steps]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        if (stepIndex < steps.length - 1) {
          setStepIndex((s) => s + 1);
        } else {
          onClose();
        }
      } else if (e.key === "ArrowLeft") {
        if (stepIndex > 0) {
          setStepIndex((s) => s - 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, stepIndex, steps.length, onClose]);

  if (!isOpen || steps.length === 0) return null;

  const currentStep = steps[stepIndex] || steps[0];
  const isLastStep = stepIndex === steps.length - 1;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 768;
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1024;
  const isMobile = viewportWidth < 640;

  // Estimasi tinggi kartu untuk penempatan akurat di atas/bawah/samping target
  const estimatedCardHeight = 240 + (currentStep.tips?.length || 0) * 36;
  const cardWidth = Math.min(viewportWidth - 32, 420);

  let tourCardTop = 96;
  let tourCardLeft = 16;

  if (tourRect) {
    const spaceBelow = viewportHeight - (tourRect.top + tourRect.height);
    const spaceAbove = tourRect.top;
    const spaceLeft = tourRect.left;
    const spaceRight = viewportWidth - (tourRect.left + tourRect.width);

    // 1. Cek apakah cukup ruang di bawah elemen
    if (spaceBelow >= Math.min(estimatedCardHeight, 260) + 20) {
      tourCardTop = tourRect.top + tourRect.height + 14;
      tourCardLeft = isMobile
        ? 16
        : Math.max(16, Math.min(tourRect.left, viewportWidth - cardWidth - 16));
    }
    // 2. Cek apakah cukup ruang di atas elemen
    else if (spaceAbove >= Math.min(estimatedCardHeight, 260) + 20) {
      tourCardTop = Math.max(16, tourRect.top - estimatedCardHeight - 14);
      tourCardLeft = isMobile
        ? 16
        : Math.max(16, Math.min(tourRect.left, viewportWidth - cardWidth - 16));
    }
    // 3. Pada desktop/tablet, jika elemen di kolom kanan, posisikan di sebelah KIRI elemen agar tidak menumpuk
    else if (!isMobile && spaceLeft >= cardWidth + 20) {
      tourCardLeft = tourRect.left - cardWidth - 16;
      tourCardTop = Math.max(
        16,
        Math.min(tourRect.top, viewportHeight - estimatedCardHeight - 20)
      );
    }
    // 4. Atau di samping KANAN elemen jika ada ruang
    else if (!isMobile && spaceRight >= cardWidth + 20) {
      tourCardLeft = tourRect.left + tourRect.width + 16;
      tourCardTop = Math.max(
        16,
        Math.min(tourRect.top, viewportHeight - estimatedCardHeight - 20)
      );
    }
    // 5. Fallback terakhir: tempatkan di mana ruang lebih lega (atas atau bawah)
    else {
      if (spaceBelow >= spaceAbove) {
        tourCardTop = Math.max(16, viewportHeight - estimatedCardHeight - 16);
      } else {
        tourCardTop = 16;
      }
      tourCardLeft = isMobile
        ? 16
        : Math.max(16, (viewportWidth - cardWidth) / 2);
    }

    // Pastikan tidak tembus batas atas dan bawah viewport
    tourCardTop = Math.max(16, Math.min(tourCardTop, viewportHeight - 220));
  } else {
    // Fallback jika elemen target belum tampil / belum discroll
    tourCardTop = Math.max(20, (viewportHeight - Math.min(estimatedCardHeight, 380)) / 2);
    tourCardLeft = Math.max(16, (viewportWidth - cardWidth) / 2);
  }

  return (
    <div className="fixed inset-0 z-[80] print:hidden">
      {/* SVG Mask Cutout Backdrop: Gelap di sekeliling, tapi LUBANG SPOTLIGHT 100% JERNIH TANPA BIKIN BUREM */}
      <svg
        className="fixed inset-0 w-full h-full pointer-events-auto cursor-pointer z-[81]"
        xmlns="http://www.w3.org/2000/svg"
        onClick={onClose}
      >
        <defs>
          <mask id="product-tour-spotlight-mask">
            {/* White = area yang ditutup overlay gelap */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black = lubang tembus pandang 100% jernih, teks & elemen di dalamnya tajam tanpa blur */}
            {tourRect && (
              <rect
                x={Math.max(tourRect.left - 6, 2)}
                y={Math.max(tourRect.top - 6, 2)}
                width={tourRect.width + 12}
                height={tourRect.height + 12}
                rx="16"
                ry="16"
                fill="black"
              />
            )}
          </mask>
        </defs>

        {/* Overlay gelap yang terpotong rapi oleh mask */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(15, 23, 42, 0.72)"
          mask="url(#product-tour-spotlight-mask)"
        />

        {/* Glowing border di sekeliling lubang cutout */}
        {tourRect && (
          <rect
            x={Math.max(tourRect.left - 6, 2)}
            y={Math.max(tourRect.top - 6, 2)}
            width={tourRect.width + 12}
            height={tourRect.height + 12}
            rx="16"
            ry="16"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.5"
            className="pointer-events-none drop-shadow-[0_0_12px_rgba(56,189,248,0.7)]"
          />
        )}
      </svg>

      {/* Tour Card Popover */}
      <div
        className="fixed rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-slate-200/90 p-4 sm:p-5 z-[85] transition-all duration-300 max-h-[85vh] overflow-y-auto custom-scrollbar flex flex-col justify-between"
        style={{
          top: tourCardTop,
          left: tourCardLeft,
          width: isMobile ? `calc(100vw - 32px)` : `${cardWidth}px`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          {/* Top Bar: Badge, Step, and Close */}
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-sky-50 ${accentClass} border border-sky-200/70`}>
                <HelpCircle className="w-3 h-3 shrink-0" />
                {currentStep.badge || "PANDUAN"}
              </span>
              <span className="text-[11px] font-bold text-slate-400">
                {stepIndex + 1} / {steps.length}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
              aria-label="Tutup tutorial"
              title="Tutup (Esc)"
            >
              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>

          {/* Title */}
          <h4 className="text-sm sm:text-base font-black text-slate-900 leading-snug mb-1.5">
            {currentStep.title}
          </h4>

          {/* Description */}
          <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed font-normal">
            {currentStep.description}
          </p>

          {/* Tips Bullet Points (Jika Ada) */}
          {currentStep.tips && currentStep.tips.length > 0 && (
            <div className="mt-3 p-2.5 sm:p-3 rounded-xl bg-sky-50/80 border border-sky-100/90 text-sky-950">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-sky-700 mb-1.5">
                <Lightbulb className="w-3 h-3 text-amber-500 shrink-0" />
                <span>Poin Penting & Tips:</span>
              </div>
              <ul className="space-y-1.5 text-[11px] sm:text-xs text-slate-700 leading-snug">
                {currentStep.tips.map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0 mt-1.5" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-100">
          {/* Step dots on larger screens */}
          <div className="hidden sm:flex items-center gap-1">
            {steps.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setStepIndex(idx)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  idx === stepIndex
                    ? "w-5 bg-[#0070bc]"
                    : "w-1.5 bg-slate-200 hover:bg-slate-300"
                }`}
                aria-label={`Ke langkah ${idx + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto ml-auto">
            <button
              type="button"
              onClick={() => setStepIndex((step) => Math.max(step - 1, 0))}
              disabled={stepIndex === 0}
              className="h-8 sm:h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer shrink-0 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Sebelumnya</span>
            </button>

            <button
              type="button"
              onClick={isLastStep ? onClose : () => setStepIndex((step) => step + 1)}
              className={`flex-1 sm:flex-initial h-8 sm:h-9 px-4 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 ${buttonClass}`}
            >
              <span>{isLastStep ? "Selesai" : "Lanjut"}</span>
              {isLastStep ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <ArrowRight className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
