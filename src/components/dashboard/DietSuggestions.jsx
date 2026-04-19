import React from 'react';
import { useTranslation } from 'react-i18next';
import { Utensils, CheckCircle } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';

export default function DietSuggestions() {
  const { t } = useTranslation();
  const { resultData } = useAppStore();

  const isCritical = resultData?.is_critical || resultData?.risk_level === 'critical';

  // Hide if critical
  if (isCritical) return null;

  const suggestions = resultData?.diet_suggestions || [];

  if (suggestions.length === 0) return null;

  return (
    <Card className="glass-card h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Utensils className="w-5 h-5 text-primary" />
          {t('diet_suggestions', 'Diet & Lifestyle Suggestions')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {suggestions.map((suggestion, idx) => (
            <li key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <span className="text-sm leading-relaxed">{suggestion}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
