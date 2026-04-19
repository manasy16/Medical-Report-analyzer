import React from 'react';
import Navbar from './components/layout/Navbar';
import Upload from './components/upload/Upload';
import Processing from './components/processing/Processing';
import Dashboard from './components/dashboard/Dashboard';
import useAppStore from './store/useAppStore';

function App() {
  const { uploadStatus } = useAppStore();

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30">
      {/* Decorative background elements */}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background" />
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10 mix-blend-multiply" />
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl -z-10 mix-blend-multiply" />

      <Navbar />

      <main className="container mx-auto px-4 py-8">
        {(uploadStatus === 'idle' || uploadStatus === 'error') && <Upload />}
        {(uploadStatus === 'uploading' || uploadStatus === 'processing') && <Processing />}
        {uploadStatus === 'completed' && <Dashboard />}
      </main>
    </div>
  );
}

export default App;
