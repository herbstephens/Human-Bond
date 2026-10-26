#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, AuthorizedFunction, IssuerFlags, Ledger, MockAuth, MockAuthInvoke, StellarAssetContract},
    token::{StellarAssetClient, TokenClient},
    vec, Address, BytesN, Env, IntoVal, String, Symbol, Vec,
};

const THRESHOLD: i128 = 10 * UNIT;
const DAILY: i128 = 25 * UNIT;
const DELAY: u64 = 3 * 24 * 60 * 60;
const DAY: u64 = 24 * 60 * 60;
const HEARTBEAT: u64 = 90 * DAY;
const CHALLENGE: u64 = 30 * DAY;

struct Setup<'a> {
    env: Env,
    a: Address,
    b: Address,
    vault: BondVaultClient<'a>,
    usdc: TokenClient<'a>,
    usdc_admin: StellarAssetClient<'a>,
    usdc_sac: StellarAssetContract,
}

fn setup() -> Setup<'static> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|l| l.timestamp = 1_000_000);

    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let usdc = TokenClient::new(&env, &sac.address());
    let usdc_admin = StellarAssetClient::new(&env, &sac.address());

    let id = env.register(
        BondVault,
        (
            a.clone(),
            b.clone(),
            sac.address(),
            BytesN::from_array(&env, &[0xab; 32]),
            BytesN::from_array(&env, &[0xcd; 20]),
            String::from_str(&env, "alice-ben"),
            THRESHOLD,
            DAILY,
            DELAY,
            HEARTBEAT,
            CHALLENGE,
        ),
    );
    let vault = BondVaultClient::new(&env, &id);
    usdc_admin.mint(&id, &(100 * UNIT));
    Setup { env, a, b, vault, usdc, usdc_admin, usdc_sac: sac }
}

fn advance(env: &Env, seconds: u64) {
    env.ledger().with_mut(|l| l.timestamp += seconds);
}

#[test]
fn small_spend_executes_on_one_signature() {
    let s = setup();
    let shop = Address::generate(&s.env);
    let id = s.vault.propose_spend(&s.a, &shop, &(10 * UNIT));

    // Only A's authorization was needed.
    let auths = s.env.auths();
    assert_eq!(auths.len(), 1);
    assert_eq!(auths[0].0, s.a);
    match &auths[0].1.function {
        AuthorizedFunction::Contract((_, name, _)) => assert_eq!(name, &Symbol::new(&s.env, "propose_spend")),
        other => panic!("unexpected auth {other:?}"),
    }

    assert_eq!(s.usdc.balance(&shop), 10 * UNIT);
    assert_eq!(s.vault.get_spend(&id).status, SpendStatus::Executed);
    assert_eq!(s.vault.remaining_free_allowance(), 15 * UNIT);
}

#[test]
fn large_spend_needs_the_other_partner() {
    let s = setup();
    let shop = Address::generate(&s.env);
    let id = s.vault.propose_spend(&s.a, &shop, &(30 * UNIT));
    assert_eq!(s.usdc.balance(&shop), 0);
    assert_eq!(s.vault.get_spend(&id).status, SpendStatus::Pending);

    // The proposer cannot count twice.
    assert_eq!(s.vault.try_approve_spend(&s.a, &id), Err(Ok(VaultError::AlreadyApproved.into())));

    s.vault.approve_spend(&s.b, &id);
    assert_eq!(s.usdc.balance(&shop), 30 * UNIT);
    assert_eq!(s.vault.get_spend(&id).status, SpendStatus::Executed);
    // A two-signature spend does not use the free budget.
    assert_eq!(s.vault.remaining_free_allowance(), DAILY);
}

#[test]
fn daily_budget_bounds_one_partner_and_resets_after_24h() {
    let s = setup();
    let shop = Address::generate(&s.env);
    s.vault.propose_spend(&s.a, &shop, &(10 * UNIT));
    s.vault.propose_spend(&s.b, &shop, &(10 * UNIT)); // shared budget, not per partner
    let third = s.vault.propose_spend(&s.a, &shop, &(10 * UNIT));
    assert_eq!(s.vault.get_spend(&third).status, SpendStatus::Pending);
    assert_eq!(s.usdc.balance(&shop), 20 * UNIT);

    advance(&s.env, FREE_WINDOW);
    let fourth = s.vault.propose_spend(&s.a, &shop, &(10 * UNIT));
    assert_eq!(s.vault.get_spend(&fourth).status, SpendStatus::Executed);
    assert_eq!(s.usdc.balance(&shop), 30 * UNIT);
}

