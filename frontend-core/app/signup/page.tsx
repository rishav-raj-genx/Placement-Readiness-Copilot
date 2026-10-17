'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Brain, ArrowRight, Loader2, Check, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';
import gsap from 'gsap';

const perks = [
  '3 free AI mock interview sessions',
  'Personalised feedback & scoring',
  'Application tracker & job board',
];

function SignUpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo');

  const { signUp, isLoading, error, clearError } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Mount animation
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.set('.signup-animate', { opacity: 0, y: 24 });
      gsap.to('.signup-animate', {
        y: 0,
        opacity: 1,
        duration: 0.7,
        stagger: 0.09,
        ease: 'power3.out',
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) {
      toast.error('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    clearError();
    const result = await signUp(email.trim(), password, name.trim());
    const state = useAuthStore.getState();
    if (result === 'authenticated' && state.user) {
      toast.success('Account created successfully');
      const target =
        redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//') && !redirectTo.startsWith('/admin')
          ? redirectTo
          : '/dashboard';
      router.push(target);
    } else if (result === 'confirmation_required') {
      toast.success('Check your email to confirm your account, then sign in.');
      router.push('/signin');
    } else if (state.error) {
      toast.error(state.error);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-screen items-center justify-center bg-background px-4 py-10"
    >
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="signup-animate flex flex-col items-center gap-2">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 border border-brand/20 transition-colors duration-200 group-hover:bg-brand/20">
              <Brain className="h-5 w-5 text-brand" />
            </div>
            <span className="text-xl font-semibold tracking-tight">MSOT</span>
          </Link>
          <p className="text-sm text-muted-foreground">
            Create your account to start practising
          </p>
        </div>

        {/* Perks strip */}
        <div className="signup-animate">
          <ul className="space-y-1.5">
            {perks.map((p) => (
              <li key={p} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand/15">
                  <Check className="h-2.5 w-2.5 text-brand" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        {/* Card */}
        <div className="signup-animate rounded-2xl border border-border bg-card p-7 shadow-sm space-y-6">
          <h2 className="text-lg font-semibold">Create account</h2>

          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium">
                Display Name
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                className="h-10 transition-shadow duration-200 focus:shadow-[0_0_0_3px_hsl(var(--brand)/0.12)]"
              />
            </div>
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
                  placeholder="At least 6 characters"
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
                  Creating account...
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Footer links */}
        <p className="signup-animate text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            href={redirectTo ? `/signin?redirectTo=${encodeURIComponent(redirectTo)}` : '/signin'}
            className="font-medium text-brand hover:underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>

        <p className="signup-animate text-center text-xs text-muted-foreground/60">
          Your account is secured by Supabase authentication. New accounts are created as students.
        </p>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <SignUpContent />
    </Suspense>
  );
}
