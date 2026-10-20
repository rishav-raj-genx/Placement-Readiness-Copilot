import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#1a1310] px-4 text-center">
      <p className="font-mono text-xs uppercase tracking-wider text-[#D93829]">404 error</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-stone-100 sm:text-4xl">
        Page not found
      </h1>
      <p className="mt-2 text-sm text-stone-400 max-w-sm">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link href="/dashboard" className="mt-6">
        <Button className="rounded-lg bg-[#D93829] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#C22F21]">
          Return to dashboard
        </Button>
      </Link>
    </div>
  );
}
