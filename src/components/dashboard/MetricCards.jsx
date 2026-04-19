import React from 'react';
import { useTranslation } from 'react-i18next';
import useAppStore from '../../store/useAppStore';
import { Card, CardContent } from '../ui/card';
import { Activity, ArrowDownRight, ArrowUpRight, CheckCircle, HelpCircle } from 'lucide-react';

export default function MetricCards() {
  const { t } = useTranslation();
  const { resultData } = useAppStore();

  if (!resultData?.extracted_values) return null;

  const data = Object.entries(resultData.extracted_values);

  if (data.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5" />
        {t('parameters', 'Parameters')}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map(([key, item]) => {
          if (!item) return null; // Defensive check
          
          const isHigh = item.status === 'high';
          const isLow = item.status === 'low';
          const isNormal = item.status === 'normal';
          const hasStatus = isHigh || isLow || isNormal;

          return (
            <Card key={key} className={`glass-card overflow-hidden transition-all hover:-translate-y-1 ${!isNormal && hasStatus ? 'border-destructive/30' : ''}`}>
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium capitalize text-muted-foreground">{key.replace('_', ' ')}</span>
                  <div className={`p-1.5 rounded-full ${isNormal ? 'bg-green-100 text-green-600 dark:bg-green-900/30' : isHigh ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30' : isLow ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 'bg-muted text-muted-foreground'}`}>
                    {isNormal ? <CheckCircle className="w-4 h-4" /> : isHigh ? <ArrowUpRight className="w-4 h-4" /> : isLow ? <ArrowDownRight className="w-4 h-4" /> : <HelpCircle className="w-4 h-4" />}
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className={`text-3xl font-bold ${(!isNormal && hasStatus) ? 'text-destructive' : ''}`}>
                    {item.value !== null ? item.value : '-'}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">{item.unit || ''}</span>
                </div>
                
                {/* Visual representation of range */}
                <div className="w-full bg-secondary h-1.5 rounded-full mt-4 overflow-hidden flex">
                  {isLow && <div className="bg-destructive h-full w-1/3 rounded-full" />}
                  {isNormal && <div className="bg-green-500 h-full w-2/3 rounded-full mx-auto" />}
                  {isHigh && <div className="bg-destructive h-full w-full rounded-full" />}
                </div>
                
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  {item.min !== undefined && <span>Min: {item.min}</span>}
                  <span className="font-medium capitalize px-2 py-0.5 rounded-md bg-secondary">{item.status || 'Unknown'}</span>
                  {item.max !== undefined && <span>Max: {item.max}</span>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
