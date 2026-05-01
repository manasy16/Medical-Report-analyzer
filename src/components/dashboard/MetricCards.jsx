import React from 'react';
import { useTranslation } from 'react-i18next';
import useAppStore from '../../store/useAppStore';
import { Card, CardContent } from '../ui/card';
import { Activity, ArrowDownRight, ArrowUpRight, CheckCircle, HelpCircle, TrendingUp, TrendingDown } from 'lucide-react';

export default function MetricCards() {
  const { t } = useTranslation();
  const { resultData, language } = useAppStore();

  if (!resultData?.extracted_values) return null;

  const parameters = resultData?.parameters || [];
  const extractedValues = resultData?.extracted_values || {};

  if (parameters.length === 0) {
    return (
      <div className="mb-6 p-8 text-center bg-muted/20 rounded-xl border-2 border-dashed border-border/50">
        <p className="text-muted-foreground">{t('no_parameters', 'No individual parameter details available.')}</p>
      </div>
    );
  }

  const formatName = (name) => {
    return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="mb-6">
      <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5" />
        {t('parameters', 'Parameters')}
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {parameters.map((pInfo) => {
          const key = pInfo.parameter_name;
          // Robust lookup: try exact key, then case-insensitive, then snake_case
          let item = extractedValues[key];
          if (!item) {
            const normalizedKey = key.toLowerCase().replace(/\s+/g, '_');
            const foundKey = Object.keys(extractedValues).find(k => 
              k.toLowerCase() === normalizedKey || k.toLowerCase() === key.toLowerCase()
            );
            if (foundKey) item = extractedValues[foundKey];
          }
          
          const status = pInfo.status || item?.status;
          const isHigh = status === 'high';
          const isLow = status === 'low';
          const isNormal = status === 'normal';
          const isAbnormal = status === 'abnormal';
          const hasStatus = isHigh || isLow || isNormal || isAbnormal;

          return (
            <Card key={key} className={`glass-card overflow-hidden transition-all hover:-translate-y-1 ${!isNormal && hasStatus ? 'border-destructive/30' : ''}`}>
              <CardContent className="p-5 flex flex-col h-full">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium text-muted-foreground">{formatName(key)}</span>
                  <div className={`p-1.5 rounded-full ${
                    isNormal ? 'bg-green-100 text-green-600 dark:bg-green-900/30' : 
                    isHigh ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30' : 
                    isLow ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 
                    isAbnormal ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {isNormal ? <CheckCircle className="w-4 h-4" /> : 
                     isHigh ? <ArrowUpRight className="w-4 h-4" /> : 
                     isLow ? <ArrowDownRight className="w-4 h-4" /> : 
                     isAbnormal ? <Activity className="w-4 h-4" /> :
                     <HelpCircle className="w-4 h-4" />}
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className={`text-3xl font-bold ${(!isNormal && hasStatus) ? 'text-destructive' : ''}`}>
                    {item?.value !== null && item?.value !== undefined ? item.value : '-'}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">{item?.unit || ''}</span>
                  
                  {/* Inline trend indicator from explanation */}
                  {(() => {
                    const exp = pInfo.explanation;
                    const expText = (typeof exp === 'string' ? exp : (exp?.[language] || exp?.['en'] || '')).toLowerCase();
                    if (expText.includes('improving') || expText.includes('better')) {
                      return (
                        <div className="flex items-center text-green-500 text-xs font-bold bg-green-500/10 px-1.5 py-0.5 rounded ml-1" title="Condition Improving">
                          <TrendingUp className="w-3 h-3 mr-0.5" />
                        </div>
                      );
                    }
                    if (expText.includes('worsening') || expText.includes('higher than last') || expText.includes('lower than last')) {
                      return (
                        <div className="flex items-center text-red-500 text-xs font-bold bg-red-500/10 px-1.5 py-0.5 rounded ml-1" title="Condition Worsening">
                          <TrendingDown className="w-3 h-3 mr-0.5" />
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
                
                {/* Visual representation of range */}
                <div className="w-full bg-secondary h-1.5 rounded-full mt-2 mb-4 overflow-hidden flex">
                  {isLow && <div className="bg-destructive h-full w-1/3 rounded-full" />}
                  {isNormal && <div className="bg-green-500 h-full w-2/3 rounded-full mx-auto" />}
                  {isHigh && <div className="bg-destructive h-full w-full rounded-full" />}
                </div>

                <div className="mt-4 pt-4 border-t border-border/50 text-sm flex-1 flex flex-col gap-3">
                  <div className="bg-primary/5 p-3 rounded-lg text-foreground/80 leading-relaxed">
                    <strong className="block text-primary mb-1">What is this?</strong>
                    {typeof pInfo.explanation === 'string' ? pInfo.explanation : (pInfo.explanation?.[language] || pInfo.explanation?.['en'] || '—')}
                  </div>
                  {pInfo.nutrition_guide && (
                    <div className="bg-secondary/50 p-3 rounded-lg">
                      <strong className="block text-secondary-foreground mb-1">Nutrition Guide:</strong>
                      <p className="text-foreground/80 leading-relaxed text-sm">
                        {typeof pInfo.nutrition_guide === 'string' ? pInfo.nutrition_guide : (pInfo.nutrition_guide?.[language] || pInfo.nutrition_guide?.['en'] || '—')}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
