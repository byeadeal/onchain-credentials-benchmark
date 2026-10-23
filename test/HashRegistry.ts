import { expect } from "chai";
import { ethers } from "hardhat";

describe("HashRegistry", function () {
  async function deploy() {
    const [issuer, other] = await ethers.getSigners();
    const registry = await (await ethers.getContractFactory("HashRegistry")).deploy();
    return { registry, issuer, other };
  }

  it("issues, verifies, and revokes a credential", async function () {
    const { registry } = await deploy();
    const hash = ethers.id("credential-1");

    expect(await registry.verify(hash)).to.equal(false);

    await expect(registry.issue(hash)).to.emit(registry, "Issued").withArgs(hash);
    expect(await registry.verify(hash)).to.equal(true);

    await expect(registry.revoke(hash)).to.emit(registry, "Revoked").withArgs(hash);
    expect(await registry.verify(hash)).to.equal(false);
  });

  it("rejects a second issue, a bad revoke, and a non-issuer", async function () {
    const { registry, other } = await deploy();
    const hash = ethers.id("credential-1");

    await registry.issue(hash);
    await expect(registry.issue(hash)).to.be.revertedWithCustomError(registry, "AlreadyIssued");
    await expect(registry.connect(other).revoke(hash)).to.be.revertedWithCustomError(registry, "NotIssuer");

    const unknown = ethers.id("missing");
    await expect(registry.revoke(unknown)).to.be.revertedWithCustomError(registry, "NotIssued");
  });
});
