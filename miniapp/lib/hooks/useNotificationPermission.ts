'use client';

import { MiniKit, Permission } from '@worldcoin/minikit-js';
import { useCallback, useEffect, useState } from 'react';
import { isInWorldApp } from '@/lib/worldcoin/initMiniKit';

export type NotificationPermissionStatus = 'loading' | 'granted' | 'not_granted' | 'not_world_app';

export function useNotificationPermission() {
    const [status, setStatus] = useState<NotificationPermissionStatus>('loading');

    useEffect(() => {
        if (!isInWorldApp()) {
            // Synchronous setState is intentional here: SSR renders 'loading',
            // and a lazy initializer would cause a hydration mismatch.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setStatus('not_world_app');
            return;
        }
        MiniKit.commandsAsync.getPermissions()
            .then(({ finalPayload }) => {
                const granted =
                    finalPayload?.status === 'success' &&
                    (finalPayload as { permissions?: { notifications?: boolean } }).permissions?.notifications === true;
                setStatus(granted ? 'granted' : 'not_granted');
            })
            .catch(() => setStatus('not_granted'));
    }, []);

    const requestPermission = useCallback(async () => {
        if (!isInWorldApp()) return;
        try {
            const { finalPayload } = await MiniKit.commandsAsync.requestPermission({
                permission: Permission.Notifications,
            });
            setStatus(finalPayload?.status === 'success' ? 'granted' : 'not_granted');
        } catch {
            setStatus('not_granted');
        }
    }, []);

    return { status, requestPermission };
}
