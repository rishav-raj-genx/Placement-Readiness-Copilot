import './globals.css';
import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/sonner';
import { CustomCursor } from '@/components/ui/CustomCursor';
import { GeistSans } from 'geist/font/sans';
import { displayFont } from '@/lib/fonts';

export const metadata: Metadata = {
  title: {
    default: 'Hireable',
    template: '%s | Hireable',
  },
  description:
    'A single workspace for candidate readiness, profile review, interviews, and job applications.',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${displayFont.variable}`} suppressHydrationWarning>
      <body className={`${GeistSans.className} min-h-screen bg-background antialiased`}>
        <Providers>
          <CustomCursor />
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
