import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { FileSearch, Activity, FileText, Loader2, Clock } from 'lucide-react';

const steps = [
  { id: 'extracting', icon: FileSearch, key: 'step_extracting', label: 'Reading your report', sub: 'OCR scanning every value on the page' },
  { id: 'analyzing', icon: Activity, key: 'step_analyzing', label: 'Analyzing parameters', sub: 'Comparing against clinical reference ranges' },
  { id: 'summarizing', icon: FileText, key: 'step_summarizing', label: 'Generating your summary', sub: 'Preparing personalised explanations for you' },
];

// Each step shows for ~20 seconds — total 60s before cycling back
const STEP_DURATION_MS = 20_000;

export default function Processing() {
  const { t } = useTranslation();
  const [activeStep, setActiveStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);   // seconds since mount

  // ── Cycle through steps every STEP_DURATION_MS ──────────────
  useEffect(() => {
    const id = setInterval(() => {
      setActiveStep(prev => (prev + 1) % steps.length);
    }, STEP_DURATION_MS);
    return () => clearInterval(id);
  }, []);

  // ── Elapsed timer (shown to user so they know it's working) ──
  useEffect(() => {
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = minutes > 0
    ? `${minutes}m ${seconds}s`
    : `${seconds}s`;

  return (
    <div className="w-full max-w-2xl mx-auto mt-12 animate-in fade-in zoom-in duration-700">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col items-center mb-12">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse" />
          <div className="relative bg-background border-2 border-primary/30 p-6 rounded-3xl shadow-xl">
            <Activity className="w-16 h-16 text-primary animate-pulse" />
          </div>
          <div className="absolute -bottom-2 -right-2 bg-primary p-2 rounded-lg shadow-lg">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        </div>

        <h2 className="text-3xl font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600">
          {t('processing_title', 'AI is Analysing Your Report')}
        </h2>
        <p className="text-muted-foreground text-lg italic text-center max-w-md">
          This typically takes 30–90 seconds. Please keep this tab open.
        </p>

        {/* ── Elapsed timer ──────────────────────────────────── */}
        <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground bg-secondary/40 px-4 py-2 rounded-full">
          <Clock className="w-4 h-4" />
          <span>Processing for {timeStr}</span>
        </div>
      </div>

      {/* ── Steps card ──────────────────────────────────────────── */}
      <div className="glass-card p-10 rounded-3xl border-primary/10 shadow-2xl relative overflow-hidden">

        {/* Progress bar — cycles every 90s to match realistic time */}
        <div className="absolute top-0 left-0 w-full h-1 bg-muted">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 90, ease: 'linear' }}
          />
        </div>

        <div className="space-y-8 mt-4">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = idx === activeStep;
            const isDone = idx < activeStep;

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.3 }}
                className="flex items-center gap-6 group"
              >
                {/* Icon */}
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border transition-all duration-500 shadow-sm
                  ${isActive ? 'bg-primary text-white border-primary scale-110'
                    : isDone ? 'bg-primary/20 text-primary border-primary/30'
                      : 'bg-secondary/40 text-muted-foreground border-border/40'}`}
                >
                  <Icon className="w-7 h-7" />
                </div>

                {/* Text */}
                <div className="flex-1">
                  <p className={`text-xl font-semibold tracking-tight transition-colors duration-300
                    ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {t(step.key, step.label)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{step.sub}</p>
                </div>

                {/* Status indicator */}
                <div className={`flex gap-1.5 items-center px-3 py-1.5 rounded-full transition-all duration-300
                  ${isActive ? 'bg-primary/10' : 'bg-secondary/50'}`}>
                  {isActive ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                    </>
                  ) : isDone ? (
                    <span className="text-xs text-primary font-medium px-1">done</span>
                  ) : (
                    <span className="text-xs text-muted-foreground px-1">waiting</span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── Footer note ─────────────────────────────────────────── */}
      <div className="mt-8 p-6 rounded-2xl bg-primary/5 border border-primary/10 flex items-center gap-4 text-sm text-primary/80 max-w-lg mx-auto">
        <div className="w-2 h-2 rounded-full bg-primary animate-ping flex-shrink-0" />
        <p>Our AI cross-references your values with global medical standards. Longer reports take more time — this is normal.</p>
      </div>

    </div>
  );
}