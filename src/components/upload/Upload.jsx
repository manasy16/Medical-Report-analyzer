import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload as UploadIcon, FileText, AlertCircle, TrendingUp, LogIn, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import useAppStore from '../../store/useAppStore';
import { uploadReport, getReportResult } from '../../services/api';
import MemberSelector from '../dashboard/MemberSelector';

export default function Upload() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    file,
    setFile,
    setUploadStatus,
    setReportId,
    setResultData,
    setError,
    error,
    uploadStatus,
    language,
    user,
    selectedMemberId
  } = useAppStore();

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles?.length > 0) {
      setFile(acceptedFiles[0]);
      setError(null);
    }
  }, [setFile, setError]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    },
    maxFiles: 1
  });

  const localFile = file;

  const handleUpload = async () => {
    if (!localFile) return;

    setError(null);
    setUploadStatus('processing');

    try {
      const data = await uploadReport(localFile, language, selectedMemberId);
      const jobId = data.job_id;
      setReportId(jobId);

      const result = await getReportResult(jobId);
      if (result.status === 'done') {
        setResultData(result);
        setUploadStatus('completed');
      } else {
        throw new Error(result.error || 'Analysis failed');
      }
    } catch (err) {
      console.error('Upload Error:', err);
      const msg = err.response?.data?.detail || err.message || t('error_upload', 'Upload failed. Please try again.');
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto mt-4 animate-in fade-in zoom-in duration-500">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2 text-foreground">
          {t('upload_title', 'Analyze Your Medical Report')}
        </h1>
        <p className="text-muted-foreground text-lg">{t('upload_subtitle', 'Instant AI-powered insights for your family health.')}</p>
      </div>

      <MemberSelector />

      {!user && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-medium text-sm">Save & Track History</p>
              <p className="text-xs text-muted-foreground">Sign in to track health trends over time for your whole family.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/login')} className="shrink-0 gap-2">
            <LogIn className="w-4 h-4" /> Sign In
          </Button>
        </div>
      )}

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
                <p className="text-lg font-medium mb-1">{t('upload_desc', 'Drop your report here')}</p>
                <p className="text-sm text-muted-foreground mb-1">Supports PDF, JPG, PNG up to 10MB</p>
                <p className="text-xs text-primary/70 font-medium mb-6">{t('supported_types')}</p>
                <Button type="button" variant="outline" className="px-8 shadow-sm">
                  Choose File
                </Button>
              </>
            ) : (
              <div className="w-full flex flex-col items-center">
                <div className="relative group w-full max-w-md p-6 rounded-xl border bg-card flex items-center gap-4 shadow-sm mb-8 transition-transform hover:scale-[1.02]">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold truncate">{localFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(localFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>

                <div className="flex gap-4 w-full max-w-md">
                  <Button variant="outline" className="flex-1" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                    Cancel
                  </Button>
                  <Button
                    onClick={(e) => { e.stopPropagation(); handleUpload(); }}
                    disabled={uploadStatus === 'processing'}
                    className="flex-1 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all gap-2"
                  >
                    {uploadStatus === 'processing' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Analyzing...
                      </>
                    ) : (
                      'Analyze Report'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="mt-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-3 text-destructive animate-in slide-in-from-top-2 duration-300">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}
    </div>
  );
}
