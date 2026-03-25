'use client';

import { useEffect } from 'react';

export function CapacitorInit() {
  useEffect(() => {
    import('@/lib/capacitor').then(({ initCapacitor, registerPushNotifications, isNative, platform }) => {
      initCapacitor();

      // 네이티브 앱에서만 푸시 알림 등록
      if (isNative) {
        registerPushNotifications().then(async (token) => {
          if (!token) return;

          // 서버에 토큰 저장
          try {
            await fetch('/api/push/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token, platform }),
            });
          } catch (err) {
            console.error('[Push] Token registration failed:', err);
          }
        });
      }
    });
  }, []);

  return null;
}
