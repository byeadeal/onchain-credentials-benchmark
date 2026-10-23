// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// ERC-721 credential that cannot be transferred. Revocation burns it.
/// The lock and issuer-burn behaviour follows ERC-5192 and ERC-5484 in spirit.
contract SoulboundCredential is ERC721 {
    address public issuer;
    uint256 private _nextId;

    mapping(uint256 tokenId => bytes32) public credentialHash;
    mapping(uint256 tokenId => bool) public locked;

    event Locked(uint256 indexed tokenId);
    event Revoked(uint256 indexed tokenId);

    error NotIssuer();
    error Soulbound();

    modifier onlyIssuer() {
        if (msg.sender != issuer) revert NotIssuer();
        _;
    }

    constructor() ERC721("Student Credential", "CRED") {
        issuer = msg.sender;
    }

    function mint(address student, bytes32 hash) external onlyIssuer returns (uint256 tokenId) {
        tokenId = ++_nextId;
        _safeMint(student, tokenId);
        credentialHash[tokenId] = hash;
        locked[tokenId] = true;
        emit Locked(tokenId);
    }

    function verify(uint256 tokenId) external view returns (bool) {
        return _ownerOf(tokenId) != address(0) && locked[tokenId];
    }

    function revoke(uint256 tokenId) external onlyIssuer {
        _burn(tokenId);
        delete credentialHash[tokenId];
        delete locked[tokenId];
        emit Revoked(tokenId);
    }

    function approve(address, uint256) public pure override {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert Soulbound();
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }
}
