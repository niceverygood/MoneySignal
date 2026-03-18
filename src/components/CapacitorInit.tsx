'use client';

import { useEffect } from 'react';

export function CapacitorInit() {
  useEffect(() => {
    import('@/lib/capacitor').then(({ initCapacitor }) => {
      initCapacitor();
    });
  }, []);

  return null;
}
