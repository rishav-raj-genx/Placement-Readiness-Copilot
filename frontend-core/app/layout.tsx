import './globals.css';
import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/sonner';
import CustomCursor from '@/components/ui/CustomCursor';
import { displayFont } from '@/lib/fonts';

export const metadata: Metadata = {
  title: {
    default: 'Hireable Copilot',
    template: '%s | Hireable Copilot',
  },
  description:
    'A single workspace for candidate readiness, profile review, interviews, and job applications.',
  icons: {
    icon: '/icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${displayFont.variable}`} suppressHydrationWarning>
      <body className={`${displayFont.className} min-h-screen bg-background antialiased`}>
        <CustomCursor />
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
