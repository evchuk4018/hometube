import type { Metadata, Viewport } from 'next';
import { PwaRegistration } from '@/components/pwa-registration';
import { basePath } from '@/lib/app-path';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'HomeTube', template: '%s · HomeTube' },
  description: 'Download and stream YouTube videos from your homelab.',
  manifest: `${basePath}/manifest.webmanifest`,
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'HomeTube' },
  icons: { icon: `${basePath}/icon.svg`, apple: `${basePath}/icon.svg` }
};

export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#050505', colorScheme: 'dark'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><PwaRegistration />{children}</body></html>;
}

