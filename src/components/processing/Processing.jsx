import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FileSearch, Activity, FileText, Loader2 } from 'lucide-react';
import { Progress } from '../ui/progress';

const steps = [
  { id: 'extracting', icon: FileSearch, key: 'step_extracting' },
  { id: 'analyzing', icon: Activity, key: 'step_analyzing' },
  { id: 'summarizing', icon: FileText, key: 'step_summarizing' }
];

export default function Processing() {
  const { t } = useTranslation();

  return (
    <div className="w-full max-w-2xl mx-auto mt-12 animate-in fade-in zoom-in duration-700">
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
          {t('processing_title', 'AI is Analyzing Your Report')}
        </h2>
        <p className="text-muted-foreground text-lg italic">
          Please wait while our intelligence engine extracts and reviews every parameter...
        </p>
      </div>

      <div className="glass-card p-10 rounded-3xl border-primary/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-muted">
          <motion.div 
            className="h-full bg-primary" 
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          />
        </div>

        <div className="space-y-8 mt-4">
          {steps.map((step, idx) => {
            const Icon = step.icon;

            return (
              <motion.div 
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.4 }}
                className="flex items-center gap-6 group"
              >
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 bg-primary/10 text-primary border border-primary/20 group-hover:bg-primary/20 transition-all duration-500 shadow-sm">
                  <Icon className="w-7 h-7" />
                </div>
                <div className="flex-1">
                  <p className="text-xl font-semibold text-foreground tracking-tight">
                    {t(step.key)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Optimizing results using Gemini 2.0 Flash
                  </p>
                </div>
                <div className="flex gap-1.5 items-center bg-secondary/50 px-3 py-1.5 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
      
      <div className="mt-12 p-6 rounded-2xl bg-primary/5 border border-primary/10 flex items-center gap-4 text-sm text-primary/80 max-w-lg mx-auto">
        <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
        <p>Our AI is cross-referencing your values with global medical standards for the highest accuracy.</p>
      </div>
    </div>
  );
}
