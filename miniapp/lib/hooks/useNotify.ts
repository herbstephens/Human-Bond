import type { NotificationParams, NotificationType } from '@/lib/notifications/types';

export type { NotificationType, NotificationParams };

export async function sendNotification(
    walletAddress: string,
    type: NotificationType,
    params?: NotificationParams,
): Promise<void> {
    try {
        const res = await fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress, type, params }),
        });
        const data = await res.json().catch(() => ({}));
        console.log('[notify] sent', type, 'to', walletAddress, '→', res.status, data);
    } catch (err) {
        console.error('[notify] failed', type, err);
    }
}
