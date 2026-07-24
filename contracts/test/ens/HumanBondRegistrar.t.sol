// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {HumanBond} from "../../src/HumanBond.sol";
import {BondNFT} from "../../src/BondNFT.sol";
import {MilestoneNFT} from "../../src/MilestoneNFT.sol";
import {TimeToken} from "../../src/TimeToken.sol";
import {BondVaultModule} from "../../src/vault/BondVaultModule.sol";
import {HumanBondRegistrar} from "../../src/ens/HumanBondRegistrar.sol";
import {MockWorldID} from "../utils/MockWorldId.sol";
import {MockSafe} from "../utils/MockSafe.sol";
import {MockUSDC} from "../utils/MockUSDC.sol";
import {MockL2Registry} from "../utils/MockL2Registry.sol";

/// @dev ERC721Holder because the test contract is the registry admin, and the registry mints the
///      base-node token to it with `_safeMint` — exactly as Durin's registry does.
contract HumanBondRegistrarTest is Test, ERC721Holder {
    HumanBond humanBond;
    BondVaultModule vaultModule;
    BondNFT bondNft;
    MockL2Registry registry;
    HumanBondRegistrar registrar;
    MockSafe safe;

    address leticia = makeAddr("leticia");
    address bob = makeAddr("bob");
    address stranger = makeAddr("stranger");

    uint256 constant ROOT = 1;
    uint256[8] proof = [uint256(0), 0, 0, 0, 0, 0, 0, 0];

    /// @dev namehash("humanbond.eth") — the real one, verified on mainnet.
    bytes32 constant BASE_NODE = 0xfa9d25443ceb6b6dffe631716e012ea6e0d23ab46beddf8db1e98428c75f5453;

    bytes32 bondId;

    function setUp() public {
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
        humanBond.setDissolutionDelay(3 days);

        MockUSDC usdc = new MockUSDC();
        vaultModule = new BondVaultModule(address(humanBond), address(usdc), 10e6, 25e6);
        humanBond.setBondVaultModule(address(vaultModule));

        vm.warp(humanBond.rebondCooldown() + 1);

        vm.prank(leticia);
        humanBond.propose(bob, ROOT, 1111, proof);
        vm.prank(bob);
        humanBond.accept(leticia, ROOT, 2222, proof);
        bondId = humanBond.getBondId(leticia, bob);

        registry = new MockL2Registry(BASE_NODE, address(this));
        registrar = new HumanBondRegistrar(
            address(registry), address(humanBond), address(vaultModule), address(bondNft)
        );
        registry.addRegistrar(address(registrar));
    }

    /// @dev Stands up the couple's Safe and registers it with the vault module.
    function _createVault() internal {
        address[] memory owners = new address[](2);
        owners[0] = leticia;
        owners[1] = bob;
        safe = new MockSafe(owners, 2);
        safe.enableModule(address(vaultModule));
        vaultModule.registerVault(bondId, address(safe));
    }

    /* ---------------------- THE CORE INVARIANT ---------------------- */

    function test_register_revertsWhenVaultDoesNotExist() public {
        // No _createVault() — the bond is active but has no shared wallet.
        vm.prank(leticia);
        vm.expectRevert(HumanBondRegistrar.Registrar__VaultNotRegistered.selector);
        registrar.register("leticia-bob");
    }

    function test_register_succeedsOnceVaultExists() public {
        _createVault();

        vm.prank(leticia);
        bytes32 node = registrar.register("leticia-bob");

        assertEq(node, registry.makeNode(BASE_NODE, "leticia-bob"));
        assertEq(registrar.labelOf(bondId), "leticia-bob");
        assertEq(registrar.bondOfNode(node), bondId);
    }

    /* -------------------------- OWNERSHIP --------------------------- */

    function test_register_mintsNameToTheSafeNotTheCaller() public {
        _createVault();

        vm.prank(leticia);
        bytes32 node = registrar.register("leticia-bob");

        assertEq(registry.owner(node), address(safe), "the marriage owns the name, not a partner");
        assertTrue(registry.owner(node) != leticia);
    }

    function test_register_revertsWhenSafeCannotReceiveNfts() public {
        _createVault();
        safe.setRejectsNfts(true); // a Safe with no fallback handler

        vm.prank(leticia);
        vm.expectRevert();
        registrar.register("leticia-bob");
    }

    /* --------------------------- RECORDS ---------------------------- */

    function test_register_pointsAddressRecordsAtTheVault() public {
        _createVault();

        vm.prank(leticia);
        bytes32 node = registrar.register("leticia-bob");

        assertEq(registry.addrOf(node), address(safe), "coinType 60");
        assertEq(
            registry.coinAddrOf(node, registrar.WORLDCHAIN_COINTYPE()),
            abi.encodePacked(address(safe)),
            "ENSIP-11 Worldchain record"
        );
    }

    function test_register_writesBondMetadata() public {
        _createVault();

        vm.prank(leticia);
        bytes32 node = registrar.register("leticia-bob");

        assertEq(registry.text(node, "com.humanbond.bond-id"), Strings.toHexString(uint256(bondId), 32));

        (,, uint256 bondStart,,,) = humanBond.bonds(bondId);
        assertEq(registry.text(node, "com.humanbond.bonded-at"), Strings.toString(bondStart));

        string memory partners = registry.text(node, "com.humanbond.partners");
        assertGt(bytes(partners).length, 0);

        assertGt(bytes(registry.text(node, "com.humanbond.credential")).length, 0);
    }

    function test_register_setsEnsip12AvatarFromTheVowNft() public {
        _createVault();

        vm.prank(leticia);
        bytes32 node = registrar.register("leticia-bob");

        string memory expected = string.concat(
            "eip155:", Strings.toString(block.chainid),
            "/erc721:", Strings.toHexString(address(bondNft)),
            "/", Strings.toString(bondNft.bondToToken(bondId, 0))
        );
        assertEq(registry.text(node, "avatar"), expected);
    }

    /* ---------------------------- GUARDS ---------------------------- */

    function test_register_revertsForNonBondedCaller() public {
        _createVault();

        vm.prank(stranger);
        vm.expectRevert(HumanBondRegistrar.Registrar__NoActiveBond.selector);
        registrar.register("stranger");
    }

    function test_register_revertsOnSecondNameForSameBond() public {
        _createVault();

        vm.prank(leticia);
        registrar.register("leticia-bob");

        vm.prank(bob);
        vm.expectRevert(HumanBondRegistrar.Registrar__AlreadyNamed.selector);
        registrar.register("bob-leticia");
    }

    function test_register_revertsOnTakenLabel() public {
        _createVault();

        // Another couple already took the label.
        registry.createSubnode(BASE_NODE, "leticia-bob", stranger, new bytes[](0));

        vm.prank(leticia);
        vm.expectRevert(HumanBondRegistrar.Registrar__LabelTaken.selector);
        registrar.register("leticia-bob");
    }

    function test_register_revertsOnEmptyLabel() public {
        _createVault();

        vm.prank(leticia);
        vm.expectRevert(HumanBondRegistrar.Registrar__EmptyLabel.selector);
        registrar.register("");
    }

    function test_register_revertsOnOverlongLabel() public {
        _createVault();

        string memory tooLong = new string(64);
        vm.prank(leticia);
        vm.expectRevert(HumanBondRegistrar.Registrar__LabelTooLong.selector);
        registrar.register(tooLong);
    }

    function test_register_eitherPartnerMayClaim() public {
        _createVault();

        vm.prank(bob);
        bytes32 node = registrar.register("bob-leticia");
        assertEq(registrar.bondOfNode(node), bondId);
    }

    /* -------------------------- MILESTONES -------------------------- */

    function test_syncMilestone_writesYearsRecord() public {
        _createVault();
        vm.prank(leticia);
        bytes32 node = registrar.register("leticia-bob");

        vm.prank(bob);
        registrar.syncMilestone(3);

        assertEq(registry.text(node, "com.humanbond.years"), "3");
    }

    function test_syncMilestone_revertsWhenBondHasNoName() public {
        _createVault();

        vm.prank(leticia);
        vm.expectRevert(HumanBondRegistrar.Registrar__NotNamed.selector);
        registrar.syncMilestone(1);
    }

    /* ----------------------------- VIEWS ---------------------------- */

    function test_available_reflectsRegistrationState() public {
        _createVault();
        assertTrue(registrar.available("leticia-bob"));

        vm.prank(leticia);
        registrar.register("leticia-bob");

        assertFalse(registrar.available("leticia-bob"));
        assertTrue(registrar.available("someone-else"));
    }

    function test_available_rejectsBadLengths() public view {
        assertFalse(registrar.available(""));
        assertFalse(registrar.available(new string(64)));
    }

    function test_baseNode_isReadFromTheRegistry() public view {
        assertEq(registrar.baseNode(), BASE_NODE);
    }

    function test_nodeOfBond_returnsZeroWhenUnnamed() public view {
        assertEq(registrar.nodeOfBond(bondId), bytes32(0));
    }

    /* ------------------------ DISSOLUTION & RE-BOND ------------------ */

    function _dissolve() internal {
        vm.prank(leticia);
        humanBond.requestDissolution(bob);
        skip(humanBond.dissolutionDelay() + 1);
        humanBond.executeDissolution(leticia, bob);
    }

    function _reBond() internal {
        _dissolve();
        skip(humanBond.rebondCooldown() + 1);
        vm.prank(leticia);
        humanBond.propose(bob, ROOT, 3333, proof);
        vm.prank(bob);
        humanBond.accept(leticia, ROOT, 4444, proof);
    }

    /// The name survives the bond. It is an asset of the Safe, and the Safe is still the
    /// ex-partners'; the registrar has no business confiscating it.
    function test_dissolution_leavesTheNameWithTheSafe() public {
        _createVault();
        vm.prank(leticia);
        bytes32 node = registrar.register("leticia-bob");

        _dissolve();

        assertEq(registry.owner(node), address(safe), "the Safe still owns the name");
        assertEq(registry.addrOf(node), address(safe), "and it still resolves to it");
    }

    function test_markDissolved_writesStatusRecord() public {
        _createVault();
        vm.prank(leticia);
        bytes32 node = registrar.register("leticia-bob");
        assertEq(registry.text(node, "com.humanbond.status"), "active");

        _dissolve();

        // Permissionless: the condition is verified on-chain.
        vm.prank(stranger);
        registrar.markDissolved(node);

        assertEq(registry.text(node, "com.humanbond.status"), "dissolved");
    }

    function test_markDissolved_revertsWhileBondIsActive() public {
        _createVault();
        vm.prank(leticia);
        bytes32 node = registrar.register("leticia-bob");

        vm.expectRevert(HumanBondRegistrar.Registrar__BondStillActive.selector);
        registrar.markDissolved(node);
    }

    function test_markDissolved_revertsForUnknownNode() public {
        vm.expectRevert(HumanBondRegistrar.Registrar__NotNamed.selector);
        registrar.markDissolved(keccak256("nope"));
    }

    /// A pair who bonds again is a new bond instance, so they get to name it — the old name is
    /// not in the way.
    function test_reBond_canClaimANewName() public {
        _createVault();
        vm.prank(leticia);
        bytes32 firstNode = registrar.register("leticia-bob");

        _reBond();
        _createVault(); // a fresh Safe for the new bond instance

        vm.prank(bob);
        bytes32 secondNode = registrar.register("leticia-bob-again");

        assertTrue(firstNode != secondNode);
        assertEq(registrar.labelOf(bondId), "leticia-bob-again");
        assertEq(registrar.nodeOfBond(bondId), secondNode);
        // The old name is untouched and still points at the old Safe.
        assertEq(registrar.bondOfNode(firstNode), bondId);
    }

    /// ...but still only one name per bond instance.
    function test_reBond_stillOnlyOneNamePerInstance() public {
        _createVault();
        vm.prank(leticia);
        registrar.register("leticia-bob");

        _reBond();
        _createVault();

        vm.prank(bob);
        registrar.register("leticia-bob-again");

        vm.prank(leticia);
        vm.expectRevert(HumanBondRegistrar.Registrar__AlreadyNamed.selector);
        registrar.register("a-third-one");
    }

    /// An old name stays addressable after the pair has bonded again and labelOfBond moved on.
    function test_markDissolved_worksOnAnOldNameAfterReBond() public {
        _createVault();
        vm.prank(leticia);
        bytes32 firstNode = registrar.register("leticia-bob");

        _reBond();
        _createVault();
        vm.prank(bob);
        registrar.register("leticia-bob-again");

        registrar.markDissolved(firstNode);
        assertEq(registry.text(firstNode, "com.humanbond.status"), "dissolved");
    }
}
