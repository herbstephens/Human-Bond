import { NextRequest, NextResponse } from 'next/server';

const APP_ID = 'app_bfc3261816aeadc589f9c6f80a98f5df';
const WORLD_NOTIFY_URL = 'https://developer.world.org/api/v2/minikit/send-notification';

type NotificationType =
    | 'dissolution_requested'
    | 'dissolution_cancelled'
    | 'dissolution_executed'
    | 'proposal_received'
    | 'proposal_accepted'
    | 'proposal_rejected';

const NOTIFICATIONS: Record<NotificationType, { title: string; message: string; path: string }> = {
    dissolution_requested: {
        title: '⚠️ Dissolution Requested',
        message: 'Your partner requested to dissolve the bond. Open HumanBond to review.',
        path: '/home',
    },
    dissolution_cancelled: {
        title: '✋ Dissolution Cancelled',
        message: 'Your partner cancelled the dissolution request. The bond remains active.',
        path: '/home',
    },
    dissolution_executed: {
        title: '💔 Bond Dissolved',
        message: 'The bond has been dissolved on Worldchain.',
        path: '/home',
    },
    proposal_received: {
        title: '🤝 Bond Proposal',
        message: 'You received a bond proposal. Tap to review.',
        path: '/marriage/proposals',
    },
    proposal_accepted: {
        title: '✅ Bond Accepted',
        message: 'Your proposal was accepted. The bond is now active.',
        path: '/home',
    },
    proposal_rejected: {
        title: '❌ Proposal Rejected',
        message: 'Your bond proposal was declined.',
        path: '/home',
    },
};

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null);
    const { walletAddress, type } = body ?? {};

    if (!walletAddress || !type || !(type in NOTIFICATIONS)) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    if (!process.env.WORLDCOIN_API_KEY) {
        return NextResponse.json({ error: 'Notification service not configured' }, { status: 503 });
    }

    const content = NOTIFICATIONS[type as NotificationType];

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
                    message: content.message,
                },
            ],
            mini_app_path: `worldapp://mini-app?app_id=${APP_ID}&path=${content.path}`,
        }),
    });

    const data = await res.json().catch(() => ({}));
    console.log('[notify] World API response:', res.status, JSON.stringify(data));
    return NextResponse.json(data, { status: res.ok ? 200 : 502 });
}
