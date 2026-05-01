import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Mail, Lock, Loader2, ArrowLeft } from 'lucide-react';
import { signup } from '../../services/api';
import useAppStore from '../../store/useAppStore';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/card';
import { Input } from '../../components/ui/input';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const { setUser, setToken } = useAppStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const data = await signup(email, password);
      setToken(data.access_token);
      setUser(data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Link to="/" className="absolute top-8 left-8 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      <Card className="glass-card w-full max-w-md border-primary/20">
        <CardHeader className="space-y-1">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 mx-auto border border-primary/20">
            <UserPlus className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center font-bold">Create Account</CardTitle>
          <CardDescription className="text-center">
            Start tracking health trends for you and your family
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="name@example.com"
                  className="pl-10 h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Password"
                  className="pl-10 h-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Confirm Password"
                  className="pl-10 h-11"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Create Account
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4 pt-0">
          <div className="text-sm text-center text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
