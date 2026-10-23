// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// Anchors one Merkle root per cohort. Leaves are revoked individually.
contract MerkleCredentialAnchor {
    address public issuer;

    struct Batch {
        bytes32 root;
        uint64 anchoredAt;
        bool exists;
    }

    mapping(uint256 batchId => Batch) public batches;
    mapping(bytes32 leaf => bool) public revoked;

    event Anchored(uint256 indexed batchId, bytes32 root);
    event Revoked(bytes32 indexed leaf);

    error NotIssuer();
    error AlreadyRevoked();

    modifier onlyIssuer() {
        if (msg.sender != issuer) revert NotIssuer();
        _;
    }

    constructor() {
        issuer = msg.sender;
    }

    function anchor(uint256 batchId, bytes32 root) external onlyIssuer {
        batches[batchId] = Batch({root: root, anchoredAt: uint64(block.timestamp), exists: true});
        emit Anchored(batchId, root);
    }

    /// Sorted-pair proof, matching OpenZeppelin's MerkleProof.
    /// A revoked leaf fails even when the proof is valid. Unknown batches fail closed.
    function verify(uint256 batchId, bytes32 leaf, bytes32[] calldata proof) external view returns (bool) {
        Batch storage batch = batches[batchId];
        if (!batch.exists || revoked[leaf]) return false;
        return MerkleProof.verifyCalldata(proof, batch.root, leaf);
    }

    // Membership is not checked here. verify() is what enforces the root.
    function revoke(bytes32 leaf) external onlyIssuer {
        if (revoked[leaf]) revert AlreadyRevoked();
        revoked[leaf] = true;
        emit Revoked(leaf);
    }
}
