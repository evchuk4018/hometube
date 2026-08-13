'use client';

import { useEffect } from 'react';
import { appPath } from '@/lib/app-path';

export function PwaRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register(appPath('/sw.js'), { scope: appPath('/') }).catch(() => undefined);
    }
  }, []);
  return null;
}
