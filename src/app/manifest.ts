import type { MetadataRoute } from 'next';
import { basePath } from '@/lib/app-path';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HomeTube', short_name: 'HomeTube', description: 'Your private homelab video player',
    start_url: `${basePath}/`, scope: `${basePath}/`, display: 'standalone',
    background_color: '#050505', theme_color: '#050505', orientation: 'any',
    icons: [
      { src: `${basePath}/icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: `${basePath}/maskable-icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
    ]
  };
}

