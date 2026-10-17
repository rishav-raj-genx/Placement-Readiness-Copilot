import './globals.css';
import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: 'MSOT — AI-Powered Interview Preparation',
  description:
    'Practise realistic interviews with AI, strengthen your answers, and discover what to improve before the real thing.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
