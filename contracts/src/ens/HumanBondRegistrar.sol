// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IL2Registry} from "./interfaces/IL2Registry.sol";
import {IHumanBond} from "../vault/interfaces/IHumanBond.sol";

interface IBondVaultModule {
    function vaultOf(bytes32 bondId) external view returns (address);
}

interface IBondNFT {
    function bondToToken(bytes32 bondId, uint256 index) external view returns (uint256);
}

/**
 * @title HumanBondRegistrar
 * @notice Gives every bonded couple an ENS subname under humanbond.eth that resolves to their
 *         shared Safe and carries the bond's public profile.
 *
 * @dev Design notes worth reading before changing anything here:
 *
 *      1. THE NAME FOLLOWS THE VAULT. `register()` reverts unless BondVaultModule already has a
 *         Safe for the bond. The name is a property of the shared wallet, not of the bond — a
 *         couple with no shared wallet has nothing for the name to point at. The frontend puts
 *         this call last in the same MiniKit batch that creates the Safe, so the ordering that
 *         enforces the invariant is the batch order itself.
 *
 *      2. THE SAFE OWNS THE NAME. The subname NFT is minted to the Safe, not to msg.sender. The
 *         name belongs to the bond: neither partner can sell or transfer it alone, because
 *         moving it needs a 2-of-2 Safe transaction. This is the "subname as access token" idea
 *         — holding the name and holding the vault are the same thing.
 *
 *      3. ONE NAME PER BOND INSTANCE, NO RENAMES. A bond has one name for as long as it lasts.
 *         Allowing renames would let a pair cycle through labels (squatting) and would break links
 *         already shared. A pair who dissolves and bonds again is a NEW bond instance and gets to
 *         name it: their previous name stays with their previous Safe, which still owns it.
 *
 *      4. NO SIGNATURES, same as BondVaultModule. Partners are identified by msg.sender. World
 *         App wallets are ERC-4337 smart accounts with no ECDSA key we could verify against.
 *
 *      5. THIS CONTRACT ONLY READS THE PROTOCOL. HumanBond, BondVaultModule and BondNFT are
 *         untouched by this integration — every dependency below is a public view. Nothing here
 *         can move funds or change who is bonded to whom.
 */
