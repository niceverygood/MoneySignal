import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.moneysignal.kr',
  appName: 'MoneySignal',
  // 웹뷰가 Vercel 배포 URL을 로드 (서버사이드 기능 유지)
  server: {
    url: 'https://money-signal.vercel.app',
    cleartext: false,
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
    contentInset: 'always',
    preferredContentMode: 'mobile',
    scheme: 'MoneySignal',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#000000',
  },
};

export default config;
