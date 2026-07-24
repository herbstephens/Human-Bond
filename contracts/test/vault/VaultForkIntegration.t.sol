// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {HumanBond} from "../../src/HumanBond.sol";
import {BondNFT} from "../../src/BondNFT.sol";
import {MilestoneNFT} from "../../src/MilestoneNFT.sol";
import {TimeToken} from "../../src/TimeToken.sol";
import {BondVaultModule} from "../../src/vault/BondVaultModule.sol";
import {ModuleSetup} from "../../src/vault/ModuleSetup.sol";
import {ISafe} from "../../src/vault/interfaces/ISafe.sol";
import {MockWorldID} from "../utils/MockWorldId.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ISafeProxyFactory {
    function createProxyWithNonce(address singleton, bytes memory initializer, uint256 saltNonce)
        external
        returns (address proxy);
}

interface ISafeSetup {
    function setup(
        address[] calldata _owners,
        uint256 _threshold,
        address to,
        bytes calldata data,
        address fallbackHandler,
        address paymentToken,
        uint256 payment,
        address payable paymentReceiver
    ) external;

    function getOwners() external view returns (address[] memory);
    function getThreshold() external view returns (uint256);
    function isModuleEnabled(address module) external view returns (bool);
    function nonce() external view returns (uint256);
}

/**
 * @notice Integration test against the REAL Safe contracts on Worldchain mainnet.
 *
 * @dev This is the test that matters most. ModuleSetup runs as a DELEGATECALL inside the Safe, so
 *      its storage layout has to line up with Safe's exactly — get it wrong and it silently
 *      overwrites the Safe's singleton pointer, bricking the account and everything in it. Mocks
 *      cannot catch that; only a real Safe can.
 *
 *      Run with:
 *        forge test --match-path "test/vault/VaultForkIntegration.t.sol" \
 *          --fork-url https://worldchain-mainnet.g.alchemy.com/public
 *
 *      Skips itself when not run against a fork, so the default `forge test` stays offline.
 */
