// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {HumanBond} from "../../src/HumanBond.sol";
import {BondNFT} from "../../src/BondNFT.sol";
import {MilestoneNFT} from "../../src/MilestoneNFT.sol";
import {TimeToken} from "../../src/TimeToken.sol";
import {BondVaultModule} from "../../src/vault/BondVaultModule.sol";
import {ModuleSetup} from "../../src/vault/ModuleSetup.sol";
import {HumanBondRegistrar} from "../../src/ens/HumanBondRegistrar.sol";
import {MockWorldID} from "../utils/MockWorldId.sol";

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
}

/// @dev The bits of the real Durin L2Registry we need to drive from the test: the admin path to
///      authorise our registrar, plus the reads to prove a subname actually landed.
interface IL2RegistryFork {
    function owner() external view returns (address);
    function addRegistrar(address registrar) external;
    function registrars(address) external view returns (bool);
    function owner(bytes32 node) external view returns (address);
    function addr(bytes32 node) external view returns (address);
    function text(bytes32 node, string calldata key) external view returns (string memory);
    function makeNode(bytes32 parentNode, string calldata label) external pure returns (bytes32);
    function baseNode() external view returns (bytes32);
}

/**
 * @notice The test that answers "will an ENS subname actually mint?" — end to end against the
 *         REAL Durin L2Registry on Worldchain, not a mock.
 *
 * @dev What a mock cannot prove and this does:
 *      - our IL2Registry interface matches Durin's real createSubnode/setAddr/setText selectors;
 *      - a real Safe (with CompatibilityFallbackHandler) can RECEIVE the subname NFT via _safeMint;
 *      - the whole register() path — bond gate, vault gate, 9 resolver records — runs on real
 *        bytecode.
 *
 *      Run against a fork (nothing is written to real mainnet):
 *        forge test --match-path "test/ens/RegistrarForkIntegration.t.sol" \
 *          --fork-url https://worldchain-mainnet.g.alchemy.com/public -vv
 *
 *      Self-skips when not on a fork, so the default offline `forge test` is unaffected.
 */
