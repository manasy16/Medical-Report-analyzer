import React from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw, Download, Share2, RefreshCcw } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import SummaryPanel from './SummaryPanel';
import RiskAlert from './RiskAlert';
import MetricCards from './MetricCards';
import Charts from './Charts';
import DietSuggestions from './DietSuggestions';
import ReportViewer from '../report/ReportViewer';
import ReportHistory from './ReportHistory';
import TrendChart from '../trends/TrendChart';
import { Button } from '../ui/button';

export default function Dashboard() {
  const { t } = useTranslation();
  const { reset, token, resultData, language } = useAppStore();

  const reportTypeLabels = {
    "cbc": "Complete Blood Count (CBC)",
    "lipid": "Lipid Panel",
    "thyroid": "Thyroid Function Test",
    "liver": "Liver Function Test",
    "kidney": "Kidney Function Test",
    "diabetes": "Diabetes / Blood Sugar",
    "urine": "Urine Analysis",
    "unknown": "Unknown Report Type"
  };

  const reportTypeLabel = resultData?.report_type ? (reportTypeLabels[resultData.report_type] || "Medical Report") : "Medical Report";
  const isUnknown = resultData?.report_type === 'unknown';

  const handleExport = () => {
    if (!resultData) return;

    const summary = typeof resultData.summary === 'string' 
      ? resultData.summary 
      : (resultData.summary[language] || resultData.summary['en'] || '');

    const parameters = resultData.parameters || [];
    const extractedValues = resultData.extracted_values || {};

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Health Analysis Report - ${new Date().toLocaleDateString()}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 40px; }
            .header { border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
            .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
            .date { color: #666; }
            h1 { font-size: 28px; margin: 0; }
            h2 { font-size: 20px; color: #2563eb; margin-top: 30px; border-bottom: 1px solid #eee; padding-bottom: 8px; }
            .risk-badge { display: inline-block; padding: 4px 12px; rounded: 4px; font-weight: bold; text-transform: uppercase; border-radius: 4px; }
            .risk-critical { background: #fee2e2; color: #dc2626; }
            .risk-borderline { background: #fef3c7; color: #d97706; }
            .risk-normal { background: #dcfce7; color: #16a34a; }
            .summary-box { background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #2563eb; margin: 20px 0; font-size: 18px; }
            .parameter-card { margin-bottom: 20px; padding: 15px; border: 1px solid #eee; border-radius: 8px; }
            .parameter-name { font-weight: bold; font-size: 16px; margin-bottom: 5px; }
            .parameter-value { font-size: 20px; font-weight: bold; color: #111; }
            .parameter-unit { font-size: 14px; color: #666; margin-left: 4px; }
            .metric-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-top: 20px; }
            .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; text-align: center; }
            @media print {
              body { padding: 20px; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
          <div class="logo">Medical Report AI</div>
            <div class="date">${new Date().toLocaleDateString()}</div>
          </div>
          
          <h1>${reportTypeLabel} Analysis Dashboard</h1>
          <p>Risk Level: <span class="risk-badge risk-${resultData.risk_level || 'unknown'}">${(resultData.risk_level || 'unknown').toUpperCase()}</span></p>

          <div class="summary-box">
            ${summary}
          </div>

          <h2>Detailed Analysis</h2>
          ${parameters.map(p => `
            <div class="parameter-card">
              <div class="parameter-name">${p.parameter_name || 'Unknown Parameter'}</div>
              <div class="parameter-explanation">${typeof p.explanation === 'string' ? p.explanation : (p.explanation?.[language] || p.explanation?.['en'] || 'No explanation available.')}</div>
            </div>
          `).join('')}

          <h2>Extracted Values</h2>
          <div class="metric-grid">
            ${Object.entries(extractedValues).map(([key, val]) => `
              <div class="parameter-card" style="margin-bottom: 0;">
                <div class="parameter-name" style="text-transform: capitalize;">${key.replace('_', ' ')}</div>
                <div>
                  <span class="parameter-value">${val.value || 'N/A'}</span>
                  <span class="parameter-unit">${val.unit || ''}</span>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="footer">
            Generated by AI Medical Report Analyzer. This is an AI-generated summary and should not be used as a substitute for professional medical advice.
          </div>

          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                // window.close(); // Optional: close window after print
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="w-full max-w-6xl mx-auto mt-8 pb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              {isUnknown ? "Your Medical Report Analysis" : `Your ${reportTypeLabel} Analysis`}
            </h1>
            {resultData?.report_type && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary uppercase tracking-wider border border-primary/20">
                {resultData.report_type}
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-1">{t('dashboard_subtitle')}</p>
          
          {isUnknown && (
            <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-amber-800 animate-in slide-in-from-top-2">
              <span className="text-lg">⚠️</span>
              <p className="text-sm font-medium">
                {t('unknown_report_warning')}
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 shadow-sm" onClick={handleExport}>
            <Download className="w-4 h-4" /> Export
          </Button>
          <Button variant="outline" onClick={reset} className="gap-2 shadow-sm">
            <RefreshCcw className="w-4 h-4" />
            {t('try_again')}
          </Button>
        </div>
      </div>

      <RiskAlert />
      
      <SummaryPanel />

      {token && resultData?.parameters && resultData.parameters.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {resultData.parameters.slice(0, 2).map(p => (
            <TrendChart key={p.parameter_name} parameter={p.parameter_name} />
          ))}
        </div>
      )}

      <MetricCards />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Charts component removed as it used hardcoded parameters */}
        </div>
        <div className="flex flex-col gap-6">
          <DietSuggestions />
          <ReportHistory />
        </div>
      </div>

      <div className="mt-6">
        <ReportViewer />
      </div>
    </div>
  );
}