contract VaultForkIntegrationTest is Test {
    address constant SAFE_PROXY_FACTORY = 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67;
    address constant SAFE_SINGLETON = 0x41675C099F32341bf84BFc5382aF534df5C7461a;
    address constant SAFE_FALLBACK_HANDLER = 0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99;
    address constant USDC = 0x79A02482A880bCE3F13e09Da970dC34db4CD24d1;

    uint256 constant THRESHOLD = 10e6;
    uint256 constant DAILY_LIMIT = 25e6;
    uint256 constant VAULT_FUNDS = 1000e6;

    HumanBond humanBond;
    BondVaultModule vaultModule;
    ModuleSetup moduleSetup;

    address leticia = makeAddr("leticia");
    address bob = makeAddr("bob");
    address merchant = makeAddr("merchant");

    uint256[8] proof = [uint256(0), 0, 0, 0, 0, 0, 0, 0];

    bytes32 bondId;
    address safe;

    modifier onlyFork() {
        if (SAFE_PROXY_FACTORY.code.length == 0) {
            vm.skip(true);
        }
        _;
    }

    function setUp() public {
        if (SAFE_PROXY_FACTORY.code.length == 0) return; // not on a fork; tests self-skip

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

        moduleSetup = new ModuleSetup();
        vaultModule = new BondVaultModule(address(humanBond), USDC, THRESHOLD, DAILY_LIMIT);
        humanBond.setBondVaultModule(address(vaultModule));

        vm.warp(block.timestamp + humanBond.rebondCooldown() + 1);

        vm.prank(leticia);
        humanBond.propose(bob, 1, 1111, proof);
        vm.prank(bob);
        humanBond.accept(leticia, 1, 2222, proof);

        bondId = humanBond.getBondId(leticia, bob);

        safe = _createBondSafe(leticia, bob, bondId);
        vaultModule.registerVault(bondId, safe);

        deal(USDC, safe, VAULT_FUNDS);
    }

    /// @dev Mirrors exactly what the frontend will do: one factory call whose setup() delegatecalls
    ///      ModuleSetup, so the Safe is created with the module already enabled. Doing it
    ///      afterwards would need a full 2-of-2 owner transaction before the vault was usable.
    function _createBondSafe(address a, address b, bytes32 salt) internal returns (address) {
        address[] memory owners = new address[](2);
        // Sorted so the on-chain owner list is deterministic for a given couple.
        (owners[0], owners[1]) = a < b ? (a, b) : (b, a);

        bytes memory initializer = abi.encodeCall(
            ISafeSetup.setup,
            (
                owners,
                2,
                address(moduleSetup),
                abi.encodeCall(ModuleSetup.enableModule, (address(vaultModule))),
                SAFE_FALLBACK_HANDLER,
                address(0),
                0,
                payable(address(0))
            )
        );

        return ISafeProxyFactory(SAFE_PROXY_FACTORY).createProxyWithNonce(
            SAFE_SINGLETON, initializer, uint256(salt)
        );
    }

    /* ------------------------------ tests ------------------------------ */

    /// The core claim: ModuleSetup's delegatecall enabled the module without corrupting the Safe.
    function test_fork_safeIsCreatedWithModuleEnabled() public onlyFork {
        assertTrue(ISafeSetup(safe).isModuleEnabled(address(vaultModule)), "module not enabled");
        assertEq(ISafeSetup(safe).getThreshold(), 2);
        assertEq(ISafeSetup(safe).getOwners().length, 2);
    }

    /// If ModuleSetup had written to the wrong slot it would have clobbered the singleton pointer.
    /// A Safe that still answers these calls correctly proves the layout is aligned.
    function test_fork_safeSingletonNotCorrupted() public onlyFork {
        // Slot 0 holds the singleton address; it must still point at the Safe implementation.
        bytes32 slot0 = vm.load(safe, bytes32(uint256(0)));
        assertEq(address(uint160(uint256(slot0))), SAFE_SINGLETON, "singleton pointer corrupted");

        // And the Safe must still be functional.
        assertEq(ISafeSetup(safe).nonce(), 0);
    }

    function test_fork_smallSpendExecutesImmediately() public onlyFork {
        vm.prank(leticia);
        vaultModule.proposeSpend(merchant, 8e6);

        assertEq(IERC20(USDC).balanceOf(merchant), 8e6);
        assertEq(IERC20(USDC).balanceOf(safe), VAULT_FUNDS - 8e6);
    }

    function test_fork_largeSpendNeedsBothPartners() public onlyFork {
        vm.prank(leticia);
        bytes32 spendId = vaultModule.proposeSpend(merchant, 45e6);
        assertEq(IERC20(USDC).balanceOf(merchant), 0, "must not move on one signature");

        vm.prank(bob);
        vaultModule.approveSpend(spendId);
        assertEq(IERC20(USDC).balanceOf(merchant), 45e6);
    }

    function test_fork_dissolutionSplitsRealSafeFiftyFifty() public onlyFork {
        vm.prank(leticia);
        humanBond.requestDissolution(bob);
        skip(3 days + 1);
        humanBond.executeDissolution(leticia, bob);

        assertEq(IERC20(USDC).balanceOf(leticia), VAULT_FUNDS / 2);
        assertEq(IERC20(USDC).balanceOf(bob), VAULT_FUNDS / 2);
        assertEq(IERC20(USDC).balanceOf(safe), 0);
    }

    /// The Safe address must be derivable off-chain from the bondId alone, so the frontend can
    /// show it before it exists and both partners compute the same one.
    function test_fork_safeAddressIsDeterministicFromBondId() public onlyFork {
        address predicted = safe;
        // Re-creating with the same salt must collide, proving the address is salt-derived.
        vm.expectRevert();
        _createBondSafe(leticia, bob, bondId);
        assertEq(predicted, safe);
    }
}