#[test]
fn outsiders_cannot_spend_or_approve() {
    let s = setup();
    let mallory = Address::generate(&s.env);
    assert_eq!(s.vault.try_propose_spend(&mallory, &mallory, &UNIT), Err(Ok(VaultError::NotPartner.into())));
    let id = s.vault.propose_spend(&s.a, &mallory, &(50 * UNIT));
    assert_eq!(s.vault.try_approve_spend(&mallory, &id), Err(Ok(VaultError::NotPartner.into())));
    assert_eq!(s.vault.try_propose_spend(&s.a, &mallory, &0), Err(Ok(VaultError::ZeroAmount.into())));
}

#[test]
fn either_partner_can_cancel_a_pending_spend() {
    let s = setup();
    let shop = Address::generate(&s.env);
    let id = s.vault.propose_spend(&s.a, &shop, &(50 * UNIT));
    s.vault.cancel_spend(&s.b, &id);
    assert_eq!(s.vault.get_spend(&id).status, SpendStatus::Cancelled);
    assert_eq!(s.vault.try_approve_spend(&s.b, &id), Err(Ok(VaultError::SpendNotPending.into())));
    assert_eq!(s.vault.try_cancel_spend(&s.a, &id), Err(Ok(VaultError::SpendNotPending.into())));
}

#[test]
fn dissolution_waits_for_the_delay_then_books_50_50_claims() {
    let s = setup();
    // Odd balance: 100 USDC + 1 unit.
    s.usdc_admin.mint(&s.vault.address, &1);

    assert_eq!(s.vault.try_execute_dissolution(), Err(Ok(VaultError::NoDissolutionRequest.into())));
    s.vault.request_dissolution(&s.a);
    assert_eq!(s.vault.try_request_dissolution(&s.b), Err(Ok(VaultError::DissolutionAlreadyRequested.into())));
    assert_eq!(s.vault.try_execute_dissolution(), Err(Ok(VaultError::DissolutionDelayNotMet.into())));
    assert_eq!(s.vault.try_cancel_dissolution(&s.b), Err(Ok(VaultError::NotRequester.into())));
    // Nothing is owed before the split.
    assert_eq!(s.vault.try_claim_share(&s.a), Err(Ok(VaultError::NothingToClaim.into())));

    // Spending still works while the clock runs, as on World Chain.
    let shop = Address::generate(&s.env);
    s.vault.propose_spend(&s.b, &shop, &(10 * UNIT));

    advance(&s.env, DELAY);
    // Matured: the requester can no longer back out.
    assert_eq!(s.vault.try_cancel_dissolution(&s.a), Err(Ok(VaultError::DissolutionDelayOver.into())));

    // Executing books the split and moves nothing.
    s.vault.execute_dissolution();
    let half = (90 * UNIT + 1) / 2;
    assert!(s.vault.is_dissolved());
    assert_eq!(s.vault.dissolution(), None);
    assert_eq!(s.vault.owed(&s.a), half);
    assert_eq!(s.vault.owed(&s.b), 90 * UNIT + 1 - half); // B takes the odd unit
    assert_eq!(s.usdc.balance(&s.a), 0);
    assert_eq!(s.vault.balance(), 90 * UNIT + 1);

    // Anyone can deliver a share, and it only ever goes to that partner.
    let stranger = Address::generate(&s.env);
    assert_eq!(s.vault.claim_share(&s.a), half);
    s.vault.claim_share(&s.b);
    assert_eq!(s.usdc.balance(&s.a), half);
    assert_eq!(s.usdc.balance(&s.b), 90 * UNIT + 1 - half);
    assert_eq!(s.usdc.balance(&stranger), 0);
    assert_eq!(s.vault.balance(), 0);
    assert_eq!(s.vault.try_claim_share(&s.a), Err(Ok(VaultError::NothingToClaim.into())));
    assert_eq!(s.vault.try_claim_share(&stranger), Err(Ok(VaultError::NotPartner.into())));

    // Closed: no more spending.
    assert_eq!(s.vault.try_propose_spend(&s.a, &shop, &UNIT), Err(Ok(VaultError::Dissolved.into())));

    // Money that arrives later is never trapped: anyone books it again, each claims their half.
    s.usdc_admin.mint(&s.vault.address, &(4 * UNIT));
    s.vault.execute_dissolution();
    assert_eq!(s.vault.owed(&s.a), 2 * UNIT);
    s.vault.claim_share(&s.a);
    assert_eq!(s.usdc.balance(&s.a), half + 2 * UNIT);
}

