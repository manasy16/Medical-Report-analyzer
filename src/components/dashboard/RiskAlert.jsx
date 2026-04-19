import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import { Card, CardContent } from '../ui/card';

export default function RiskAlert() {
  const { t } = useTranslation();
  const { resultData } = useAppStore();

  const isCritical = resultData?.is_critical || resultData?.risk_level === 'critical';

  if (!isCritical) return null;

  return (
    <Card className="border-destructive/50 bg-destructive/10 mb-6 animate-in slide-in-from-top-4">
      <CardContent className="flex items-start gap-4 p-6">
        <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-6 h-6 text-destructive" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-destructive mb-1">{t('risk_alert_critical', 'Important Alert')}</h3>
          <p className="text-destructive/90 leading-relaxed font-medium">
            Doctor se consult karna better rahega.
          </p>
          {resultData?.validation_errors?.length > 0 && (
            <ul className="list-disc pl-5 mt-2 text-sm text-destructive/80">
              {resultData.validation_errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
