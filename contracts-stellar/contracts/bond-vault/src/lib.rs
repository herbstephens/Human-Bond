//! BondVault — the couple's shared USDC vault on Stellar.
//!
//! The Soroban counterpart of the EVM `BondVaultModule` (contracts/src/vault/BondVaultModule.sol),
//! with the same rules:
//!
//! - Small spends go through immediately on ONE partner's signature: at most
//!   `small_spend_threshold` per spend and `daily_free_limit` per rolling 24h, shared by both
//!   partners. The rolling budget is what actually bounds one partner: many just-under-threshold
//!   spends cannot get past it.
//! - Anything larger is proposed by one partner and executes when the other approves. Either
//!   partner can cancel a pending spend.
//! - Dissolution mirrors HumanBond on World Chain: one partner requests, a delay runs (the
//!   requester may cancel during it), then anyone can execute and the vault is split 50/50,
//!   with the odd unit to partner B. After that, nothing can be spent; funds arriving later can
//!   be split the same way by anyone, so money is never trapped.
//! - The split is PULL-based: executing books each partner's share, and each share is then
//!   delivered on its own (`claim_share`, callable by anyone, always paying that partner). A
//!   partner who has no USDC trustline, or whose trustline is frozen, can only hold up their own
//!   half — never the other's. Pushing both halves in one call would let one partner block the
//!   whole dissolution, which the EVM module rules out with try/catch.
//! - Tokens other than the vault's token are never stuck: `rescue` moves them out when BOTH
//!   partners sign, as the couple's 2-of-2 Safe can on World Chain.
//!
//! Inheritance — the bond's will, executed (a Berliner Testament as a contract):
//! - Both partners together write the will: up to MAX_HEIRS heirs, each with a share in basis
//!   points and an optional unlock time (a minor's share can wait for a date). An heir can be a
//!   person's account or a contract — e.g. a child's own bond vault, which chains generations.
//! - Proof of life: every authenticated action by a partner counts as a check-in (`heartbeat`
//!   exists for when nothing else happens). Once a partner has not checked in for
//!   `heartbeat_interval`, anyone may report the lapse; a challenge window opens in which ANY
//!   check-in by that partner cancels it. After the window, anyone may confirm the death.
//! - First death: the survivor owns the whole vault — spends of any size go through on the
//!   survivor's signature alone. The will is locked: it needs both partners to change, so the
//!   couple's intent for the heirs cannot be undone by one of them. A pending dissolution ends.
//! - Second death: the whole balance is booked to the heirs by share; each heir's part is
//!   delivered by `claim_inheritance` (anyone may call it; it only ever pays that heir) once its
//!   unlock time has passed. Funds arriving later are booked the same way.
//! - Heirs inherit claims, not keys: nobody ever needs a dead partner's key.
//! Limits, said plainly: check-ins are key signatures (World ID check-ins relayed from World
//! Chain are roadmap); a dissolved vault has no inheritance; with no will written, nothing is
//! claimable after both deaths; this is not a legal will.
//!
//! One instance per bond. Its contract address IS the couple's receiving address: anyone pays
//! in with a plain token transfer, no signature from the couple needed.
//!
//! Differences from the EVM module, on purpose:
//! - Partners are identified by `require_auth` on their Stellar addresses, not msg.sender.
//! - There is no owner. The spend limits are set once at creation, inside the same hard bounds
//!   the EVM owner is held to, and can never change.
//! - No TTL extension in the contract. Extending entries from inside every call cost thousands
//!   of XLM in rent on testnet; entries live for the network's default TTL, and an archived
//!   vault is restored (by anyone, through RPC) before use — the funds are never lost.
//! - Dissolution is local. A Stellar contract cannot see World Chain, so this vault does not
//!   follow the World Chain bond automatically (roadmap: a relay).
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, token,
    Address, BytesN, Env, String, Vec,
};