#[test]
fn one_partner_who_cannot_receive_does_not_block_the_other() {
    let s = setup();
    s.vault.request_dissolution(&s.a);
    advance(&s.env, DELAY);
    s.vault.execute_dissolution();

    // B's balance is frozen (stands in for a missing or deauthorized trustline on testnet).
    s.usdc_sac.issuer().set_flag(IssuerFlags::RevocableFlag);
    s.usdc_admin.set_authorized(&s.b, &false);
    assert!(s.vault.try_claim_share(&s.b).is_err());
    // B's share is still booked, untouched by the failed call.
    assert_eq!(s.vault.owed(&s.b), 50 * UNIT);

    // A is not held up.
    s.vault.claim_share(&s.a);
    assert_eq!(s.usdc.balance(&s.a), 50 * UNIT);

    // Once B can receive again, B's half arrives.
    s.usdc_admin.set_authorized(&s.b, &true);
    s.vault.claim_share(&s.b);
    assert_eq!(s.usdc.balance(&s.b), 50 * UNIT);
    assert_eq!(s.vault.balance(), 0);
}

#[test]
fn rescue_moves_other_tokens_with_both_signatures() {
    let s = setup();
    let other = s.env.register_stellar_asset_contract_v2(Address::generate(&s.env));
    StellarAssetClient::new(&s.env, &other.address()).mint(&s.vault.address, &(7 * UNIT));
    let dest = Address::generate(&s.env);

    s.vault.rescue(&other.address(), &dest, &(7 * UNIT));
    // Both partners had to authorize it (read before any other call replaces the record).
    let signers: std::vec::Vec<Address> = s.env.auths().into_iter().map(|(who, _)| who).collect();
    assert!(signers.contains(&s.a) && signers.contains(&s.b));
    assert_eq!(TokenClient::new(&s.env, &other.address()).balance(&dest), 7 * UNIT);

    // The vault's own token never leaves this way, before or after dissolution.
    assert_eq!(
        s.vault.try_rescue(&s.usdc.address, &dest, &UNIT),
        Err(Ok(VaultError::VaultTokenNotRescuable.into()))
    );
    assert_eq!(s.vault.try_rescue(&other.address(), &dest, &0), Err(Ok(VaultError::ZeroAmount.into())));
}

#[test]
fn rescue_fails_with_only_one_signature() {
    let s = setup();
    let other = s.env.register_stellar_asset_contract_v2(Address::generate(&s.env));
    StellarAssetClient::new(&s.env, &other.address()).mint(&s.vault.address, &UNIT);
    let dest = Address::generate(&s.env);

    // Only A signs.
    s.env.mock_auths(&[MockAuth {
        address: &s.a,
        invoke: &MockAuthInvoke {
            contract: &s.vault.address,
            fn_name: "rescue",
            args: (other.address(), dest.clone(), UNIT).into_val(&s.env),
            sub_invokes: &[],
        },
    }]);
    assert!(s.vault.try_rescue(&other.address(), &dest, &UNIT).is_err());
    assert_eq!(TokenClient::new(&s.env, &other.address()).balance(&dest), 0);
}

#[test]
fn requester_can_cancel_during_the_delay() {
    let s = setup();
    s.vault.request_dissolution(&s.b);
    advance(&s.env, DELAY - 1);
    s.vault.cancel_dissolution(&s.b);
    assert_eq!(s.vault.dissolution(), None);
    advance(&s.env, 10);
    assert_eq!(s.vault.try_execute_dissolution(), Err(Ok(VaultError::NoDissolutionRequest.into())));
}

#[test]
fn pending_spends_die_with_the_bond() {
    let s = setup();
    let shop = Address::generate(&s.env);
    let id = s.vault.propose_spend(&s.a, &shop, &(50 * UNIT));
    s.vault.request_dissolution(&s.a);
    advance(&s.env, DELAY);
    s.vault.execute_dissolution();
    assert_eq!(s.vault.try_approve_spend(&s.b, &id), Err(Ok(VaultError::Dissolved.into())));
    assert_eq!(s.usdc.balance(&shop), 0);
}

