import { NextRequest, NextResponse } from 'next/server';
import type { NotificationParams, NotificationType } from '@/lib/notifications/types';

const APP_ID = 'app_925d0aaa3d9464e5d61690d94a68b401';
const WORLD_NOTIFY_URL = 'https://developer.world.org/api/v2/minikit/send-notification';

type NotificationContent = {
    title: string;
    /** A function so bodies can name the amount — "45.00 USDC" beats "an amount". */
    message: (params: NotificationParams) => string;
    path: (params: NotificationParams) => string;
};

const NOTIFICATIONS: Record<NotificationType, NotificationContent> = {
    dissolution_requested: {
        title: '⚠️ Dissolution Requested',
        message: () => 'Your partner requested to dissolve the bond. Open HumanBond to review.',
        path: () => '/home',
    },
    dissolution_cancelled: {
        title: '✋ Dissolution Cancelled',
        message: () => 'Your partner cancelled the dissolution request. The bond remains active.',
        path: () => '/home',
    },
    dissolution_executed: {
        title: '💔 Bond Dissolved',
        message: () => 'The bond has been dissolved. Your shared wallet was split 50/50.',
        path: () => '/home',
    },
    proposal_received: {
        title: '🤝 Bond Proposal',
        message: () => 'You received a bond proposal. Tap to review.',
        path: () => '/marriage/proposals',
    },
    proposal_accepted: {
        title: '✅ Bond Accepted',
        message: () => 'Your proposal was accepted. The bond is now active.',
        path: () => '/home',
    },
    proposal_rejected: {
        title: '❌ Proposal Rejected',
        message: () => 'Your bond proposal was declined.',
        path: () => '/home',
    },
    vault_created: {
        title: '🔐 Shared Wallet Created',
        message: () => 'Your bond now has a shared wallet. Tap to see it.',
        path: () => '/vault',
    },
    vault_spend_proposed: {
        title: '✍️ Your signature is needed',
        message: (p) =>
            p.amount
                ? `Your partner wants to send ${p.amount} ${p.token ?? 'USDC'} from your shared wallet. It needs your approval.`
                : 'Your partner proposed a payment from your shared wallet. It needs your approval.',
        path: (p) => (p.spendId ? `/vault/pending/${p.spendId}` : '/vault'),
    },
    vault_spend_approved: {
        title: '✅ Payment Approved',
        message: (p) =>
            p.amount ? `Your partner approved the ${p.amount} ${p.token ?? 'USDC'} payment. It has been sent.` : 'Your partner approved the payment. It has been sent.',
        path: () => '/vault',
    },
    vault_spend_cancelled: {
        title: '🚫 Payment Cancelled',
        message: () => 'A pending payment from your shared wallet was cancelled.',
        path: () => '/vault',
    },
    vault_spend_executed: {
        title: '💸 Payment Sent',
        message: (p) =>
            p.amount ? `${p.amount} ${p.token ?? 'USDC'} was sent from your shared wallet.` : 'A payment was sent from your shared wallet.',
        path: () => '/vault',
    },
};

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null);
    const { walletAddress, type, params } = body ?? {};

    if (!walletAddress || !type || !(type in NOTIFICATIONS)) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    if (!process.env.WORLDCOIN_API_KEY) {
        return NextResponse.json({ error: 'Notification service not configured' }, { status: 503 });
    }

    const content = NOTIFICATIONS[type as NotificationType];
    const safeParams: NotificationParams = params ?? {};

    const res = await fetch(WORLD_NOTIFY_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.WORLDCOIN_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            app_id: APP_ID,
            wallet_addresses: [walletAddress],
            localisations: [
                {
                    language: 'en',
                    title: content.title,
                    message: content.message(safeParams),
                },
            ],
            mini_app_path: `worldapp://mini-app?app_id=${APP_ID}&path=${content.path(safeParams)}`,
        }),
    });

    const data = await res.json().catch(() => ({}));
    console.log('[notify] World API response:', res.status, JSON.stringify(data));
    return NextResponse.json(data, { status: res.ok ? 200 : 502 });
}
