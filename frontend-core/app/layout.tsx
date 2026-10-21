import './globals.css';
import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/sonner';
import CustomCursor from '@/components/ui/CustomCursor';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Hireable',
    template: '%s | Hireable',
  },
  description: 'Autonomous Placement Readiness Platform',
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
    <html lang="en" className={`dark ${manrope.variable}`} suppressHydrationWarning>
      <body className={`${manrope.className} min-h-screen bg-stone-950 text-stone-200 antialiased`}>
        <div
          className="pointer-events-none fixed inset-0 z-50 opacity-5"
          aria-hidden="true"
        >
          <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <filter id="noiseFilter">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.8"
                numOctaves="3"
                stitchTiles="stitch"
              />
            </filter>
            <rect width="100%" height="100%" filter="url(#noiseFilter)" />
          </svg>
        </div>
        <CustomCursor />
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
