// 通知権限の確認
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

// 通知権限のリクエスト
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    return 'denied'
  }

  const permission = await Notification.requestPermission()
  return permission
}

// 通知を表示
export async function showNotification(title: string, options?: NotificationOptions): Promise<void> {
  if (!isNotificationSupported()) {
    console.warn('Notifications not supported')
    return
  }

  const permission = await Notification.requestPermission()

  if (permission === 'granted') {
    new Notification(title, {
      icon: '/icon-192x192.png',
      ...options,
    })
  }
}

// タイマー開始通知
export async function showTimerStartNotification(taskName: string): Promise<void> {
  await showNotification('タイマー開始', {
    body: `「${taskName}」の作業を開始しました`,
    tag: 'timer-start',
    requireInteraction: false,
  })
}

// タイマー停止通知
export async function showTimerStopNotification(taskName: string, duration: string): Promise<void> {
  await showNotification('タイマー停止', {
    body: `「${taskName}」\n作業時間: ${duration}`,
    tag: 'timer-stop',
    requireInteraction: false,
  })
}

// タイマー実行中の継続通知
export async function showTimerProgressNotification(
  taskName: string,
  elapsedTime: string
): Promise<void> {
  await showNotification('作業中', {
    body: `${taskName}\n経過時間: ${elapsedTime}`,
    tag: 'timer-progress',
    requireInteraction: false,
    silent: true,
  })
}

// 通知を閉じる
export function closeNotification(tag: string): void {
  // 既存の通知を閉じる機能は、ブラウザAPIでは直接サポートされていないため
  // タグを使って同じタグの通知は自動的に置き換えられます
}
