import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Shield, Zap, Heart, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';

export default function Landing({ onStart }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-20 pb-20 animate-in fade-in duration-1000">
      {/* Hero Section */}
      <section className="relative grid grid-cols-1 lg:grid-cols-2 gap-12 items-center pt-10">
        <div className="flex flex-col gap-6 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium w-fit">
            <Zap className="w-4 h-4" />
            <span>AI-Powered Medical Report Intelligence</span>
          </div>
          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight leading-tight">
            Understand Your <span className="text-primary">Medical Reports</span> in Seconds
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed max-w-lg">
            Upload your medical test results and get instant, clear, and actionable insights. No more medical jargon, just clarity for you and your family.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <Button size="lg" className="h-14 px-8 text-lg gap-2 shadow-lg shadow-primary/25" onClick={onStart}>
              Analyze Report <ArrowRight className="w-5 h-5" />
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-8 text-lg" onClick={() => navigate('/signup')}>
              Sign Up for History tracking
            </Button>
          </div>
          <div className="flex items-center gap-6 mt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" /> Secure & Private
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" /> Multi-lingual support
            </div>
          </div>
        </div>

        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary to-blue-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative aspect-square rounded-2xl overflow-hidden border border-white/20 shadow-2xl">
            <img 
              src="/healthcare_hero.png" 
              alt="Medical AI Intelligence" 
              className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-105"
            />
          </div>
          {/* Floating badge */}
          <div className="absolute -bottom-6 -left-6 glass-card p-4 rounded-xl shadow-xl flex items-center gap-4 animate-bounce-subtle">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-green-600">
              <Heart className="w-6 h-6" fill="currentColor" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold">Health First</p>
              <p className="text-xs text-muted-foreground">AI-vetted insights</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="glass-card p-8 rounded-2xl border-primary/10 hover:border-primary/30 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-6">
            <Shield className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold mb-3">Privacy Protected</h3>
          <p className="text-muted-foreground">Your medical data is processed securely and never shared with third parties.</p>
        </div>
        <div className="glass-card p-8 rounded-2xl border-primary/10 hover:border-primary/30 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-6">
            <Zap className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold mb-3">Instant Analysis</h3>
          <p className="text-muted-foreground">Get results in under 30 seconds using our high-performance Gemini 2.0 AI pipeline.</p>
        </div>
        <div className="glass-card p-8 rounded-2xl border-primary/10 hover:border-primary/30 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-6">
            <Languages className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold mb-3">Hindi & Hinglish</h3>
          <p className="text-muted-foreground">Reports are available in English, Hindi, and Hinglish for better accessibility.</p>
        </div>
      </section>
    </div>
  );
}

// Helper for Languages icon since it wasn't imported
function Languages(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 8 6 6" />
      <path d="m4 14 6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2h1" />
      <path d="m22 22-5-10-5 10" />
      <path d="M14 18h6" />
    </svg>
  )
}
