import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FileSearch, Activity, FileText } from 'lucide-react';
import { Progress } from '../ui/progress';

const steps = [
  { id: 'extracting', icon: FileSearch, key: 'step_extracting' },
  { id: 'analyzing', icon: Activity, key: 'step_analyzing' },
  { id: 'summarizing', icon: FileText, key: 'step_summarizing' }
];

export default function Processing() {
  const { t } = useTranslation();

  return (
    <div className="w-full max-w-xl mx-auto mt-20 animate-in fade-in duration-500">
      <div className="text-center mb-10">
        <h2 className="text-2xl font-bold mb-3">{t('processing_title')}</h2>
        <p className="text-muted-foreground animate-pulse">This might take a moment...</p>
      </div>

      <div className="glass-card p-8 rounded-2xl">
        <div className="mb-10">
          <Progress className="h-2 w-full overflow-hidden" value={null} />
          {/* An indeterminate progress bar can be simulated with animation, but for now we just show steps */}
        </div>

        <div className="space-y-6">
          {steps.map((step, idx) => {
            const Icon = step.icon;

            return (
              <motion.div 
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.2 }}
                className="flex items-center gap-4 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-primary/20 text-primary transition-colors duration-500">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">
                    {t(step.key)}
                  </p>
                </div>
                <div className="flex gap-1 items-center h-5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