#[test]
fn constructor_rejects_bad_parameters() {
    let env = Env::default();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let token = env.register_stellar_asset_contract_v2(Address::generate(&env)).address();
    let args = |p_b: &Address, threshold: i128, daily: i128, delay: u64, heartbeat: u64, challenge: u64| {
        (
            a.clone(),
            p_b.clone(),
            token.clone(),
            BytesN::from_array(&env, &[1; 32]),
            BytesN::from_array(&env, &[2; 20]),
            String::from_str(&env, "x"),
            threshold,
            daily,
            delay,
            heartbeat,
            challenge,
        )
    };
    let cases = [
        args(&a, THRESHOLD, DAILY, DELAY, HEARTBEAT, CHALLENGE), // same partner twice
        args(&b, MAX_SMALL_SPEND_THRESHOLD + 1, DAILY, DELAY, HEARTBEAT, CHALLENGE), // threshold above the cap
        args(&b, THRESHOLD, MAX_DAILY_FREE_LIMIT + 1, DELAY, HEARTBEAT, CHALLENGE), // budget above the cap
        args(&b, THRESHOLD, DAILY, 0, HEARTBEAT, CHALLENGE), // no dissolution delay
        args(&b, THRESHOLD, DAILY, MAX_DISSOLUTION_DELAY + 1, HEARTBEAT, CHALLENGE), // delay too long
        args(&b, THRESHOLD, DAILY, DELAY, 0, CHALLENGE), // no check-in interval
        args(&b, THRESHOLD, DAILY, DELAY, MAX_HEARTBEAT_INTERVAL + 1, CHALLENGE), // interval too long
        args(&b, THRESHOLD, DAILY, DELAY, HEARTBEAT, 0), // no challenge window
    ];
    for case in cases {
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            env.register(BondVault, case.clone());
        }));
        assert!(result.is_err());
    }
    // And a sane one goes through.
    let id = env.register(BondVault, args(&b, THRESHOLD, DAILY, DELAY, HEARTBEAT, CHALLENGE));
    let cfg: Config = env.invoke_contract(&id, &Symbol::new(&env, "config"), ().into_val(&env));
    assert_eq!(cfg.small_spend_threshold, THRESHOLD);
}

/* ------------------------------ inheritance ------------------------------ */

fn heir(env: &Env, who: &Address, bps: u32, unlock_at: u64) -> Heir {
    let _ = env;
    Heir { heir: who.clone(), bps, unlock_at }
}

/// Lapse and confirm one partner's death with no check-in in between.
fn let_die(s: &Setup, who: &Address) {
    let last = s.vault.last_seen(who);
    let now = s.env.ledger().timestamp();
    if now < last + HEARTBEAT {
        advance(&s.env, last + HEARTBEAT - now);
    }
    s.vault.report_lapse(who);
    advance(&s.env, CHALLENGE);
    s.vault.confirm_death(who);
}

#[test]
fn will_needs_both_partners_and_valid_shares() {
    let s = setup();
    let (c1, c2) = (Address::generate(&s.env), Address::generate(&s.env));

    s.vault.set_will(&vec![&s.env, heir(&s.env, &c1, 6_000, 0), heir(&s.env, &c2, 4_000, 0)]);
    let signers: std::vec::Vec<Address> = s.env.auths().into_iter().map(|(who, _)| who).collect();
    assert!(signers.contains(&s.a) && signers.contains(&s.b));
    assert_eq!(s.vault.will().len(), 2);

    let bad = |heirs: Vec<Heir>| s.vault.try_set_will(&heirs);
    assert_eq!(bad(vec![&s.env, heir(&s.env, &c1, 6_000, 0)]), Err(Ok(VaultError::BadWill.into()))); // not 100%
    assert_eq!(bad(vec![&s.env, heir(&s.env, &s.a, 10_000, 0)]), Err(Ok(VaultError::BadWill.into()))); // a partner
    assert_eq!(bad(vec![&s.env, heir(&s.env, &c1, 5_000, 0), heir(&s.env, &c1, 5_000, 0)]), Err(Ok(VaultError::BadWill.into()))); // duplicate
    assert_eq!(bad(vec![&s.env, heir(&s.env, &c1, 10_000, 0), heir(&s.env, &c2, 0, 0)]), Err(Ok(VaultError::BadWill.into()))); // zero share
    assert_eq!(bad(Vec::new(&s.env)), Err(Ok(VaultError::BadWill.into())));
}

