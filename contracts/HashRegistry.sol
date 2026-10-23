// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// One storage record per credential hash.
contract HashRegistry {
    address public issuer;

    enum Status {
        None,
        Issued,
        Revoked
    }

    struct Record {
        Status status;
        uint64 issuedAt;
    }

    mapping(bytes32 credentialHash => Record) public records;

    event Issued(bytes32 indexed credentialHash);
    event Revoked(bytes32 indexed credentialHash);

    error NotIssuer();
    error AlreadyIssued();
    error NotIssued();

    modifier onlyIssuer() {
        if (msg.sender != issuer) revert NotIssuer();
        _;
    }

    constructor() {
        issuer = msg.sender;
    }

    function issue(bytes32 credentialHash) external onlyIssuer {
        if (records[credentialHash].status != Status.None) revert AlreadyIssued();
        records[credentialHash] = Record({status: Status.Issued, issuedAt: uint64(block.timestamp)});
        emit Issued(credentialHash);
    }

    function verify(bytes32 credentialHash) external view returns (bool) {
        return records[credentialHash].status == Status.Issued;
    }

    function revoke(bytes32 credentialHash) external onlyIssuer {
        if (records[credentialHash].status != Status.Issued) revert NotIssued();
        records[credentialHash].status = Status.Revoked;
        emit Revoked(credentialHash);
    }
}
