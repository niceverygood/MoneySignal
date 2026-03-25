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

/** 햅틱 피드백 */
export async function haptic(style: 'light' | 'medium' | 'heavy' = 'medium') {
  if (!isNative) return;
  const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
  const styleMap = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
  await Haptics.impact({ style: styleMap[style] });
}

export async function hapticNotification(type: 'success' | 'warning' | 'error' = 'success') {
  if (!isNative) return;
  const { Haptics, NotificationType } = await import('@capacitor/haptics');
  const typeMap = { success: NotificationType.Success, warning: NotificationType.Warning, error: NotificationType.Error };
  await Haptics.notification({ type: typeMap[type] });
}

/** 딥링크 — 푸시 알림 탭 시 해당 페이지로 이동 */
export function setupPushDeepLinks() {
  if (!isNative) return;

  import('@capacitor/push-notifications').then(({ PushNotifications }) => {
    // 앱이 열린 상태에서 푸시 수신
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] Received:', notification);
    });

    // 푸시 탭하여 앱 진입
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = action.notification.data;
      if (data?.signalId) {
        window.location.href = `/app/signals/${data.signalId}`;
      } else if (data?.type === 'new_signal') {
        window.location.href = '/app';
      }
    });
  });
}

/** 네트워크 상태 감지 */
export async function setupNetworkListener(
  onStatusChange: (connected: boolean) => void
) {
  if (!isNative) return;
  const { Network } = await import('@capacitor/network');

  const status = await Network.getStatus();
  onStatusChange(status.connected);

  Network.addListener('networkStatusChange', (s) => {
    onStatusChange(s.connected);
  });
}

/** 앱 리뷰 요청 (StoreKit) */
export async function requestAppReview() {
  if (!isNative) return;
  try {
    const { App } = await import('@capacitor/app');
    // Capacitor App 플러그인은 직접 리뷰 API가 없음
    // iOS에서는 SKStoreReviewController를 웹뷰 JS로 트리거할 수 없으므로
    // App Store URL로 이동
    if (platform === 'ios') {
      window.open('https://apps.apple.com/app/id(앱ID)?action=write-review', '_blank');
    }
    console.log('[App] Review requested', App);
  } catch {
    console.error('[App] Review request failed');
  }
}

/** 생체인증 (Face ID / Touch ID) */
export async function checkBiometric(): Promise<boolean> {
  if (!isNative) return false;
  try {
    const { NativeBiometric } = await import('capacitor-native-biometric');
    const result = await NativeBiometric.isAvailable();
    return result.isAvailable;
  } catch {
    return false;
  }
}

export async function authenticateWithBiometric(): Promise<boolean> {
  if (!isNative) return true; // 웹에서는 항상 통과
  try {
    const { NativeBiometric } = await import('capacitor-native-biometric');
    await NativeBiometric.verifyIdentity({
      reason: '머니시그널 앱 잠금 해제',
      title: '인증 필요',
    });
    return true;
  } catch {
    return false;
  }
}
