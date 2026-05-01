import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, Languages, LogOut, LogIn } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import { Button } from '../ui/button';

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { language, setLanguage, user, logout } = useAppStore();

  useEffect(() => {
    i18n.changeLanguage(language);
  }, [language, i18n]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="bg-primary/10 p-1.5 rounded-lg group-hover:bg-primary/20 transition-colors">
            <Activity className="w-6 h-6 text-primary" />
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            {t('app_title')}
          </span>
        </Link>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-secondary/50 p-1 rounded-lg border border-border/50">
            <Languages className="w-4 h-4 ml-2 text-muted-foreground" />
            <select
              className="bg-transparent border-none focus:ring-0 text-sm font-medium pr-8 cursor-pointer"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="en">English</option>
              <option value="hi">हिंदी</option>
              <option value="hinglish">Hinglish</option>
            </select>
          </div>

          <div className="h-6 w-px bg-border/50 mx-2" />

          {user ? (
            <div className="flex items-center gap-4">
              <div className="hidden md:flex flex-col items-end">
                <span className="text-xs font-medium text-primary">Connected</span>
                <span className="text-sm font-semibold truncate max-w-[150px]">{user.email}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="ghost" size="sm" className="gap-2">
                  <LogIn className="w-4 h-4" /> Sign In
                </Button>
              </Link>
              <Link to="/signup">
                <Button size="sm">Get Started</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