#[test]
fn will_fails_with_only_one_signature() {
    let s = setup();
    let c1 = Address::generate(&s.env);
    let heirs = vec![&s.env, heir(&s.env, &c1, 10_000, 0)];
    s.env.mock_auths(&[MockAuth {
        address: &s.a,
        invoke: &MockAuthInvoke { contract: &s.vault.address, fn_name: "set_will", args: (heirs.clone(),).into_val(&s.env), sub_invokes: &[] },
    }]);
    assert!(s.vault.try_set_will(&heirs).is_err());
    assert_eq!(s.vault.will().len(), 0);
}

#[test]
fn lapse_needs_the_interval_and_any_check_in_cancels_it() {
    let s = setup();
    assert_eq!(s.vault.try_report_lapse(&s.a), Err(Ok(VaultError::NotLapsed.into())));

    advance(&s.env, HEARTBEAT);
    s.vault.report_lapse(&s.a);
    assert_eq!(s.vault.try_report_lapse(&s.a), Err(Ok(VaultError::LapseAlreadyReported.into())));
    assert_eq!(s.vault.try_confirm_death(&s.a), Err(Ok(VaultError::ChallengeWindowOpen.into())));

    // "I'm alive": any signed action cancels — here a spend, not even an explicit heartbeat.
    advance(&s.env, CHALLENGE - 1);
    let shop = Address::generate(&s.env);
    s.vault.propose_spend(&s.a, &shop, &UNIT);
    assert_eq!(s.vault.lapse(&s.a), None);
    advance(&s.env, 10);
    assert_eq!(s.vault.try_confirm_death(&s.a), Err(Ok(VaultError::NoLapse.into())));
    assert!(!s.vault.is_deceased(&s.a));

    // An explicit heartbeat resets the clock too.
    advance(&s.env, HEARTBEAT - 5);
    s.vault.heartbeat(&s.a);
    advance(&s.env, 10);
    assert_eq!(s.vault.try_report_lapse(&s.a), Err(Ok(VaultError::NotLapsed.into())));
}

#[test]
fn first_death_survivor_owns_the_vault_and_the_will_is_locked() {
    let s = setup();
    let c1 = Address::generate(&s.env);
    s.vault.set_will(&vec![&s.env, heir(&s.env, &c1, 10_000, 0)]);
    let shop = Address::generate(&s.env);
    // A spend waiting for A's approval when A dies.
    let waiting = s.vault.propose_spend(&s.b, &shop, &(30 * UNIT));
    s.vault.request_dissolution(&s.b);

    // B keeps checking in; A does not.
    advance(&s.env, HEARTBEAT);
    s.vault.heartbeat(&s.b);
    s.vault.report_lapse(&s.a);
    advance(&s.env, CHALLENGE);
    s.vault.confirm_death(&s.a);
    assert!(s.vault.is_deceased(&s.a));
    assert_eq!(s.vault.dissolution(), None); // death ended the pending dissolution

    // The survivor alone: any amount, at once; and the waiting spend can be pushed through.
    s.vault.propose_spend(&s.b, &shop, &(40 * UNIT));
    assert_eq!(s.usdc.balance(&shop), 40 * UNIT);
    s.vault.approve_spend(&s.b, &waiting);
    assert_eq!(s.usdc.balance(&shop), 70 * UNIT);

    // Locked: no rewriting the will, no dissolving against the dead, the dead can't act.
    assert_eq!(s.vault.try_set_will(&vec![&s.env, heir(&s.env, &shop, 10_000, 0)]), Err(Ok(VaultError::PartnerDeceased.into())));
    assert_eq!(s.vault.try_request_dissolution(&s.b), Err(Ok(VaultError::PartnerDeceased.into())));
    assert_eq!(s.vault.try_heartbeat(&s.a), Err(Ok(VaultError::PartnerDeceased.into())));
    assert_eq!(s.vault.will().get(0).unwrap().heir, c1);
}

