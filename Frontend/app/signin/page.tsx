'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Brain, ArrowRight, GraduationCap, ShieldCheck, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';
import gsap from 'gsap';

export default function SignInPage() {
  const router = useRouter();
  const { signIn, signInDemo, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Mount animation
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Set initial hidden state via GSAP (not Tailwind opacity-0)
      gsap.set('.signin-animate', { opacity: 0, y: 24 });
      gsap.to('.signin-animate', {
        y: 0,
        opacity: 1,
        duration: 0.7,
        stagger: 0.09,
        ease: 'power3.out',
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Please enter your email and password');
      return;
    }
    clearError();
    await signIn(email.trim(), password);
    const state = useAuthStore.getState();
    if (state.user) {
      toast.success('Signed in successfully', { duration: 5000 });
      router.push(state.user.role === 'admin' ? '/admin/dashboard' : '/dashboard');
    } else if (state.error) {
      toast.error(state.error);
    }
  };

  const handleDemoSignIn = (role: 'student' | 'admin') => {
    signInDemo(role);
    toast.success(`Signed in as ${role}`, { duration: 5000 });
    router.push(role === 'admin' ? '/admin/dashboard' : '/dashboard');
  };

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-screen items-center justify-center bg-background px-4"
    >
      {/* Subtle background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="signin-animate flex flex-col items-center gap-2">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 border border-brand/20 transition-colors duration-200 group-hover:bg-brand/20">
              <Brain className="h-5 w-5 text-brand" />
            </div>
            <span className="text-xl font-semibold tracking-tight">MSOT</span>
          </Link>
          <p className="text-sm text-muted-foreground">
            Sign in to continue your interview prep
          </p>
        </div>

        {/* Card */}
        <div className="signin-animate rounded-2xl border border-border bg-card p-7 shadow-sm space-y-6">
          <h2 className="text-lg font-semibold">Welcome back</h2>

          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="h-10 transition-shadow duration-200 focus:shadow-[0_0_0_3px_hsl(var(--brand)/0.12)]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="h-10 pr-10 transition-shadow duration-200 focus:shadow-[0_0_0_3px_hsl(var(--brand)/0.12)]"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
              <p className="rounded-lg bg-destructive/8 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" variant="brand" className="w-full group h-10" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or quick access</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Quick Access buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDemoSignIn('student')}
              disabled={isLoading}
              className="group h-10 border-border text-foreground hover:border-brand hover:bg-brand hover:text-white transition-all"
            >
              <GraduationCap className="mr-1.5 h-4 w-4 text-brand group-hover:text-white transition-colors" />
              <span className="text-sm font-medium">Student</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDemoSignIn('admin')}
              disabled={isLoading}
              className="group h-10 border-border text-foreground hover:border-brand hover:bg-brand hover:text-white transition-all"
            >
              <ShieldCheck className="mr-1.5 h-4 w-4 text-brand group-hover:text-white transition-colors" />
              <span className="text-sm font-medium">Admin</span>
            </Button>
          </div>
        </div>

        {/* Footer link */}
        <p className="signin-animate text-center text-sm text-muted-foreground">
          No account?{' '}
          <Link href="/signup" className="font-medium text-brand hover:underline underline-offset-4">
            Create one free
          </Link>
        </p>

        <p className="signin-animate text-center text-xs text-muted-foreground/60">
          Secure enterprise authentication powered by Supabase.
        </p>
      </div>
    </div>
  );
}