/// USDC on Stellar has 7 decimals.
const UNIT: i128 = 10_000_000;
/// Same hard bounds as the EVM module's owner-tunable parameters.
pub const MAX_SMALL_SPEND_THRESHOLD: i128 = 100 * UNIT;
pub const MAX_DAILY_FREE_LIMIT: i128 = 250 * UNIT;
pub const FREE_WINDOW: u64 = 24 * 60 * 60;
/// Upper bound on the dissolution delay a vault can be created with.
pub const MAX_DISSOLUTION_DELAY: u64 = 30 * 24 * 60 * 60;
/// Bounds on proof-of-life timing set at creation.
pub const MAX_HEARTBEAT_INTERVAL: u64 = 2 * 365 * 24 * 60 * 60;
pub const MAX_CHALLENGE_WINDOW: u64 = 365 * 24 * 60 * 60;
pub const MAX_HEIRS: u32 = 10;
pub const TOTAL_BPS: u32 = 10_000;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum VaultError {
    SamePartner = 1,
    ParamOutOfBounds = 2,
    NotPartner = 3,
    ZeroAmount = 4,
    SpendNotPending = 5,
    AlreadyApproved = 6,
    Dissolved = 7,
    DissolutionAlreadyRequested = 8,
    NoDissolutionRequest = 9,
    NotRequester = 10,
    DissolutionDelayNotMet = 11,
    DissolutionDelayOver = 12,
    SpendNotFound = 13,
    NothingToClaim = 14,
    VaultTokenNotRescuable = 15,
    PartnerDeceased = 16,
    BadWill = 17,
    NotLapsed = 18,
    LapseAlreadyReported = 19,
    NoLapse = 20,
    ChallengeWindowOpen = 21,
    NotAnHeir = 22,
    InheritanceLocked = 23,
    BothDeceased = 24,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub partner_a: Address,
    pub partner_b: Address,
    pub token: Address,
    /// The bond on World Chain this vault belongs to.
    pub bond_id: BytesN<32>,
    /// The bond's Safe on World Chain.
    pub safe: BytesN<20>,
    /// The ENS label (`<label>.humanbond.eth`).
    pub label: String,
    pub small_spend_threshold: i128,
    pub daily_free_limit: i128,
    pub dissolution_delay: u64,
    /// A partner who has not checked in for this long can be reported as lapsed.
    pub heartbeat_interval: u64,
    /// After a lapse is reported, how long the partner has to check in before death can be confirmed.
    pub challenge_window: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Heir {
    pub heir: Address,
    /// Share of the estate in basis points; all heirs together make 10_000.
    pub bps: u32,
    /// Ledger timestamp before which this heir cannot claim (0 = no wait).
    pub unlock_at: u64,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SpendStatus {
    Pending,
    Executed,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Spend {
    pub to: Address,
    pub amount: i128,
    pub proposer: Address,
    pub created_at: u64,
    pub approved_a: bool,
    pub approved_b: bool,
    pub status: SpendStatus,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FreeWindowState {
    pub start: u64,
    pub spent: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DissolutionRequest {
    pub requester: Address,
    pub requested_at: u64,
}

#[contracttype]
enum DataKey {
    Config,
    FreeWindow,
    SpendNonce,
    Spend(u64),
    Dissolution,
    Dissolved,
    /// A partner's booked, not yet delivered share after dissolution.
    Owed(Address),
    Will,
    LastSeen(Address),
    /// When a partner's lapse was reported (challenge window running).
    Lapse(Address),
    Deceased(Address),
    /// An heir's booked, not yet delivered part of the estate.
    EstateOwed(Address),
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SpendProposed {
    #[topic]
    pub id: u64,
    pub proposer: Address,
    pub to: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SpendApproved {
    #[topic]
    pub id: u64,
    pub approver: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SpendExecuted {
    #[topic]
    pub id: u64,
    pub to: Address,
    pub amount: i128,
    pub was_free_spend: bool,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SpendCancelled {
    #[topic]
    pub id: u64,
    pub canceller: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DissolutionRequested {
    pub requester: Address,
    pub requested_at: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DissolutionCancelled {
    pub requester: Address,
}

/// Shares booked at dissolution (or for funds that arrived after it). Delivered by `claim_share`.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultSplit {
    pub amount_a: i128,
    pub amount_b: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ShareClaimed {
    #[topic]
    pub partner: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WillSet {
    pub heirs: Vec<Heir>,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LapseReported {
    #[topic]
    pub partner: Address,
    pub last_seen: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LapseCancelled {
    #[topic]
    pub partner: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DeathConfirmed {
    #[topic]
    pub partner: Address,
    pub both_deceased: bool,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EstateBooked {
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct InheritanceClaimed {
    #[topic]
    pub heir: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Rescued {
    #[topic]
    pub token: Address,
    pub to: Address,
    pub amount: i128,
}

#[contract]
pub struct BondVault;

fn config(env: &Env) -> Config {
    env.storage().instance().get(&DataKey::Config).unwrap()
}

fn is_dissolved(env: &Env) -> bool {
    env.storage().instance().get(&DataKey::Dissolved).unwrap_or(false)
}

fn require_partner(env: &Env, cfg: &Config, who: &Address) {
    if who != &cfg.partner_a && who != &cfg.partner_b {
        panic_with_error!(env, VaultError::NotPartner);
    }
}

fn other_partner(cfg: &Config, who: &Address) -> Address {
    if who == &cfg.partner_a { cfg.partner_b.clone() } else { cfg.partner_a.clone() }
}

fn is_deceased(env: &Env, who: &Address) -> bool {
    env.storage().instance().get(&DataKey::Deceased(who.clone())).unwrap_or(false)
}

/// A living partner acted with their signature: that is proof of life. Records the check-in and
/// cancels a reported lapse. A partner confirmed dead cannot act.
fn touch(env: &Env, who: &Address) {
    if is_deceased(env, who) {
        panic_with_error!(env, VaultError::PartnerDeceased);
    }
    env.storage().instance().set(&DataKey::LastSeen(who.clone()), &env.ledger().timestamp());
    if env.storage().instance().has(&DataKey::Lapse(who.clone())) {
        env.storage().instance().remove(&DataKey::Lapse(who.clone()));
        LapseCancelled { partner: who.clone() }.publish(env);
    }
}

fn will(env: &Env) -> Vec<Heir> {
    env.storage().instance().get(&DataKey::Will).unwrap_or(Vec::new(env))
}

fn estate_owed(env: &Env, heir: &Address) -> i128 {
    env.storage().instance().get(&DataKey::EstateOwed(heir.clone())).unwrap_or(0)
}

/// After both deaths: book whatever is in the vault and not yet owed to an heir, by share. The
/// last heir takes the rounding dust. With no will, nothing is booked.
fn book_estate(env: &Env, cfg: &Config) {
    let heirs = will(env);
    if heirs.is_empty() {
        return;
    }
    let balance = token::TokenClient::new(env, &cfg.token).balance(&env.current_contract_address());
    let mut owed_total: i128 = 0;
    for h in heirs.iter() {
        owed_total += estate_owed(env, &h.heir);
    }
    let unallocated = balance - owed_total;
    if unallocated <= 0 {
        return;
    }
    let mut booked: i128 = 0;
    let last = heirs.len() - 1;
    for (i, h) in heirs.iter().enumerate() {
        let part = if i as u32 == last { unallocated - booked } else { unallocated * h.bps as i128 / TOTAL_BPS as i128 };
        booked += part;
        let key = DataKey::EstateOwed(h.heir.clone());
        env.storage().instance().set(&key, &(estate_owed(env, &h.heir) + part));
    }
    EstateBooked { amount: unallocated }.publish(env);
}

fn load_spend(env: &Env, id: u64) -> Spend {
    let key = DataKey::Spend(id);
    let spend: Spend = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| panic_with_error!(env, VaultError::SpendNotFound));
    spend
}

fn save_spend(env: &Env, id: u64, spend: &Spend) {
    let key = DataKey::Spend(id);
    env.storage().persistent().set(&key, spend);
}

fn free_window(env: &Env) -> FreeWindowState {
    env.storage()
        .instance()
        .get(&DataKey::FreeWindow)
        .unwrap_or(FreeWindowState { start: 0, spent: 0 })
}

/// Books the amount and returns true if this spend may skip the second approval.
fn consume_free_allowance(env: &Env, cfg: &Config, amount: i128) -> bool {
    if amount > cfg.small_spend_threshold {
        return false;
    }
    let now = env.ledger().timestamp();
    let mut w = free_window(env);
    if now >= w.start + FREE_WINDOW {
        w = FreeWindowState { start: now, spent: 0 };
    }
    if w.spent + amount > cfg.daily_free_limit {
        return false;
    }
    w.spent += amount;
    env.storage().instance().set(&DataKey::FreeWindow, &w);
    true
}

fn execute(env: &Env, cfg: &Config, id: u64, spend: &mut Spend, was_free_spend: bool) {
    spend.status = SpendStatus::Executed; // set before the external call
    save_spend(env, id, spend);
    token::TokenClient::new(env, &cfg.token).transfer(&env.current_contract_address(), &spend.to, &spend.amount);
    SpendExecuted { id, to: spend.to.clone(), amount: spend.amount, was_free_spend }.publish(env);
}

fn owed(env: &Env, partner: &Address) -> i128 {
    env.storage().instance().get(&DataKey::Owed(partner.clone())).unwrap_or(0)
}

/// Book whatever is in the vault and not yet owed to anyone: half to A, the rest (the odd unit
/// included, as in the EVM module) to B. Moves no tokens.
fn book_split(env: &Env, cfg: &Config) {
    let balance = token::TokenClient::new(env, &cfg.token).balance(&env.current_contract_address());
    let owed_a = owed(env, &cfg.partner_a);
    let owed_b = owed(env, &cfg.partner_b);
    let unallocated = balance - owed_a - owed_b;
    if unallocated <= 0 {
        return;
    }
    let amount_a = unallocated / 2;
    let amount_b = unallocated - amount_a;
    env.storage().instance().set(&DataKey::Owed(cfg.partner_a.clone()), &(owed_a + amount_a));
    env.storage().instance().set(&DataKey::Owed(cfg.partner_b.clone()), &(owed_b + amount_b));
    VaultSplit { amount_a, amount_b }.publish(env);
}

#[contractimpl]
impl BondVault {
    #[allow(clippy::too_many_arguments)]
    pub fn __constructor(
        env: Env,
        partner_a: Address,
        partner_b: Address,
        token: Address,
        bond_id: BytesN<32>,
        safe: BytesN<20>,
        label: String,
        small_spend_threshold: i128,
        daily_free_limit: i128,
        dissolution_delay: u64,
        heartbeat_interval: u64,
        challenge_window: u64,
    ) {
        if partner_a == partner_b {
            panic_with_error!(&env, VaultError::SamePartner);
        }
        if !(0..=MAX_SMALL_SPEND_THRESHOLD).contains(&small_spend_threshold)
            || !(0..=MAX_DAILY_FREE_LIMIT).contains(&daily_free_limit)
            || dissolution_delay == 0
            || dissolution_delay > MAX_DISSOLUTION_DELAY
            || heartbeat_interval == 0
            || heartbeat_interval > MAX_HEARTBEAT_INTERVAL
            || challenge_window == 0
            || challenge_window > MAX_CHALLENGE_WINDOW
        {
            panic_with_error!(&env, VaultError::ParamOutOfBounds);
        }
        let cfg = Config {
            partner_a,
            partner_b,
            token,
            bond_id,
            safe,
            label,
            small_spend_threshold,
            daily_free_limit,
            dissolution_delay,
            heartbeat_interval,
            challenge_window,
        };
        let now = env.ledger().timestamp();
        env.storage().instance().set(&DataKey::LastSeen(cfg.partner_a.clone()), &now);
        env.storage().instance().set(&DataKey::LastSeen(cfg.partner_b.clone()), &now);
        env.storage().instance().set(&DataKey::Config, &cfg);
    }

    /// Propose a spend. Executes immediately when it fits the per-spend threshold and the
    /// remaining 24h budget; otherwise it waits for the other partner. Returns the spend id.
    pub fn propose_spend(env: Env, proposer: Address, to: Address, amount: i128) -> u64 {
        proposer.require_auth();
        let cfg = config(&env);
        require_partner(&env, &cfg, &proposer);
        touch(&env, &proposer);
        if is_dissolved(&env) {
            panic_with_error!(&env, VaultError::Dissolved);
        }
        if amount <= 0 {
            panic_with_error!(&env, VaultError::ZeroAmount);
        }

        let id: u64 = env.storage().instance().get(&DataKey::SpendNonce).unwrap_or(0);
        env.storage().instance().set(&DataKey::SpendNonce, &(id + 1));

        let mut spend = Spend {
            to: to.clone(),
            amount,
            proposer: proposer.clone(),
            created_at: env.ledger().timestamp(),
            approved_a: proposer == cfg.partner_a,
            approved_b: proposer == cfg.partner_b,
            status: SpendStatus::Pending,
        };
        save_spend(&env, id, &spend);
        let survivor = is_deceased(&env, &other_partner(&cfg, &proposer));
        SpendProposed { id, proposer, to, amount }.publish(&env);

        if survivor {
            // The survivor owns the vault: no limits, no second signature.
            execute(&env, &cfg, id, &mut spend, false);
        } else if consume_free_allowance(&env, &cfg, amount) {
            execute(&env, &cfg, id, &mut spend, true);
        }
        id
    }

    /// Approve the other partner's pending spend. Executes once both have approved.
    pub fn approve_spend(env: Env, approver: Address, id: u64) {
        approver.require_auth();
        let cfg = config(&env);
        require_partner(&env, &cfg, &approver);
        touch(&env, &approver);
        // After dissolution whatever is left belongs to the split.
        if is_dissolved(&env) {
            panic_with_error!(&env, VaultError::Dissolved);
        }
        let mut spend = load_spend(&env, id);
        if spend.status != SpendStatus::Pending {
            panic_with_error!(&env, VaultError::SpendNotPending);
        }
        let is_a = approver == cfg.partner_a;
        // A survivor may push through a spend that was waiting for the deceased partner.
        if is_deceased(&env, &other_partner(&cfg, &approver)) {
            execute(&env, &cfg, id, &mut spend, false);
            return;
        }
        if (is_a && spend.approved_a) || (!is_a && spend.approved_b) {
            panic_with_error!(&env, VaultError::AlreadyApproved);
        }
        if is_a {
            spend.approved_a = true;
        } else {
            spend.approved_b = true;
        }
        SpendApproved { id, approver }.publish(&env);

        if spend.approved_a && spend.approved_b {
            execute(&env, &cfg, id, &mut spend, false);
        } else {
            save_spend(&env, id, &spend);
        }
    }

    /// Cancel a pending spend. Either partner may — the other partner's "no, and stop asking".
    pub fn cancel_spend(env: Env, caller: Address, id: u64) {
        caller.require_auth();
        let cfg = config(&env);
        require_partner(&env, &cfg, &caller);
        touch(&env, &caller);
        let mut spend = load_spend(&env, id);
        if spend.status != SpendStatus::Pending {
            panic_with_error!(&env, VaultError::SpendNotPending);
        }
        spend.status = SpendStatus::Cancelled;
        save_spend(&env, id, &spend);
        SpendCancelled { id, canceller: caller }.publish(&env);
    }

    /// Start the dissolution clock. Spending stays possible while it runs, as on World Chain.
    pub fn request_dissolution(env: Env, requester: Address) {
        requester.require_auth();
        let cfg = config(&env);
        require_partner(&env, &cfg, &requester);
        touch(&env, &requester);
        if is_dissolved(&env) {
            panic_with_error!(&env, VaultError::Dissolved);
        }
        if is_deceased(&env, &other_partner(&cfg, &requester)) {
            panic_with_error!(&env, VaultError::PartnerDeceased);
        }
        if env.storage().instance().has(&DataKey::Dissolution) {
            panic_with_error!(&env, VaultError::DissolutionAlreadyRequested);
        }
        let requested_at = env.ledger().timestamp();
        env.storage().instance().set(
            &DataKey::Dissolution,
            &DissolutionRequest { requester: requester.clone(), requested_at },
        );
        DissolutionRequested { requester, requested_at }.publish(&env);
    }

    /// Only the requester, and only while the delay is still running. Afterwards the outcome is
    /// fixed — otherwise a matured request could be cancelled the moment someone executes it.
    pub fn cancel_dissolution(env: Env, requester: Address) {
        requester.require_auth();
        let cfg = config(&env);
        require_partner(&env, &cfg, &requester);
        touch(&env, &requester);
        let req: DissolutionRequest = env
            .storage()
            .instance()
            .get(&DataKey::Dissolution)
            .unwrap_or_else(|| panic_with_error!(&env, VaultError::NoDissolutionRequest));
        if req.requester != requester {
            panic_with_error!(&env, VaultError::NotRequester);
        }
        if env.ledger().timestamp() >= req.requested_at + cfg.dissolution_delay {
            panic_with_error!(&env, VaultError::DissolutionDelayOver);
        }
        env.storage().instance().remove(&DataKey::Dissolution);
        DissolutionCancelled { requester }.publish(&env);
    }

    /// Permissionless once the delay has elapsed: close the vault and book a 50/50 split. After
    /// dissolution, anyone may call this again to book funds that arrived later. Moves no
    /// tokens — each share is delivered by `claim_share`.
    pub fn execute_dissolution(env: Env) {
        let cfg = config(&env);
        if !is_dissolved(&env) {
            let req: DissolutionRequest = env
                .storage()
                .instance()
                .get(&DataKey::Dissolution)
                .unwrap_or_else(|| panic_with_error!(&env, VaultError::NoDissolutionRequest));
            if env.ledger().timestamp() < req.requested_at + cfg.dissolution_delay {
                panic_with_error!(&env, VaultError::DissolutionDelayNotMet);
            }
            env.storage().instance().set(&DataKey::Dissolved, &true);
            env.storage().instance().remove(&DataKey::Dissolution);
        }
        book_split(&env, &cfg);
    }

    /// Deliver a partner's booked share to that partner. Anyone may call it — the money can only
    /// ever go to the partner it is owed to — so a keeper or the other partner can finish a split.
    /// If this partner cannot receive (no trustline, frozen), only this call fails.
    pub fn claim_share(env: Env, partner: Address) -> i128 {
        let cfg = config(&env);
        require_partner(&env, &cfg, &partner);
        let amount = owed(&env, &partner);
        if amount <= 0 {
            panic_with_error!(&env, VaultError::NothingToClaim);
        }
        env.storage().instance().set(&DataKey::Owed(partner.clone()), &0i128); // before the transfer
        token::TokenClient::new(&env, &cfg.token).transfer(&env.current_contract_address(), &partner, &amount);
        ShareClaimed { partner, amount }.publish(&env);
        amount
    }

    /// Move a token other than the vault's own out of the vault. Needs BOTH partners' signatures.
    /// The vault's token is refused: it only leaves through the spend rules or the split.
    pub fn rescue(env: Env, token: Address, to: Address, amount: i128) {
        let cfg = config(&env);
        cfg.partner_a.require_auth();
        cfg.partner_b.require_auth();
        touch(&env, &cfg.partner_a);
        touch(&env, &cfg.partner_b);
        if token == cfg.token {
            panic_with_error!(&env, VaultError::VaultTokenNotRescuable);
        }
        if amount <= 0 {
            panic_with_error!(&env, VaultError::ZeroAmount);
        }
        token::TokenClient::new(&env, &token).transfer(&env.current_contract_address(), &to, &amount);
        Rescued { token, to, amount }.publish(&env);
    }

    /* ----------------------------- inheritance ----------------------------- */

    /// Write or replace the will. Needs BOTH partners, alive, before dissolution — so after the
    /// first death the will is locked, as in a Berliner Testament.
    pub fn set_will(env: Env, heirs: Vec<Heir>) {
        let cfg = config(&env);
        cfg.partner_a.require_auth();
        cfg.partner_b.require_auth();
        touch(&env, &cfg.partner_a);
        touch(&env, &cfg.partner_b);
        if is_dissolved(&env) {
            panic_with_error!(&env, VaultError::Dissolved);
        }
        if heirs.is_empty() || heirs.len() > MAX_HEIRS {
            panic_with_error!(&env, VaultError::BadWill);
        }
        let mut total: u32 = 0;
        for (i, h) in heirs.iter().enumerate() {
            if h.bps == 0 || h.heir == cfg.partner_a || h.heir == cfg.partner_b || h.heir == env.current_contract_address() {
                panic_with_error!(&env, VaultError::BadWill);
            }
            for other in heirs.iter().skip(i + 1) {
                if other.heir == h.heir {
                    panic_with_error!(&env, VaultError::BadWill);
                }
            }
            total += h.bps;
        }
        if total != TOTAL_BPS {
            panic_with_error!(&env, VaultError::BadWill);
        }
        env.storage().instance().set(&DataKey::Will, &heirs);
        WillSet { heirs }.publish(&env);
    }

    /// Proof of life when nothing else is happening. Cancels a reported lapse.
    pub fn heartbeat(env: Env, partner: Address) {
        partner.require_auth();
        let cfg = config(&env);
        require_partner(&env, &cfg, &partner);
        touch(&env, &partner);
    }

    /// Anyone may report a partner who has not checked in for `heartbeat_interval`. Opens the
    /// challenge window; any check-in by that partner during it cancels the report.
    pub fn report_lapse(env: Env, partner: Address) {
        let cfg = config(&env);
        require_partner(&env, &cfg, &partner);
        if is_dissolved(&env) {
            panic_with_error!(&env, VaultError::Dissolved);
        }
        if is_deceased(&env, &partner) {
            panic_with_error!(&env, VaultError::PartnerDeceased);
        }
        if env.storage().instance().has(&DataKey::Lapse(partner.clone())) {
            panic_with_error!(&env, VaultError::LapseAlreadyReported);
        }
        let last_seen: u64 = env.storage().instance().get(&DataKey::LastSeen(partner.clone())).unwrap_or(0);
        let now = env.ledger().timestamp();
        if now < last_seen + cfg.heartbeat_interval {
            panic_with_error!(&env, VaultError::NotLapsed);
        }
        env.storage().instance().set(&DataKey::Lapse(partner.clone()), &now);
        LapseReported { partner, last_seen }.publish(&env);
    }

    /// Anyone may confirm a death once the challenge window has passed without a check-in.
    /// First death: the survivor owns the vault and a pending dissolution ends. Second death:
    /// the estate is booked to the heirs.
    pub fn confirm_death(env: Env, partner: Address) {
        let cfg = config(&env);
        require_partner(&env, &cfg, &partner);
        if is_dissolved(&env) {
            panic_with_error!(&env, VaultError::Dissolved);
        }
        let reported: u64 = env
            .storage()
            .instance()
            .get(&DataKey::Lapse(partner.clone()))
            .unwrap_or_else(|| panic_with_error!(&env, VaultError::NoLapse));
        if env.ledger().timestamp() < reported + cfg.challenge_window {
            panic_with_error!(&env, VaultError::ChallengeWindowOpen);
        }
        env.storage().instance().remove(&DataKey::Lapse(partner.clone()));
        env.storage().instance().set(&DataKey::Deceased(partner.clone()), &true);
        env.storage().instance().remove(&DataKey::Dissolution);
        let both = is_deceased(&env, &other_partner(&cfg, &partner));
        DeathConfirmed { partner, both_deceased: both }.publish(&env);
        if both {
            book_estate(&env, &cfg);
        }
    }

    /// After both deaths, anyone may book funds that arrived later to the heirs.
    pub fn book_late_estate(env: Env) {
        let cfg = config(&env);
        if !(is_deceased(&env, &cfg.partner_a) && is_deceased(&env, &cfg.partner_b)) {
            panic_with_error!(&env, VaultError::NoLapse);
        }
        book_estate(&env, &cfg);
    }

    /// Deliver an heir's booked part of the estate to that heir, once its unlock time has
    /// passed. Anyone may call it; it only ever pays that heir.
    pub fn claim_inheritance(env: Env, heir: Address) -> i128 {
        let cfg = config(&env);
        let entry = will(&env)
            .iter()
            .find(|h| h.heir == heir)
            .unwrap_or_else(|| panic_with_error!(&env, VaultError::NotAnHeir));
        if env.ledger().timestamp() < entry.unlock_at {
            panic_with_error!(&env, VaultError::InheritanceLocked);
        }
        let amount = estate_owed(&env, &heir);
        if amount <= 0 {
            panic_with_error!(&env, VaultError::NothingToClaim);
        }
        env.storage().instance().set(&DataKey::EstateOwed(heir.clone()), &0i128); // before the transfer
        token::TokenClient::new(&env, &cfg.token).transfer(&env.current_contract_address(), &heir, &amount);
        InheritanceClaimed { heir, amount }.publish(&env);
        amount
    }

    /* ------------------------------- views ------------------------------- */

    pub fn config(env: Env) -> Config {
        config(&env)
    }

    pub fn balance(env: Env) -> i128 {
        let cfg = config(&env);
        token::TokenClient::new(&env, &cfg.token).balance(&env.current_contract_address())
    }

    pub fn remaining_free_allowance(env: Env) -> i128 {
        let cfg = config(&env);
        let w = free_window(&env);
        if env.ledger().timestamp() >= w.start + FREE_WINDOW {
            return cfg.daily_free_limit;
        }
        (cfg.daily_free_limit - w.spent).max(0)
    }

    pub fn spend_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::SpendNonce).unwrap_or(0)
    }

    pub fn get_spend(env: Env, id: u64) -> Spend {
        load_spend(&env, id)
    }

    pub fn dissolution(env: Env) -> Option<DissolutionRequest> {
        env.storage().instance().get(&DataKey::Dissolution)
    }

    pub fn is_dissolved(env: Env) -> bool {
        is_dissolved(&env)
    }

    /// A partner's booked share not yet delivered (0 before dissolution).
    pub fn owed(env: Env, partner: Address) -> i128 {
        owed(&env, &partner)
    }

    pub fn will(env: Env) -> Vec<Heir> {
        will(&env)
    }

    pub fn last_seen(env: Env, partner: Address) -> u64 {
        env.storage().instance().get(&DataKey::LastSeen(partner)).unwrap_or(0)
    }

    /// When a lapse was reported for this partner, if the challenge window is running.
    pub fn lapse(env: Env, partner: Address) -> Option<u64> {
        env.storage().instance().get(&DataKey::Lapse(partner))
    }

    pub fn is_deceased(env: Env, partner: Address) -> bool {
        is_deceased(&env, &partner)
    }

    /// An heir's booked, not yet delivered part of the estate.
    pub fn estate_owed(env: Env, heir: Address) -> i128 {
        estate_owed(&env, &heir)
    }
}

#[cfg(test)]
mod test;
