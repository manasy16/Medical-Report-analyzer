import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileDown, FileIcon } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';

export default function ReportViewer() {
  const { t } = useTranslation();
  const { file } = useAppStore();

  if (!file) return null;

  const isImage = file.type.startsWith('image/');
  const fileUrl = URL.createObjectURL(file);

  return (
    <Card className="glass-card h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileIcon className="w-5 h-5 text-primary" />
          {t('report_viewer')}
        </CardTitle>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2" 
          onClick={() => {
            const link = document.createElement('a');
            link.href = fileUrl;
            link.download = file.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }}
        >
          <FileDown className="w-4 h-4" />
          {t('export_btn')}
        </Button>
      </CardHeader>
      <CardContent className="flex-1 min-h-[300px] flex items-center justify-center p-4 bg-muted/30 rounded-b-xl overflow-hidden relative group">
        {isImage ? (
          <img 
            src={fileUrl} 
            alt="Uploaded Report" 
            className="max-w-full max-h-[500px] object-contain rounded-md shadow-sm transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <iframe 
            src={fileUrl} 
            title="PDF Report" 
            className="w-full h-[500px] rounded-md border-0 bg-white"
          />
        )}
      </CardContent>
    </Card>
  );
}