contract RegistrarForkIntegrationTest is Test {
    address constant SAFE_PROXY_FACTORY = 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67;
    address constant SAFE_SINGLETON = 0x41675C099F32341bf84BFc5382aF534df5C7461a;
    address constant SAFE_FALLBACK_HANDLER = 0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99;
    address constant USDC = 0x79A02482A880bCE3F13e09Da970dC34db4CD24d1;

    /// @dev The real Durin L2Registry for humanbond.eth, deployed via durin.dev on 2026-07-24.
    address constant L2_REGISTRY = 0x3DbB5CE73f3C1cb63D61A6Db73668D4cE10f371B;

    HumanBond humanBond;
    BondVaultModule vaultModule;
    ModuleSetup moduleSetup;
    BondNFT bondNft;
    HumanBondRegistrar registrar;

    address leticia = makeAddr("leticia");
    address bob = makeAddr("bob");

    uint256[8] proof = [uint256(0), 0, 0, 0, 0, 0, 0, 0];

    bytes32 bondId;
    address safe;

    // Unlikely to collide with a real label on the fork; if it ever does the test would revert
    // with Registrar__LabelTaken, which is itself a valid signal.
    string constant LABEL = "fork-smoke-leticia-bob";

    modifier onlyFork() {
        if (L2_REGISTRY.code.length == 0) vm.skip(true);
        _;
    }

    function setUp() public {
        if (L2_REGISTRY.code.length == 0) return; // offline: self-skip

        MockWorldID worldId = new MockWorldID();
        bondNft = new BondNFT();
        MilestoneNFT milestoneNft = new MilestoneNFT();
        TimeToken timeToken = new TimeToken();

        humanBond = new HumanBond();
        humanBond.initialize(
            address(worldId), address(bondNft), address(timeToken), address(milestoneNft),
            "app_test", "propose-bond", "accept-bond"
        );
        milestoneNft.setHumanBondContract(address(humanBond));
        bondNft.setHumanBondContract(address(humanBond));
        timeToken.setMinter(address(humanBond), true);

        moduleSetup = new ModuleSetup();
        vaultModule = new BondVaultModule(address(humanBond), USDC, 10e6, 25e6);
        humanBond.setBondVaultModule(address(vaultModule));

        vm.warp(block.timestamp + humanBond.rebondCooldown() + 1);
        vm.prank(leticia);
        humanBond.propose(bob, 1, 1111, proof);
        vm.prank(bob);
        humanBond.accept(leticia, 1, 2222, proof);
        bondId = humanBond.getBondId(leticia, bob);

        safe = _createBondSafe(leticia, bob, bondId);
        vaultModule.registerVault(bondId, safe);

        // Deploy our registrar against the REAL registry and authorise it the way we did on-chain:
        // as the registry owner.
        registrar = new HumanBondRegistrar(L2_REGISTRY, address(humanBond), address(vaultModule), address(bondNft));
        address registryOwner = IL2RegistryFork(L2_REGISTRY).owner();
        vm.prank(registryOwner);
        IL2RegistryFork(L2_REGISTRY).addRegistrar(address(registrar));
    }

    function _createBondSafe(address a, address b, bytes32 salt) internal returns (address) {
        address[] memory owners = new address[](2);
        (owners[0], owners[1]) = a < b ? (a, b) : (b, a);
        bytes memory initializer = abi.encodeCall(
            ISafeSetup.setup,
            (
                owners, 2, address(moduleSetup),
                abi.encodeCall(ModuleSetup.enableModule, (address(vaultModule))),
                SAFE_FALLBACK_HANDLER, address(0), 0, payable(address(0))
            )
        );
        return ISafeProxyFactory(SAFE_PROXY_FACTORY).createProxyWithNonce(SAFE_SINGLETON, initializer, uint256(salt));
    }

    /* ------------------------------ tests ------------------------------ */

    /// The headline: register() mints a real subname on the real Durin registry, owned by the Safe.
    function test_fork_registerMintsSubnameToTheSafe() public onlyFork {
        vm.prank(leticia);
        bytes32 node = registrar.register(LABEL);

        // The registrar authorisation held and createSubnode ran on real bytecode.
        assertTrue(IL2RegistryFork(L2_REGISTRY).registrars(address(registrar)), "registrar not authorised");
        // The Safe — not the caller — owns the name.
        assertEq(IL2RegistryFork(L2_REGISTRY).owner(node), safe, "subname not owned by the Safe");
        // And it resolves to the vault.
        assertEq(IL2RegistryFork(L2_REGISTRY).addr(node), safe, "addr record not pointing at the vault");
        // Bookkeeping on our side.
        assertEq(registrar.labelOf(bondId), LABEL);
        assertEq(registrar.nodeOfBond(bondId), node);
    }

    /// The profile records we write must actually land on the real resolver.
    function test_fork_registerWritesResolverRecords() public onlyFork {
        vm.prank(bob);
        bytes32 node = registrar.register(LABEL);

        assertEq(IL2RegistryFork(L2_REGISTRY).text(node, "com.humanbond.status"), "active");
        assertEq(
            IL2RegistryFork(L2_REGISTRY).text(node, "description"),
            "A HumanBond bond between two World ID verified humans."
        );
        // The partners record is non-empty (exact value is address-dependent).
        assertGt(bytes(IL2RegistryFork(L2_REGISTRY).text(node, "com.humanbond.partners")).length, 0);
    }

    /// The node the registrar computes must match what the real registry derives.
    function test_fork_nodeMatchesRegistryDerivation() public onlyFork {
        vm.prank(leticia);
        bytes32 node = registrar.register(LABEL);
        bytes32 expected =
            IL2RegistryFork(L2_REGISTRY).makeNode(IL2RegistryFork(L2_REGISTRY).baseNode(), LABEL);
        assertEq(node, expected);
    }
}
