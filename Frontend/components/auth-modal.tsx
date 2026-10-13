'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/auth-store';
import { useAuthModalStore } from '@/stores/auth-modal-store';
import { toast } from 'sonner';
import { Brain, ArrowRight, GraduationCap, ShieldCheck, Loader2, UserPlus, LogOut, Eye, EyeOff } from 'lucide-react';

export function AuthModal() {
  const router = useRouter();
  const { isOpen, redirectUrl, close } = useAuthModalStore();
  const { user, signIn, signUp, signInDemo, signOut, isLoading, error, clearError } = useAuthStore();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      clearError();
      setShowPassword(false);
      close();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!email.trim() || !password) {
      toast.error('Please enter your email and password');
      return;
    }

    if (mode === 'signup') {
      if (!displayName.trim()) {
        toast.error('Please enter your display name');
        return;
      }
      await signUp(email.trim(), password, displayName.trim());
    } else {
      await signIn(email.trim(), password);
    }

    const state = useAuthStore.getState();
    if (state.user) {
      const message = mode === 'signup' ? 'Account created successfully' : 'Signed in successfully';
      toast.success(message, { duration: 5000 });
      close();
      const target = state.user.role === 'admin' ? '/admin/dashboard' : (redirectUrl || '/dashboard');
      router.push(target);
    } else if (state.error) {
      toast.error(state.error);
    }
  };

  const handleDemoSignIn = (role: 'student' | 'admin') => {
    clearError();
    signInDemo(role);
    toast.success(`Signed in as ${role}`, { duration: 5000 });
    close();
    const target = role === 'admin' ? '/admin/dashboard' : (redirectUrl || '/dashboard');
    router.push(target);
  };

  const handleSignOutAndReset = async () => {
    await signOut();
    toast.success('Signed out. Please sign in with your credentials.', { duration: 4000 });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px] p-6 gap-0 overflow-hidden rounded-2xl border-border bg-card shadow-2xl">
        <DialogHeader className="space-y-3 text-center items-center pb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 border border-brand/20 shadow-sm">
            <Brain className="h-6 w-6 text-brand" />
          </div>
          <div>
            <DialogTitle className="text-xl font-bold tracking-tight">
              {user ? 'Account Status' : mode === 'signin' ? 'Sign In Required' : 'Create an Account'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              {user
                ? 'You currently have an active session in this browser.'
                : 'Please sign in to start your AI interview preparation session and get personalized feedback.'}
            </DialogDescription>
          </div>
        </DialogHeader>

        {user ? (
          /* Active User State in Modal */
          <div className="space-y-4 pt-1 pb-2">
            <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 text-center space-y-1.5">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                Active Session
              </p>
              <p className="text-base font-semibold text-foreground">
                {user.displayName || user.email}
              </p>
              <div className="flex justify-center gap-1.5 pt-1">
                <span className="inline-block rounded-full bg-brand/15 px-2.5 py-0.5 text-[11px] font-medium text-brand capitalize">
                  {user.role} role
                </span>
                <span className="inline-block rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </div>

            <Button
              variant="brand"
              className="w-full h-10 font-medium group"
              onClick={() => {
                close();
                const target = user.role === 'admin' ? '/admin/dashboard' : (redirectUrl || '/dashboard');
                router.push(target);
              }}
            >
              Continue as {user.displayName?.split(' ')[0] || 'User'}
              <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Button>

            <Button
              type="button"
              variant="outline"
              className="group w-full h-9 border-border text-foreground text-xs hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
              onClick={handleSignOutAndReset}
            >
              <LogOut className="mr-2 h-3.5 w-3.5 text-muted-foreground group-hover:text-destructive transition-colors" />
              Sign Out / Switch Account
            </Button>
          </div>
        ) : (
          /* Unauthenticated Sign In / Sign Up Form */
          <>
            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 rounded-lg bg-muted p-1 mb-5 text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  clearError();
                }}
                className={`rounded-md py-1.5 transition-all duration-200 ${
                  mode === 'signin'
                    ? 'bg-background text-foreground shadow-sm font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  clearError();
                }}
                className={`rounded-md py-1.5 transition-all duration-200 ${
                  mode === 'signup'
                    ? 'bg-background text-foreground shadow-sm font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Credentials Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode === 'signup' && (
                <div className="space-y-1">
                  <Label htmlFor="modal-name" className="text-xs font-medium">
                    Full Name
                  </Label>
                  <Input
                    id="modal-name"
                    type="text"
                    placeholder="Alex Johnson"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={isLoading}
                    className="h-9 text-sm"
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="modal-email" className="text-xs font-medium">
                  Email
                </Label>
                <Input
                  id="modal-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="modal-password" className="text-xs font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="modal-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="h-9 text-sm pr-9"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <p className="rounded-lg bg-destructive/10 border border-destructive/20 p-2 text-xs text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" variant="brand" className="w-full h-10 mt-2 font-medium" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {mode === 'signup' ? 'Creating Account...' : 'Signing In...'}
                  </>
                ) : mode === 'signup' ? (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create Account
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">or quick access</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Quick Access Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleDemoSignIn('student')}
                disabled={isLoading}
                className="group h-9 border-border text-foreground hover:border-brand hover:bg-brand hover:text-white transition-all text-xs font-medium"
              >
                <GraduationCap className="mr-1.5 h-3.5 w-3.5 text-brand group-hover:text-white transition-colors" />
                <span>Student</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleDemoSignIn('admin')}
                disabled={isLoading}
                className="group h-9 border-border text-foreground hover:border-brand hover:bg-brand hover:text-white transition-all text-xs font-medium"
              >
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-brand group-hover:text-white transition-colors" />
                <span>Admin</span>
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
