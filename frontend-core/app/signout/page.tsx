'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function SignOutPage() {
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);

  useEffect(() => {
    (async () => {
      await signOut();
      toast.success('Signed out successfully');
      router.replace('/signin');
    })();
  }, [signOut, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-brand" />
      <p className="text-sm text-muted-foreground">Signing you out...</p>
    </div>
  );
}
