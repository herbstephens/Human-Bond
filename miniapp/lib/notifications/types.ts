/**
 * Notification contract shared by the client helper and the API route.
 *
 * Previously duplicated in both places, which meant adding a type in one and
 * forgetting the other silently produced a 400 at runtime.
 */
export type NotificationType =
    // bond lifecycle
    | 'dissolution_requested'
    | 'dissolution_cancelled'
    | 'dissolution_executed'
    | 'proposal_received'
    | 'proposal_accepted'
    | 'proposal_rejected'
    // shared vault
    | 'vault_created'
    | 'vault_spend_proposed'
    | 'vault_spend_approved'
    | 'vault_spend_cancelled'
    | 'vault_spend_executed';

/** Values interpolated into a notification body, e.g. the amount being sent. */
export type NotificationParams = {
    amount?: string;
    token?: string;
    spendId?: string;
};
