import { Capacitor } from '@capacitor/core';

/** 현재 네이티브 앱(iOS/Android)에서 실행 중인지 */
export const isNative = Capacitor.isNativePlatform();

/** 플랫폼 ('ios' | 'android' | 'web') */
export const platform = Capacitor.getPlatform();

/** 네이티브 앱에서만 Capacitor 플러그인 초기화 */
export async function initCapacitor() {
  if (!isNative) return;

  // StatusBar
  const { StatusBar, Style } = await import('@capacitor/status-bar');
  await StatusBar.setStyle({ style: Style.Dark });
  if (platform === 'android') {
    await StatusBar.setBackgroundColor({ color: '#000000' });
  }

  // Keyboard (모바일 키보드 동작 개선)
  const { Keyboard } = await import('@capacitor/keyboard');
  Keyboard.addListener('keyboardWillShow', () => {
    document.body.classList.add('keyboard-open');
  });
  Keyboard.addListener('keyboardWillHide', () => {
    document.body.classList.remove('keyboard-open');
  });

  // SplashScreen 숨김
  const { SplashScreen } = await import('@capacitor/splash-screen');
  await SplashScreen.hide();
}

/** 푸시 알림 권한 요청 + 토큰 반환 */
export async function registerPushNotifications(): Promise<string | null> {
  if (!isNative) return null;

  const { PushNotifications } = await import('@capacitor/push-notifications');

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return null;

  await PushNotifications.register();

  return new Promise((resolve) => {
    PushNotifications.addListener('registration', (token) => {
      resolve(token.value);
    });
    PushNotifications.addListener('registrationError', () => {
      resolve(null);
    });
  });
}
