import React from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import SummaryPanel from './SummaryPanel';
import RiskAlert from './RiskAlert';
import MetricCards from './MetricCards';
import Charts from './Charts';
import DietSuggestions from './DietSuggestions';
import ReportViewer from '../report/ReportViewer';
import { Button } from '../ui/button';

export default function Dashboard() {
  const { t } = useTranslation();
  const { reset } = useAppStore();

  return (
    <div className="w-full max-w-6xl mx-auto mt-8 pb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
            {t('dashboard_title')}
          </h1>
          <p className="text-muted-foreground mt-1">AI-powered insights based on your latest blood report.</p>
        </div>
        <Button variant="outline" onClick={reset} className="gap-2 shadow-sm">
          <RotateCcw className="w-4 h-4" />
          {t('try_again')}
        </Button>
      </div>

      <RiskAlert />
      
      <SummaryPanel />

      <MetricCards />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Charts />
        </div>
        <div className="flex flex-col gap-6">
          <DietSuggestions />
        </div>
      </div>

      <div className="mt-6">
        <ReportViewer />
      </div>
    </div>
  );
}
