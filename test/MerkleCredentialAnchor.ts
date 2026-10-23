import { expect } from "chai";
import { ethers } from "hardhat";
import { credentialHash } from "../scripts/lib/leaves";
import { merkleTree } from "../scripts/lib/merkle";

describe("MerkleCredentialAnchor", function () {
  async function deploy() {
    const [issuer, other] = await ethers.getSigners();
    const anchor = await (await ethers.getContractFactory("MerkleCredentialAnchor")).deploy();
    return { anchor, issuer, other };
  }

  it("anchors a batch and verifies every inclusion proof", async function () {
    const { anchor } = await deploy();
    const leaves = [0, 1, 2].map((index) => credentialHash(3, index));
    const { root, proofs } = merkleTree(leaves);

    await expect(anchor.anchor(1n, root)).to.emit(anchor, "Anchored").withArgs(1n, root);

    for (let i = 0; i < leaves.length; i++) {
      expect(await anchor.verify(1n, leaves[i], proofs[i])).to.equal(true);
    }

    expect(await anchor.verify(1n, leaves[0], [])).to.equal(false);
    expect(await anchor.verify(99n, leaves[0], proofs[0])).to.equal(false);
  });

  it("rejects a revoked leaf and a non-issuer", async function () {
    const { anchor, other } = await deploy();
    const leaf = credentialHash(1, 0);
    const { root, proofs } = merkleTree([leaf]);

    await anchor.anchor(1n, root);
    expect(await anchor.verify(1n, leaf, proofs[0])).to.equal(true);

    await expect(anchor.connect(other).revoke(leaf)).to.be.revertedWithCustomError(anchor, "NotIssuer");
    await expect(anchor.revoke(leaf)).to.emit(anchor, "Revoked").withArgs(leaf);
    expect(await anchor.verify(1n, leaf, proofs[0])).to.equal(false);
    await expect(anchor.revoke(leaf)).to.be.revertedWithCustomError(anchor, "AlreadyRevoked");
  });
});
