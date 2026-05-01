import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Info, Loader2 } from 'lucide-react';
import { getTrends } from '../../services/api';
import useAppStore from '../../store/useAppStore';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';

export default function TrendChart({ parameter }) {
  const { selectedMemberId, token } = useAppStore();
  const [data, setData] = useState([]);
  const [insight, setInsight] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedMemberId && token && parameter) {
      fetchTrends();
    }
  }, [selectedMemberId, token, parameter]);

  const fetchTrends = async () => {
    setLoading(true);
    try {
      const resp = await getTrends(selectedMemberId, parameter);
      setData(resp.trend);
      setInsight(resp.insight);
    } catch (error) {
      console.error('Failed to fetch trends:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!token || data.length < 2) return null;

  const getInsightIcon = () => {
    if (insight === 'Increasing') return <TrendingUp className="w-4 h-4 text-destructive" />;
    if (insight === 'Decreasing') return <TrendingDown className="w-4 h-4 text-green-500" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <Card className="glass-card mb-6">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            {parameter} Trend Analysis
          </CardTitle>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[250px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(var(--primary), 0.1)" />
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.5 }}
                dy={10}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.5 }}
                domain={['auto', 'auto']}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  borderColor: 'hsl(var(--border))',
                  borderRadius: '12px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3}
                dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        <div className={`mt-6 p-4 rounded-xl flex items-start gap-3 border transition-colors ${
          insight === 'Increasing' ? 'bg-destructive/5 border-destructive/20' :
          insight === 'Decreasing' ? 'bg-green-500/5 border-green-500/20' :
          'bg-primary/5 border-primary/20'
        }`}>
          <div className="mt-0.5">{getInsightIcon()}</div>
          <div className="flex-1">
            <p className="text-sm font-medium">Insight: {insight}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Based on your last {data.length} reports. 
              {insight === 'Increasing' && " This parameter is trending upwards."}
              {insight === 'Decreasing' && " This parameter is trending downwards."}
              {insight === 'Stable' && " This parameter is staying consistent."}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
