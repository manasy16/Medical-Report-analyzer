import React from 'react';
import { useTranslation } from 'react-i18next';
import useAppStore from '../../store/useAppStore';
import { Card, CardContent } from '../ui/card';
import { Activity, ArrowDownRight, ArrowUpRight, CheckCircle, HelpCircle } from 'lucide-react';

export default function MetricCards() {
  const { t } = useTranslation();
  const { resultData, language } = useAppStore();

  if (!resultData?.extracted_values) return null;

  const data = Object.entries(resultData.extracted_values);

  if (data.length === 0) return null;

  const parametersDict = {};
  if (resultData?.parameters) {
    resultData.parameters.forEach(p => {
      const pName = p.parameter_name.toLowerCase();
      parametersDict[pName] = p;
    });
  }

  return (
    <div className="mb-6">
      <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5" />
        {t('parameters', 'Parameters')}
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.map(([key, item]) => {
          if (!item) return null; // Defensive check
          
          const isHigh = item.status === 'high';
          const isLow = item.status === 'low';
          const isNormal = item.status === 'normal';
          const hasStatus = isHigh || isLow || isNormal;

          const keyLower = key.toLowerCase();
          let pInfo = parametersDict[keyLower] || 
                      resultData?.parameters?.find(p => p.parameter_name.toLowerCase().includes(keyLower) || keyLower.includes(p.parameter_name.toLowerCase()));

          return (
            <Card key={key} className={`glass-card overflow-hidden transition-all hover:-translate-y-1 ${!isNormal && hasStatus ? 'border-destructive/30' : ''}`}>
              <CardContent className="p-5 flex flex-col h-full">
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
                <div className="w-full bg-secondary h-1.5 rounded-full mt-2 mb-4 overflow-hidden flex">
                  {isLow && <div className="bg-destructive h-full w-1/3 rounded-full" />}
                  {isNormal && <div className="bg-green-500 h-full w-2/3 rounded-full mx-auto" />}
                  {isHigh && <div className="bg-destructive h-full w-full rounded-full" />}
                </div>

                {pInfo && (
                  <div className="mt-4 pt-4 border-t border-border/50 text-sm flex-1 flex flex-col gap-3">
                    <div className="bg-primary/5 p-3 rounded-lg text-foreground/80 leading-relaxed">
                      <strong className="block text-primary mb-1">What is this?</strong>
                      {typeof pInfo.explanation === 'string' ? pInfo.explanation : (pInfo.explanation?.[language] || pInfo.explanation?.['en'])}
                    </div>
                    {pInfo.nutrition_guide && (
                      <div className="bg-secondary/50 p-3 rounded-lg">
                        <strong className="block text-secondary-foreground mb-1">Nutrition Guide:</strong>
                        <p className="text-foreground/80 leading-relaxed text-sm">
                          {typeof pInfo.nutrition_guide === 'string' ? pInfo.nutrition_guide : (pInfo.nutrition_guide?.[language] || pInfo.nutrition_guide?.['en'])}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