contract HumanBondRegistrar {
    /* ----------------------------- ERRORS ----------------------------- */
    error Registrar__InvalidAddress();
    error Registrar__NoActiveBond();
    error Registrar__VaultNotRegistered();
    error Registrar__AlreadyNamed();
    error Registrar__LabelTaken();
    error Registrar__EmptyLabel();
    error Registrar__LabelTooLong();
    error Registrar__NotNamed();
    error Registrar__BondStillActive();

    /* --------------------------- CONSTANTS ---------------------------- */
    /// @dev A DNS label is capped at 63 bytes. Durin's registry allows up to 255, but anything
    ///      above 63 produces a name that resolvers and browsers will refuse.
    uint256 public constant MAX_LABEL_BYTES = 63;

    /// @dev ENSIP-11 coinType for Worldchain: 0x80000000 | 480.
    uint256 public constant WORLDCHAIN_COINTYPE = 2147484128;

    /* --------------------------- IMMUTABLES --------------------------- */
    IL2Registry public immutable registry;
    IHumanBond public immutable humanBond;
    IBondVaultModule public immutable vaultModule;
    IBondNFT public immutable bondNft;

    /// @notice namehash("humanbond.eth") — the parent every subname hangs off.
    bytes32 public immutable baseNode;

    /* --------------------------- STATE VARS --------------------------- */
    mapping(bytes32 => string) public labelOfBond; // bondId => label of the CURRENT bond instance
    mapping(bytes32 => bytes32) public bondOfNode; // subnode => bondId
    mapping(bytes32 => uint256) public epochOfNode; // subnode => bond epoch it was minted for
    mapping(bytes32 => uint256) public labelEpoch; // bondId => epoch of labelOfBond

    /* ----------------------------- EVENTS ----------------------------- */
    event BondNamed(bytes32 indexed bondId, bytes32 indexed node, string label, address indexed vault);
    event MilestoneSynced(bytes32 indexed bondId, uint256 year);
    event BondNameDissolved(bytes32 indexed bondId, bytes32 indexed node);

    /* --------------------------- CONSTRUCTOR -------------------------- */
    constructor(address _registry, address _humanBond, address _vaultModule, address _bondNft) {
        if (_registry == address(0) || _humanBond == address(0) || _vaultModule == address(0)) {
            revert Registrar__InvalidAddress();
        }
        registry = IL2Registry(_registry);
        humanBond = IHumanBond(_humanBond);
        vaultModule = IBondVaultModule(_vaultModule);
        bondNft = IBondNFT(_bondNft);

        // Read the parent from the registry rather than taking it as a constructor argument:
        // it makes it impossible to deploy this pointing at the wrong name.
        baseNode = IL2Registry(_registry).baseNode();
    }

    /* ----------------------------- NAMING ----------------------------- */

    /**
     * @notice Claim the ENS subname for the caller's bond and point it at their vault.
     * @param label Label to register, already normalised client-side (see lib/ens/label.ts).
     *              Normalisation (ENSIP-15) is not enforceable on-chain — it needs Unicode
     *              tables no contract can carry. On-chain we check what is cheap and matters:
     *              non-empty, within DNS length, and not already taken. A caller who bypasses
     *              the UI can register an unnormalised label, but the only name they can damage
     *              is their own.
     * @return node The namehash of the newly created subname.
     */
    function register(string calldata label) external returns (bytes32 node) {
        uint256 len = bytes(label).length;
        if (len == 0) revert Registrar__EmptyLabel();
        if (len > MAX_LABEL_BYTES) revert Registrar__LabelTooLong();

        bytes32 bondId = humanBond.activeBondOf(msg.sender);
        if (bondId == bytes32(0)) revert Registrar__NoActiveBond();

        // The invariant: no shared wallet, no name.
        address vault = vaultModule.vaultOf(bondId);
        if (vault == address(0)) revert Registrar__VaultNotRegistered();

        // One name per bond INSTANCE. A pair who dissolved and bonded again is a new instance and
        // may name it; their old name stays where it is, still owned by their old Safe.
        uint256 epoch = humanBond.bondEpoch(bondId);
        if (bytes(labelOfBond[bondId]).length != 0 && labelEpoch[bondId] >= epoch) {
            revert Registrar__AlreadyNamed();
        }

        node = registry.makeNode(baseNode, label);
        // createSubnode would revert on a duplicate anyway; checking here turns an opaque
        // NotAvailable into an error the UI can map to "that name is taken".
        if (registry.owner(node) != address(0)) revert Registrar__LabelTaken();

        (address partnerA, address partnerB, uint256 bondStart,,,) = humanBond.bonds(bondId);

        // Records are applied inside createSubnode via ENS's Multicallable, which delegatecalls
        // each entry — so msg.sender stays this contract and registrar authorisation holds.
        bytes[] memory data = new bytes[](9);

        // coinType 60: what `cast resolve-name` and most wallets read by default.
        data[0] = abi.encodeWithSignature("setAddr(bytes32,address)", node, vault);
        // ENSIP-11 Worldchain record: the chain the Safe actually lives on.
        data[1] = abi.encodeWithSignature(
            "setAddr(bytes32,uint256,bytes)", node, WORLDCHAIN_COINTYPE, abi.encodePacked(vault)
        );
        data[2] = _text(node, "avatar", _avatarUri(bondId));
        data[3] = _text(node, "description", "A HumanBond bond between two World ID verified humans.");
        data[4] = _text(node, "com.humanbond.bond-id", Strings.toHexString(uint256(bondId), 32));
        data[5] = _text(
            node,
            "com.humanbond.partners",
            string.concat(Strings.toHexString(partnerA), ",", Strings.toHexString(partnerB))
        );
        data[6] = _text(node, "com.humanbond.bonded-at", Strings.toString(bondStart));
        data[7] = _text(node, "com.humanbond.credential", _credential());
        // Written from the start so the key always exists and readers never have to treat a
        // missing record as "probably still active".
        data[8] = _text(node, "com.humanbond.status", "active");

        registry.createSubnode(baseNode, label, vault, data);

        labelOfBond[bondId] = label;
        labelEpoch[bondId] = epoch;
        bondOfNode[node] = bondId;
        epochOfNode[node] = epoch;

        emit BondNamed(bondId, node, label, vault);
    }

    /**
     * @notice Record on the name itself that its bond has ended.
     * @dev Permissionless, because the condition is verified on-chain and there is no reason to
     *      care who reports it — least of all the two people who just separated.
     *
     *      The name is NOT taken away. The subname NFT belongs to the Safe, the Safe still belongs
     *      to both ex-partners, and it may still hold assets the module never touched. Burning or
     *      reassigning it here would mean this contract could strip a name from a wallet it does
     *      not own, which is exactly the power it was designed never to have. What we can do
     *      honestly is stop the name from claiming a bond that no longer exists.
     *
     *      Addressed by node rather than by bond id so an old name stays reachable after the pair
     *      has bonded again and `labelOfBond` has moved on.
     */
    function markDissolved(bytes32 node) external {
        bytes32 bondId = bondOfNode[node];
        if (bondId == bytes32(0)) revert Registrar__NotNamed();

        (,,,,, bool active) = humanBond.bonds(bondId);
        // This name's own bond instance must be over. A pair who bonded again has `active` true
        // on the same bond id, so the epoch is what says whether THIS name's chapter closed.
        bool ended = !active || epochOfNode[node] < humanBond.bondEpoch(bondId);
        if (!ended) revert Registrar__BondStillActive();

        registry.setText(node, "com.humanbond.status", "dissolved");

        emit BondNameDissolved(bondId, node);
    }

    /**
     * @notice Publish the couple's anniversary count on their name.
     * @dev Callable by either partner. Registrars are authorised on every node in Durin's
     *      resolver, so this works even though the Safe owns the name.
     */
    function syncMilestone(uint256 year) external {
        bytes32 bondId = humanBond.activeBondOf(msg.sender);
        if (bondId == bytes32(0)) revert Registrar__NoActiveBond();

        string memory label = labelOfBond[bondId];
        if (bytes(label).length == 0) revert Registrar__NotNamed();

        registry.setText(registry.makeNode(baseNode, label), "com.humanbond.years", Strings.toString(year));
        emit MilestoneSynced(bondId, year);
    }

    /* ------------------------------ VIEWS ----------------------------- */

    /// @notice True if `label` can still be registered under humanbond.eth.
    function available(string calldata label) external view returns (bool) {
        uint256 len = bytes(label).length;
        if (len == 0 || len > MAX_LABEL_BYTES) return false;
        return registry.owner(registry.makeNode(baseNode, label)) == address(0);
    }

    /// @notice Label already registered for a bond, or "" if it has none.
    function labelOf(bytes32 bondId) external view returns (string memory) {
        return labelOfBond[bondId];
    }

    /// @notice Subnode for a bond. Reverts-free: returns bytes32(0) when unnamed.
    function nodeOfBond(bytes32 bondId) external view returns (bytes32) {
        string memory label = labelOfBond[bondId];
        if (bytes(label).length == 0) return bytes32(0);
        return registry.makeNode(baseNode, label);
    }

    /* ---------------------------- INTERNAL ---------------------------- */

    function _text(bytes32 node, string memory key, string memory value) private pure returns (bytes memory) {
        return abi.encodeWithSignature("setText(bytes32,string,string)", node, key, value);
    }

    /**
     * @dev ENSIP-12 NFT avatar: eip155:<chainId>/erc721:<contract>/<tokenId>.
     *
     *      Returns "" when the bond has no certificate token yet — the public array getter
     *      reverts on an empty array, and a missing avatar must never block registration.
     *
     *      Note most ENS clients only render NFT avatars from mainnet, so this may not show up
     *      in third-party UIs. It is correct per the standard and renders in our own app.
     */
    function _avatarUri(bytes32 bondId) private view returns (string memory) {
        try bondNft.bondToToken(bondId, 0) returns (uint256 tokenId) {
            return string.concat(
                "eip155:",
                Strings.toString(block.chainid),
                "/erc721:",
                Strings.toHexString(address(bondNft)),
                "/",
                Strings.toString(tokenId)
            );
        } catch {
            return "";
        }
    }

    /**
     * @dev The verifiable credential carried by the name.
     *
     *      HumanBond does not persist World ID nullifiers — they are consumed by
     *      `worldId.verifyProof()` and never stored — so the name cannot republish them.
     *      What it can publish is a pointer to the claim's proof: the bond itself. A bond only
     *      exists if two distinct Orb-verified humans each supplied a valid World ID proof, so
     *      "this bond exists" is exactly the credential "two unique verified humans married",
     *      and anyone can check it against the protocol without trusting this record.
     */
    function _credential() private view returns (string memory) {
        return string.concat("worldid-orb:2;verify=eip155:", Strings.toString(block.chainid), ":", Strings.toHexString(address(humanBond)), ".bonds");
    }
}
