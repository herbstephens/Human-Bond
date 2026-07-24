// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {HumanBond} from "../../src/HumanBond.sol";
import {BondNFT} from "../../src/BondNFT.sol";
import {MilestoneNFT} from "../../src/MilestoneNFT.sol";
import {TimeToken} from "../../src/TimeToken.sol";
import {BondVaultModule} from "../../src/vault/BondVaultModule.sol";
import {MockWorldID} from "../utils/MockWorldId.sol";
import {MockSafe} from "../utils/MockSafe.sol";
import {MockUSDC} from "../utils/MockUSDC.sol";

contract BondVaultModuleTest is Test {
    HumanBond humanBond;
    BondVaultModule vaultModule;
    MockUSDC usdc;
    MockSafe safe;

    address leticia = makeAddr("leticia");
    address bob = makeAddr("bob");
    address stranger = makeAddr("stranger");
    address merchant = makeAddr("merchant");

    uint256 constant ROOT = 1;
    uint256[8] proof = [uint256(0), 0, 0, 0, 0, 0, 0, 0];

    uint256 constant THRESHOLD = 10e6; // 10 USDC
    uint256 constant DAILY_LIMIT = 25e6; // 25 USDC
    uint256 constant VAULT_FUNDS = 1000e6;

    bytes32 bondId;

    function setUp() public {
        MockWorldID worldId = new MockWorldID();
        BondNFT bondNft = new BondNFT();
        MilestoneNFT milestoneNft = new MilestoneNFT();
        TimeToken timeToken = new TimeToken();

        humanBond = new HumanBond();
        humanBond.initialize(
            address(worldId),
            address(bondNft),
            address(timeToken),
            address(milestoneNft),
            "app_test",
            "propose-bond",
            "accept-bond"
        );
        milestoneNft.setHumanBondContract(address(humanBond));
        bondNft.setHumanBondContract(address(humanBond));
        timeToken.setMinter(address(humanBond), true);
        humanBond.setDissolutionDelay(3 days);

        usdc = new MockUSDC();
        vaultModule = new BondVaultModule(address(humanBond), address(usdc), THRESHOLD, DAILY_LIMIT);
        humanBond.setBondVaultModule(address(vaultModule));

        vm.warp(humanBond.rebondCooldown() + 1);

        // Bond the couple
        vm.prank(leticia);
        humanBond.propose(bob, ROOT, 1111, proof);
        vm.prank(bob);
        humanBond.accept(leticia, ROOT, 2222, proof);

        bondId = humanBond.getBondId(leticia, bob);

        // Stand up their vault
        address[] memory owners = new address[](2);
        owners[0] = leticia;
        owners[1] = bob;
        safe = new MockSafe(owners, 2);
        safe.enableModule(address(vaultModule));
        vaultModule.registerVault(bondId, address(safe));

        usdc.mint(address(safe), VAULT_FUNDS);
    }

    /* ------------------------ registerVault ------------------------ */

    function test_registerVault_setsBothMappings() public view {
        assertEq(vaultModule.vaultOf(bondId), address(safe));
        assertEq(vaultModule.bondOfVault(address(safe)), bondId);
    }

    function test_registerVault_reverts_ifAlreadyRegistered() public {
        vm.expectRevert(BondVaultModule.BondVault__VaultAlreadyRegistered.selector);
        vaultModule.registerVault(bondId, address(safe));
    }

    function test_registerVault_reverts_ifModuleNotEnabled() public {
        (address[] memory owners, bytes32 otherBondId) = _secondCouple();
        MockSafe s = new MockSafe(owners, 2);
        // deliberately not enabling the module
        vm.expectRevert(BondVaultModule.BondVault__ModuleNotEnabled.selector);
        vaultModule.registerVault(otherBondId, address(s));
    }

    /// A Safe that one partner solely controls must never become a bond vault — otherwise that
    /// partner could have the module move funds out of an account the other has no say in.
    function test_registerVault_reverts_ifOwnersAreNotThePartners() public {
        (, bytes32 otherBondId) = _secondCouple();
        address[] memory wrong = new address[](2);
        wrong[0] = stranger;
        wrong[1] = merchant;
        MockSafe s = new MockSafe(wrong, 2);
        s.enableModule(address(vaultModule));

        vm.expectRevert(BondVaultModule.BondVault__NotBondOwners.selector);
        vaultModule.registerVault(otherBondId, address(s));
    }

    function test_registerVault_reverts_ifThresholdIsNotTwo() public {
        (address[] memory owners, bytes32 otherBondId) = _secondCouple();
        MockSafe s = new MockSafe(owners, 1);
        s.enableModule(address(vaultModule));

        vm.expectRevert(BondVaultModule.BondVault__BadThreshold.selector);
        vaultModule.registerVault(otherBondId, address(s));
    }

    function test_registerVault_reverts_ifBondNotActive() public {
        bytes32 ghost = humanBond.getBondId(stranger, merchant);
        address[] memory owners = new address[](2);
        owners[0] = stranger;
        owners[1] = merchant;
        MockSafe s = new MockSafe(owners, 2);
        s.enableModule(address(vaultModule));

        vm.expectRevert(BondVaultModule.BondVault__NoActiveBond.selector);
        vaultModule.registerVault(ghost, address(s));
    }

    function test_registerVault_acceptsOwnersInEitherOrder() public {
        (, bytes32 otherBondId) = _secondCouple();
        (address pa, address pb,,,,) = humanBond.bonds(otherBondId);
        address[] memory reversed = new address[](2);
        reversed[0] = pb;
        reversed[1] = pa;
        MockSafe s = new MockSafe(reversed, 2);
        s.enableModule(address(vaultModule));

        vaultModule.registerVault(otherBondId, address(s));
        assertEq(vaultModule.vaultOf(otherBondId), address(s));
    }

    /* -------------------------- small spends ----------------------- */

    function test_proposeSpend_belowThreshold_executesImmediately() public {
        vm.prank(leticia);
        vaultModule.proposeSpend(merchant, 8e6);

        assertEq(usdc.balanceOf(merchant), 8e6);
        assertEq(usdc.balanceOf(address(safe)), VAULT_FUNDS - 8e6);
    }

    function test_proposeSpend_exactlyAtThreshold_executesImmediately() public {
        vm.prank(leticia);
        vaultModule.proposeSpend(merchant, THRESHOLD);
        assertEq(usdc.balanceOf(merchant), THRESHOLD);
    }

    function test_proposeSpend_aboveThreshold_staysPending() public {
        vm.prank(leticia);
        bytes32 spendId = vaultModule.proposeSpend(merchant, 45e6);

        assertEq(usdc.balanceOf(merchant), 0);
        BondVaultModule.Spend memory s = vaultModule.getSpend(spendId);
        assertEq(s.executed, false);
        assertEq(s.amount, 45e6);
        assertEq(vaultModule.approvedBy(spendId, leticia), true);
        assertEq(vaultModule.approvedBy(spendId, bob), false);
    }

    /* ------------------- the drip-drain protection ------------------ */

    /// The per-spend threshold alone is not a limit: without a rolling budget, repeated
    /// just-under-threshold spends drain the vault with no second signature ever required.
    function test_freeSpends_stopBeingFreeOnceDailyLimitIsHit() public {
        // 25 USDC of free budget, spent in 10 + 10
        vm.prank(leticia);
        vaultModule.proposeSpend(merchant, 10e6);
        vm.prank(leticia);
        vaultModule.proposeSpend(merchant, 10e6);
        assertEq(usdc.balanceOf(merchant), 20e6);

        // Only 5 left, so another 10 must fall back to needing both partners
        vm.prank(leticia);
        bytes32 spendId = vaultModule.proposeSpend(merchant, 10e6);

        assertEq(usdc.balanceOf(merchant), 20e6, "should not have executed");
        assertEq(vaultModule.getSpend(spendId).executed, false);
    }

    function test_freeSpends_windowResetsAfter24h() public {
        vm.prank(leticia);
        vaultModule.proposeSpend(merchant, 10e6);
        vm.prank(leticia);
        vaultModule.proposeSpend(merchant, 10e6);
        vm.prank(leticia);
        vaultModule.proposeSpend(merchant, 10e6); // blocked, budget exhausted
        assertEq(usdc.balanceOf(merchant), 20e6);

        skip(1 days + 1);

        vm.prank(leticia);
        vaultModule.proposeSpend(merchant, 10e6);
        assertEq(usdc.balanceOf(merchant), 30e6);
    }

    /// Both partners share one budget — otherwise the pair could move double the intended amount.
    function test_freeSpends_budgetIsSharedAcrossPartners() public {
        vm.prank(leticia);
        vaultModule.proposeSpend(merchant, 10e6);
        vm.prank(bob);
        vaultModule.proposeSpend(merchant, 10e6);

        vm.prank(bob);
        bytes32 spendId = vaultModule.proposeSpend(merchant, 10e6);
        assertEq(vaultModule.getSpend(spendId).executed, false, "budget must be shared");
    }

    function test_remainingFreeAllowance_tracksSpending() public {
        assertEq(vaultModule.remainingFreeAllowance(bondId), DAILY_LIMIT);
        vm.prank(leticia);
        vaultModule.proposeSpend(merchant, 10e6);
        assertEq(vaultModule.remainingFreeAllowance(bondId), DAILY_LIMIT - 10e6);
    }

    function test_wouldExecuteImmediately_matchesActualBehaviour() public {
        assertTrue(vaultModule.wouldExecuteImmediately(bondId, 8e6));
        assertFalse(vaultModule.wouldExecuteImmediately(bondId, 45e6));

        vm.prank(leticia);
        vaultModule.proposeSpend(merchant, 10e6);
        vm.prank(leticia);
        vaultModule.proposeSpend(merchant, 10e6);

        // 5 left: a 10 no longer qualifies, a 5 still does
        assertFalse(vaultModule.wouldExecuteImmediately(bondId, 10e6));
        assertTrue(vaultModule.wouldExecuteImmediately(bondId, 5e6));
    }

    /* --------------------------- approvals ------------------------- */

    function test_approveSpend_bySecondPartner_executes() public {
        vm.prank(leticia);
        bytes32 spendId = vaultModule.proposeSpend(merchant, 45e6);

        vm.prank(bob);
        vaultModule.approveSpend(spendId);

        assertEq(usdc.balanceOf(merchant), 45e6);
        assertEq(vaultModule.getSpend(spendId).executed, true);
    }

    /// The proposer is auto-approved, so re-approving must not be able to stand in for the
    /// partner's consent.
    function test_approveSpend_proposerCannotSelfApproveTwice() public {
        vm.prank(leticia);
        bytes32 spendId = vaultModule.proposeSpend(merchant, 45e6);

        vm.prank(leticia);
        vm.expectRevert(BondVaultModule.BondVault__AlreadyApproved.selector);
        vaultModule.approveSpend(spendId);

        assertEq(usdc.balanceOf(merchant), 0);
    }

    function test_approveSpend_reverts_ifNotAPartner() public {
        vm.prank(leticia);
        bytes32 spendId = vaultModule.proposeSpend(merchant, 45e6);

        vm.prank(stranger);
        vm.expectRevert(BondVaultModule.BondVault__NotYourSpend.selector);
        vaultModule.approveSpend(spendId);
    }

    function test_approveSpend_reverts_ifAlreadyExecuted() public {
        vm.prank(leticia);
        bytes32 spendId = vaultModule.proposeSpend(merchant, 45e6);
        vm.prank(bob);
        vaultModule.approveSpend(spendId);

        vm.prank(bob);
        vm.expectRevert(BondVaultModule.BondVault__SpendNotPending.selector);
        vaultModule.approveSpend(spendId);
    }

    function test_proposeSpend_reverts_ifNotBonded() public {
        vm.prank(stranger);
        vm.expectRevert(BondVaultModule.BondVault__NoActiveBond.selector);
        vaultModule.proposeSpend(merchant, 1e6);
    }

    function test_proposeSpend_reverts_ifZeroAmount() public {
        vm.prank(leticia);
        vm.expectRevert(BondVaultModule.BondVault__ZeroAmount.selector);
        vaultModule.proposeSpend(merchant, 0);
    }

    function test_spendIds_areUniquePerProposal() public {
        vm.prank(leticia);
        bytes32 first = vaultModule.proposeSpend(merchant, 45e6);
        vm.prank(leticia);
        bytes32 second = vaultModule.proposeSpend(merchant, 45e6);
        assertTrue(first != second);
    }

    /* ---------------------------- cancel --------------------------- */

    function test_cancelSpend_byEitherPartner() public {
        vm.prank(leticia);
        bytes32 spendId = vaultModule.proposeSpend(merchant, 45e6);

        vm.prank(bob);
        vaultModule.cancelSpend(spendId);

        assertEq(vaultModule.getSpend(spendId).cancelled, true);

        vm.prank(bob);
        vm.expectRevert(BondVaultModule.BondVault__SpendNotPending.selector);
        vaultModule.approveSpend(spendId);
    }

    function test_cancelSpend_reverts_ifNotAPartner() public {
        vm.prank(leticia);
        bytes32 spendId = vaultModule.proposeSpend(merchant, 45e6);

        vm.prank(stranger);
        vm.expectRevert(BondVaultModule.BondVault__NotYourSpend.selector);
        vaultModule.cancelSpend(spendId);
    }

    /* ------------------------- execution guard --------------------- */

    function test_execution_revertsIfSafeCallFails() public {
        safe.setFailNextCall(true);
        vm.prank(leticia);
        vm.expectRevert(BondVaultModule.BondVault__ExecutionFailed.selector);
        vaultModule.proposeSpend(merchant, 8e6);
    }

    /* --------------------------- settlement ------------------------ */

    function test_dissolution_splitsVaultFiftyFifty() public {
        vm.prank(leticia);
        humanBond.requestDissolution(bob);
        skip(3 days + 1);
        humanBond.executeDissolution(leticia, bob);

        assertEq(usdc.balanceOf(leticia), VAULT_FUNDS / 2);
        assertEq(usdc.balanceOf(bob), VAULT_FUNDS / 2);
        assertEq(usdc.balanceOf(address(safe)), 0);
        assertTrue(vaultModule.settled(address(safe)));
    }

    /// Dust must not be lost: partnerB takes the odd unit, matching how HumanBond splits yield.
    function test_settlement_oddBalanceGivesDustToPartnerB() public {
        // drain to a known odd amount
        vm.prank(leticia);
        bytes32 spendId = vaultModule.proposeSpend(merchant, VAULT_FUNDS - 7);
        vm.prank(bob);
        vaultModule.approveSpend(spendId);
        assertEq(usdc.balanceOf(address(safe)), 7);

        vm.prank(leticia);
        humanBond.requestDissolution(bob);
        skip(3 days + 1);
        humanBond.executeDissolution(leticia, bob);

        (address pa, address pb,,,,) = humanBond.bonds(bondId);
        assertEq(usdc.balanceOf(pa), 3);
        assertEq(usdc.balanceOf(pb), 4);
    }

    function test_settleAndSplit_isIdempotent() public {
        vm.prank(leticia);
        humanBond.requestDissolution(bob);
        skip(3 days + 1);
        humanBond.executeDissolution(leticia, bob);

        uint256 balBefore = usdc.balanceOf(leticia);
        vaultModule.settleAndSplit(bondId); // must be a no-op, not a revert
        assertEq(usdc.balanceOf(leticia), balBefore);
    }

    /// If the in-line settlement during executeDissolution fails, anyone must be able to retry —
    /// otherwise the funds are stranded.
    function test_settleAndSplit_canBeRetriedPermissionlessly() public {
        safe.setFailNextCall(true);

        vm.prank(leticia);
        humanBond.requestDissolution(bob);
        skip(3 days + 1);
        humanBond.executeDissolution(leticia, bob);

        // Divorce went through even though the split could not
        assertEq(humanBond.isBonded(leticia, bob), false);
        assertEq(usdc.balanceOf(address(safe)), VAULT_FUNDS);
        assertFalse(vaultModule.settled(address(safe)));

        safe.setFailNextCall(false);
        vm.prank(stranger);
        vaultModule.settleAndSplit(bondId);

        assertEq(usdc.balanceOf(leticia), VAULT_FUNDS / 2);
        assertEq(usdc.balanceOf(bob), VAULT_FUNDS / 2);
    }

    /// A broken vault must never be able to trap two people in a bond they already ended.
    function test_dissolution_succeedsEvenIfVaultSettlementReverts() public {
        safe.setFailNextCall(true);

        vm.prank(leticia);
        humanBond.requestDissolution(bob);
        skip(3 days + 1);

        vm.expectEmit(address(humanBond));
        emit HumanBond.VaultSettlementFailed(bondId);
        humanBond.executeDissolution(leticia, bob);

        assertEq(humanBond.isBonded(leticia, bob), false);
    }

    function test_settleAndSplit_reverts_ifBondStillActive() public {
        vm.expectRevert(BondVaultModule.BondVault__BondStillActive.selector);
        vaultModule.settleAndSplit(bondId);
    }

    /// Once the bond is gone the remaining balance belongs to the split, not to a pending spend.
    function test_pendingSpend_cannotBeApprovedAfterDissolution() public {
        vm.prank(leticia);
        bytes32 spendId = vaultModule.proposeSpend(merchant, 45e6);

        vm.prank(leticia);
        humanBond.requestDissolution(bob);
        skip(3 days + 1);
        humanBond.executeDissolution(leticia, bob);

        vm.prank(bob);
        vm.expectRevert(BondVaultModule.BondVault__NoActiveBond.selector);
        vaultModule.approveSpend(spendId);
    }

    function test_settleAndSplit_handlesBondWithNoVault() public {
        (, bytes32 otherBondId) = _secondCouple();
        (address pa, address pb,,,,) = humanBond.bonds(otherBondId);

        vm.prank(pa);
        humanBond.requestDissolution(pb);
        skip(3 days + 1);
        humanBond.executeDissolution(pa, pb);

        // A bond that never had a vault settles to nothing; there is no Safe to mark.
        assertEq(vaultModule.vaultOf(otherBondId), address(0));
    }

    /* ----------------------------- re-bond -------------------------- */

    /// Dissolve, wait out the cooldown, bond again. Returns the new epoch.
    function _reBond() internal returns (uint256) {
        vm.prank(leticia);
        humanBond.requestDissolution(bob);
        skip(humanBond.dissolutionDelay() + 1);
        humanBond.executeDissolution(leticia, bob);

        skip(humanBond.rebondCooldown() + 1);

        vm.prank(leticia);
        humanBond.propose(bob, ROOT, 3333, proof);
        vm.prank(bob);
        humanBond.accept(leticia, ROOT, 4444, proof);

        return humanBond.bondEpoch(bondId);
    }

    function test_bondEpoch_incrementsOnEveryAccept() public {
        assertEq(humanBond.bondEpoch(bondId), 1);
        assertEq(_reBond(), 2);
    }

    /// The defect this fixes: a pair who dissolved could never create a shared wallet again,
    /// because the module still held their first vault under the same bond id.
    function test_reBond_canRegisterASecondVault() public {
        _reBond();

        address[] memory owners = new address[](2);
        owners[0] = leticia;
        owners[1] = bob;
        MockSafe second = new MockSafe(owners, 2);
        second.enableModule(address(vaultModule));

        vaultModule.registerVault(bondId, address(second));

        assertEq(vaultModule.vaultOf(bondId), address(second));
        assertEq(vaultModule.epochOfVault(address(second)), 2);
        // The old Safe keeps its own history rather than being overwritten.
        assertEq(vaultModule.bondOfVault(address(safe)), bondId);
        assertEq(vaultModule.epochOfVault(address(safe)), 1);
    }

    /// The second defect: `settled` used to be keyed by bond id, so the flag left over from the
    /// first divorce made every later one a silent no-op — while still reporting success.
    function test_reBond_secondDissolutionActuallySplitsFunds() public {
        // First bond dissolves and splits normally.
        _reBond();
        assertTrue(vaultModule.settled(address(safe)));

        address[] memory owners = new address[](2);
        owners[0] = leticia;
        owners[1] = bob;
        MockSafe second = new MockSafe(owners, 2);
        second.enableModule(address(vaultModule));
        vaultModule.registerVault(bondId, address(second));
        usdc.mint(address(second), VAULT_FUNDS);

        uint256 beforeL = usdc.balanceOf(leticia);
        uint256 beforeB = usdc.balanceOf(bob);

        vm.prank(leticia);
        humanBond.requestDissolution(bob);
        skip(humanBond.dissolutionDelay() + 1);
        humanBond.executeDissolution(leticia, bob);

        assertEq(usdc.balanceOf(address(second)), 0, "second vault must be emptied");
        assertEq(usdc.balanceOf(leticia) - beforeL, VAULT_FUNDS / 2);
        assertEq(usdc.balanceOf(bob) - beforeB, VAULT_FUNDS / 2);
        assertTrue(vaultModule.settled(address(second)));
    }

    /// A Safe may only ever back one bond instance. Reusing one would inherit its settled flag.
    function test_reBond_cannotReuseTheOldSafe() public {
        _reBond();
        vm.expectRevert(BondVaultModule.BondVault__VaultAlreadyRegistered.selector);
        vaultModule.registerVault(bondId, address(safe));
    }

    /// A vault whose settlement failed must stay reachable even after the pair bonds again —
    /// otherwise its balance is stranded for good.
    function test_settleVault_recoversAnOldVaultAfterReBond() public {
        safe.setFailNextCall(true);
        vm.prank(leticia);
        humanBond.requestDissolution(bob);
        skip(humanBond.dissolutionDelay() + 1);
        humanBond.executeDissolution(leticia, bob);

        // Split failed; money is still sitting in the old Safe.
        assertEq(usdc.balanceOf(address(safe)), VAULT_FUNDS);
        assertFalse(vaultModule.settled(address(safe)));

        // They bond again, so vaultOf(bondId) no longer points at the old Safe.
        safe.setFailNextCall(false);
        skip(humanBond.rebondCooldown() + 1);
        vm.prank(leticia);
        humanBond.propose(bob, ROOT, 5555, proof);
        vm.prank(bob);
        humanBond.accept(leticia, ROOT, 6666, proof);

        vm.prank(stranger);
        vaultModule.settleVault(address(safe));

        assertEq(usdc.balanceOf(address(safe)), 0);
        assertEq(usdc.balanceOf(leticia), VAULT_FUNDS / 2);
        assertEq(usdc.balanceOf(bob), VAULT_FUNDS / 2);
    }

    function test_settleVault_reverts_ifSafeIsNotRegistered() public {
        vm.expectRevert(BondVaultModule.BondVault__VaultNotRegistered.selector);
        vaultModule.settleVault(address(0xdead));
    }

    /* --------------------------- parameters ------------------------ */

    function test_setParams_reverts_ifNotOwner() public {
        vm.prank(leticia);
        vm.expectRevert();
        vaultModule.setSmallSpendThreshold(1e6);
    }

    /// The owner can tune the spend parameters but must never be able to open the free-spend path
    /// arbitrarily wide.
    function test_setParams_reverts_ifOutOfBounds() public {
        // Read the bounds first: expectRevert applies to the very next call, and an inline
        // getter would consume it instead of the setter.
        uint256 maxThreshold = vaultModule.MAX_SMALL_SPEND_THRESHOLD();
        uint256 maxDaily = vaultModule.MAX_DAILY_FREE_LIMIT();

        vm.expectRevert(BondVaultModule.BondVault__ParamOutOfBounds.selector);
        vaultModule.setSmallSpendThreshold(maxThreshold + 1);

        vm.expectRevert(BondVaultModule.BondVault__ParamOutOfBounds.selector);
        vaultModule.setDailyFreeLimit(maxDaily + 1);
    }

    function test_setSmallSpendThreshold_takesEffect() public {
        vaultModule.setSmallSpendThreshold(0);
        vm.prank(leticia);
        bytes32 spendId = vaultModule.proposeSpend(merchant, 1);
        assertEq(vaultModule.getSpend(spendId).executed, false, "nothing should be free now");
    }

    /* ---------------------------- helpers -------------------------- */

    /// @dev Bonds a second couple so tests can exercise a bond that has no vault yet.
    function _secondCouple() internal returns (address[] memory owners, bytes32 id) {
        address ana = makeAddr("ana");
        address dave = makeAddr("dave");

        vm.prank(ana);
        humanBond.propose(dave, ROOT, 3333, proof);
        vm.prank(dave);
        humanBond.accept(ana, ROOT, 4444, proof);

        owners = new address[](2);
        owners[0] = ana;
        owners[1] = dave;
        id = humanBond.getBondId(ana, dave);
    }
}