#[test]
fn second_death_books_the_estate_and_heirs_claim_when_unlocked() {
    let s = setup();
    let adult = Address::generate(&s.env);
    // A child's own bond vault can be an heir too — any address works; this one is a contract.
    let child_vault = Address::generate(&s.env);
    let minor = Address::generate(&s.env);
    let unlock = s.env.ledger().timestamp() + 5 * 365 * DAY;
    s.vault.set_will(&vec![
        &s.env,
        heir(&s.env, &adult, 5_000, 0),
        heir(&s.env, &child_vault, 3_000, 0),
        heir(&s.env, &minor, 2_000, unlock),
    ]);
    s.usdc_admin.mint(&s.vault.address, &1); // 100 USDC + 1 unit: dust goes to the last heir

    let_die(&s, &s.a);
    assert_eq!(s.vault.estate_owed(&adult), 0); // nothing for heirs while B lives
    let_die(&s, &s.b);

    assert_eq!(s.vault.estate_owed(&adult), 50 * UNIT);
    assert_eq!(s.vault.estate_owed(&child_vault), 30 * UNIT);
    assert_eq!(s.vault.estate_owed(&minor), 20 * UNIT + 1);

    // Anyone can deliver; it only ever goes to that heir.
    assert_eq!(s.vault.claim_inheritance(&adult), 50 * UNIT);
    s.vault.claim_inheritance(&child_vault);
    assert_eq!(s.usdc.balance(&adult), 50 * UNIT);
    assert_eq!(s.usdc.balance(&child_vault), 30 * UNIT);
    assert_eq!(s.vault.try_claim_inheritance(&adult), Err(Ok(VaultError::NothingToClaim.into())));
    let stranger = Address::generate(&s.env);
    assert_eq!(s.vault.try_claim_inheritance(&stranger), Err(Ok(VaultError::NotAnHeir.into())));

    // The minor's share waits for its date.
    assert_eq!(s.vault.try_claim_inheritance(&minor), Err(Ok(VaultError::InheritanceLocked.into())));
    advance(&s.env, unlock - s.env.ledger().timestamp());
    s.vault.claim_inheritance(&minor);
    assert_eq!(s.usdc.balance(&minor), 20 * UNIT + 1);
    assert_eq!(s.vault.balance(), 0);

    // Late arrivals are booked the same way.
    s.usdc_admin.mint(&s.vault.address, &(10 * UNIT));
    s.vault.book_late_estate();
    assert_eq!(s.vault.estate_owed(&adult), 5 * UNIT);
}

#[test]
fn both_lapse_together_and_the_heirs_inherit() {
    let s = setup();
    let c1 = Address::generate(&s.env);
    s.vault.set_will(&vec![&s.env, heir(&s.env, &c1, 10_000, 0)]);
    advance(&s.env, HEARTBEAT);
    s.vault.report_lapse(&s.a);
    s.vault.report_lapse(&s.b);
    advance(&s.env, CHALLENGE);
    s.vault.confirm_death(&s.b);
    s.vault.confirm_death(&s.a);
    assert_eq!(s.vault.estate_owed(&c1), 100 * UNIT);
    s.vault.claim_inheritance(&c1);
    assert_eq!(s.usdc.balance(&c1), 100 * UNIT);
}

#[test]
fn no_will_means_nothing_is_claimable_after_both_deaths() {
    let s = setup();
    let_die(&s, &s.a);
    let_die(&s, &s.b);
    let anyone = Address::generate(&s.env);
    assert_eq!(s.vault.try_claim_inheritance(&anyone), Err(Ok(VaultError::NotAnHeir.into())));
    assert_eq!(s.vault.balance(), 100 * UNIT);
}

#[test]
fn a_dissolved_vault_has_no_inheritance() {
    let s = setup();
    s.vault.request_dissolution(&s.a);
    advance(&s.env, DELAY);
    s.vault.execute_dissolution();
    advance(&s.env, HEARTBEAT);
    assert_eq!(s.vault.try_report_lapse(&s.a), Err(Ok(VaultError::Dissolved.into())));
    let c1 = Address::generate(&s.env);
    assert_eq!(s.vault.try_set_will(&vec![&s.env, heir(&s.env, &c1, 10_000, 0)]), Err(Ok(VaultError::Dissolved.into())));
}
