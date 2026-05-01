import React, { useEffect, useState } from 'react';
import { Calendar, FileText, ChevronRight, Loader2, Clock } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import { getReports } from '../../services/api';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';

export default function ReportHistory() {
  const { selectedMemberId, token, history, setHistory, setResultData, setUploadStatus } = useAppStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedMemberId && token) {
      fetchHistory();
    }
  }, [selectedMemberId, token]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await getReports(selectedMemberId);
      setHistory(data);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewReport = (report) => {
    setResultData(report.parsed_json);
    setUploadStatus('completed');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!token || (history.length === 0 && !loading)) return null;

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Report History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && history.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((report) => (
              <button
                key={report.id}
                onClick={() => handleViewReport(report)}
                className="w-full text-left p-4 rounded-xl border border-border/50 bg-secondary/20 hover:bg-secondary/40 hover:border-primary/30 transition-all group flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{report.file_url}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(report.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
