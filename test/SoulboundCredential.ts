import { expect } from "chai";
import { ethers } from "hardhat";

describe("SoulboundCredential", function () {
  async function deploy() {
    const [issuer, student, other] = await ethers.getSigners();
    const credentials = await (await ethers.getContractFactory("SoulboundCredential")).deploy();
    return { credentials, issuer, student, other };
  }

  it("mints a locked credential and blocks transfer and approval", async function () {
    const { credentials, student, other } = await deploy();
    const hash = ethers.id("credential-1");

    await expect(credentials.mint(student.address, hash))
      .to.emit(credentials, "Locked")
      .withArgs(1n);

    expect(await credentials.verify(1n)).to.equal(true);
    expect(await credentials.ownerOf(1n)).to.equal(student.address);
    expect(await credentials.credentialHash(1n)).to.equal(hash);
    expect(await credentials.locked(1n)).to.equal(true);

    await expect(
      credentials.connect(student).transferFrom(student.address, other.address, 1n),
    ).to.be.revertedWithCustomError(credentials, "Soulbound");
    await expect(credentials.connect(student).approve(other.address, 1n)).to.be.revertedWithCustomError(
      credentials,
      "Soulbound",
    );
  });

  it("revokes by burning", async function () {
    const { credentials, student, other } = await deploy();

    await credentials.mint(student.address, ethers.id("credential-1"));
    await expect(credentials.connect(other).revoke(1n)).to.be.revertedWithCustomError(credentials, "NotIssuer");

    await expect(credentials.revoke(1n)).to.emit(credentials, "Revoked").withArgs(1n);
    expect(await credentials.verify(1n)).to.equal(false);
    expect(await credentials.locked(1n)).to.equal(false);
    await expect(credentials.ownerOf(1n)).to.be.revertedWithCustomError(credentials, "ERC721NonexistentToken");
  });
});
