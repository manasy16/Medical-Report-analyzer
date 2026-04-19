import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslation } from 'react-i18next';
import { Upload as UploadIcon, File as FileIcon, X, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import useAppStore from '../../store/useAppStore';
import { uploadReport, getReportResult } from '../../services/api';

export default function Upload() {
  const { t } = useTranslation();
  const { setFile, setReportId, setUploadStatus, setResultData, setError, error } = useAppStore();
  const [localFile, setLocalFile] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles?.length > 0) {
      setLocalFile(acceptedFiles[0]);
      setError(null);
    }
  }, [setError]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    },
    maxFiles: 1
  });

  const handleUpload = async () => {
    if (!localFile) return;
    
    setFile(localFile);
    setUploadStatus('processing');
    setError(null);

    try {
      // 1. Upload and wait for full processing
      const uploadResp = await uploadReport(localFile);
      const jobId = uploadResp.job_id;
      setReportId(jobId);

      // 2. Immediately fetch the result
      const resultResp = await getReportResult(jobId);
      
      if (resultResp.status === 'failed') {
        setError(resultResp.error || t('error_process'));
        setUploadStatus('error');
        return;
      }

      setResultData(resultResp);
      setUploadStatus('completed');
    } catch (err) {
      console.error(err);
      setError(t('error_upload'));
      setUploadStatus('error');
    }
  };

  const removeFile = (e) => {
    e.stopPropagation();
    setLocalFile(null);
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-12 animate-in fade-in zoom-in duration-500">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2 text-foreground">
          {t('upload_title')}
        </h1>
        <p className="text-muted-foreground">{t('upload_desc')}</p>
      </div>

      <Card className="glass-card overflow-hidden">
        <CardContent className="p-0">
          <div
            {...getRootProps()}
            className={`
              relative p-12 text-center cursor-pointer transition-all duration-300
              flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/50'}
              ${localFile ? 'border-none bg-background' : ''}
            `}
          >
            <input {...getInputProps()} />
            
            {!localFile ? (
              <>
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <UploadIcon className="w-10 h-10 text-primary" />
                </div>
                <p className="text-lg font-medium mb-1">{t('upload_desc')}</p>
                <p className="text-sm text-muted-foreground mb-6">Supports PDF, JPG, PNG up to 10MB</p>
                <Button type="button" variant="outline" className="px-8 shadow-sm">
                  {t('upload_btn')}
                </Button>
              </>
            ) : (
              <div className="w-full flex flex-col items-center">
                <div className="relative group w-full max-w-md p-6 rounded-xl border bg-card flex items-center gap-4 shadow-sm mb-8 transition-transform hover:scale-[1.02]">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileIcon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold truncate">{localFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(localFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button
                    onClick={removeFile}
                    className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <Button onClick={(e) => { e.stopPropagation(); handleUpload(); }} size="lg" className="w-full max-w-md shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all">
                  Analyze Report
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="mt-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-3 animate-in slide-in-from-bottom-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}
    </div>
  );
}
