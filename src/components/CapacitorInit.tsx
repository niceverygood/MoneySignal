'use client';

import { useEffect, useState } from 'react';

export function CapacitorInit() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    import('@/lib/capacitor').then(({ initCapacitor, registerPushNotifications, setupPushDeepLinks, setupNetworkListener, isNative, platform }) => {
      initCapacitor();

      if (isNative) {
        // 푸시 등록 + 토큰 서버 전송
        registerPushNotifications().then(async (token) => {
          if (!token) return;
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

        // 푸시 딥링크 설정
        setupPushDeepLinks();

        // 네트워크 상태 감지
        setupNetworkListener((connected) => {
          setOffline(!connected);
        });
      }
    });
  }, []);

  if (offline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] bg-[#FF5252] text-white text-center text-xs py-1.5 font-medium">
        네트워크 연결이 끊겼습니다. 시그널을 받으려면 인터넷에 연결해주세요.
      </div>
    );
  }

  return null;
}
