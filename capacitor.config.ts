import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.moneysignal.kr',
  appName: 'MoneySignal',
  // 웹뷰가 Vercel 배포 URL을 로드 (서버사이드 기능 유지)
  server: {
    url: 'https://money-signal.vercel.app',
    cleartext: false,
    allowNavigation: [
      'efgjkkywysbxebfwmlbj.supabase.co',
      '*.supabase.co',
      'kauth.kakao.com',
      'accounts.kakao.com',
      'appleid.apple.com',
      '*.apple.com',
      'money-signal.vercel.app',
    ],
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#000000',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#000000',
    },
    Keyboard: {
      resize: 'body' as unknown as import('@capacitor/keyboard').KeyboardResize,
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  ios: {
    // CSS의 env(safe-area-inset-*) 로 안전영역을 직접 관리하므로
    // 네이티브 자동 인셋은 끔(이중 여백 방지). viewport-fit=cover 와 짝.
    contentInset: 'never',
    preferredContentMode: 'mobile',
    scheme: 'MoneySignal',
    backgroundColor: '#000000',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#000000',
  },
};

export default config;
