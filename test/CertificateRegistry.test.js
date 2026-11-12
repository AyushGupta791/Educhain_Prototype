const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

// Synthetic test data only. No real people or documents.
const hashOf = (text) => ethers.sha256(ethers.toUtf8Bytes(text));
const Status = { None: 0n, Active: 1n, Revoked: 2n };
const CERT_1 = hashOf("SYNTHETIC CERTIFICATE #0001 - Example University - BSc Software Engineering");
const CERT_2 = hashOf("SYNTHETIC CERTIFICATE #0002 - Example University - BSc Cybersecurity");

async function deployFixture() {
  const [admin, issuerA, issuerB, outsider] = await ethers.getSigners();
  const registry = await ethers.deployContract("CertificateRegistry", [admin.address]);
  const ISSUER_ROLE = await registry.ISSUER_ROLE();
  await registry.connect(admin).grantRole(ISSUER_ROLE, issuerA.address);
  await registry.connect(admin).grantRole(ISSUER_ROLE, issuerB.address);
  return { registry, admin, issuerA, issuerB, outsider, ISSUER_ROLE };
}

describe("CertificateRegistry", () => {
  it("1. authorized issuer can register a certificate hash", async () => {
    const { registry, issuerA } = await loadFixture(deployFixture);
    await expect(registry.connect(issuerA).registerCertificate(CERT_1, "REF-0001"))
      .to.emit(registry, "CertificateRegistered")
      .withArgs(CERT_1, issuerA.address, "REF-0001");
    const res = await registry.verifyCertificate(CERT_1);
    expect(res.status).to.equal(Status.Active);
    expect(res.issuer).to.equal(issuerA.address);
  });

  it("2. unauthorized account cannot register a certificate hash", async () => {
    const { registry, outsider } = await loadFixture(deployFixture);
    await expect(registry.connect(outsider).registerCertificate(CERT_1, "REF-0001"))
      .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
  });

  it("3. anyone can verify a registered hash and gets the correct status", async () => {
    const { registry, issuerA, outsider } = await loadFixture(deployFixture);
    await registry.connect(issuerA).registerCertificate(CERT_1, "REF-0001");
    const res = await registry.connect(outsider).verifyCertificate(CERT_1);
    expect(res.status).to.equal(Status.Active);
    expect(res.registeredAt).to.be.gt(0n);
  });

  it("4. unknown hash is not verified (status None)", async () => {
    const { registry } = await loadFixture(deployFixture);
    const res = await registry.verifyCertificate(CERT_2);
    expect(res.status).to.equal(Status.None);
    expect(res.issuer).to.equal(ethers.ZeroAddress);
  });

  it("5. a tampered document (different hash) does not verify", async () => {
    const { registry, issuerA } = await loadFixture(deployFixture);
    await registry.connect(issuerA).registerCertificate(CERT_1, "REF-0001");
    const tampered = hashOf("SYNTHETIC CERTIFICATE #0001 - Example University - MSc Software Engineering");
    const res = await registry.verifyCertificate(tampered);
    expect(res.status).to.equal(Status.None);
  });

  it("6. issuer can revoke its own certificate; revoked record no longer verifies as active", async () => {
    const { registry, issuerA } = await loadFixture(deployFixture);
    await registry.connect(issuerA).registerCertificate(CERT_1, "REF-0001");
    await expect(registry.connect(issuerA).revokeCertificate(CERT_1))
      .to.emit(registry, "CertificateRevoked")
      .withArgs(CERT_1, issuerA.address);
    const res = await registry.verifyCertificate(CERT_1);
    expect(res.status).to.equal(Status.Revoked);
  });

  it("7. duplicate registration is rejected (also after revocation)", async () => {
    const { registry, issuerA, issuerB } = await loadFixture(deployFixture);
    await registry.connect(issuerA).registerCertificate(CERT_1, "REF-0001");
    await expect(registry.connect(issuerB).registerCertificate(CERT_1, "REF-X"))
      .to.be.revertedWithCustomError(registry, "AlreadyRegistered");
    await registry.connect(issuerA).revokeCertificate(CERT_1);
    await expect(registry.connect(issuerA).registerCertificate(CERT_1, "REF-0001"))
      .to.be.revertedWithCustomError(registry, "AlreadyRegistered");
  });

  it("8. empty (zero) hash is rejected", async () => {
    const { registry, issuerA } = await loadFixture(deployFixture);
    await expect(registry.connect(issuerA).registerCertificate(ethers.ZeroHash, "REF-0"))
      .to.be.revertedWithCustomError(registry, "EmptyHash");
  });

  it("9. an issuer cannot revoke another issuer's certificate", async () => {
    const { registry, issuerA, issuerB } = await loadFixture(deployFixture);
    await registry.connect(issuerA).registerCertificate(CERT_1, "REF-0001");
    await expect(registry.connect(issuerB).revokeCertificate(CERT_1))
      .to.be.revertedWithCustomError(registry, "NotRecordIssuer");
    expect((await registry.verifyCertificate(CERT_1)).status).to.equal(Status.Active);
  });

  it("10. unauthorized account cannot revoke; unknown and already revoked hashes revert", async () => {
    const { registry, issuerA, outsider } = await loadFixture(deployFixture);
    await registry.connect(issuerA).registerCertificate(CERT_1, "REF-0001");
    await expect(registry.connect(outsider).revokeCertificate(CERT_1))
      .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    await expect(registry.connect(issuerA).revokeCertificate(CERT_2))
      .to.be.revertedWithCustomError(registry, "NotRegistered");
    await registry.connect(issuerA).revokeCertificate(CERT_1);
    await expect(registry.connect(issuerA).revokeCertificate(CERT_1))
      .to.be.revertedWithCustomError(registry, "AlreadyRevoked");
  });

  it("11. admin cannot register or revoke certificates (least privilege)", async () => {
    const { registry, admin } = await loadFixture(deployFixture);
    await expect(registry.connect(admin).registerCertificate(CERT_1, "REF-0001"))
      .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
  });

  it("12. only admin can grant roles and pause; pause blocks registration, not revocation", async () => {
    const { registry, admin, issuerA, outsider, ISSUER_ROLE } = await loadFixture(deployFixture);
    await expect(registry.connect(outsider).grantRole(ISSUER_ROLE, outsider.address))
      .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    await expect(registry.connect(outsider).pause())
      .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");

    await registry.connect(issuerA).registerCertificate(CERT_1, "REF-0001");
    await registry.connect(admin).pause();
    await expect(registry.connect(issuerA).registerCertificate(CERT_2, "REF-0002"))
      .to.be.revertedWithCustomError(registry, "EnforcedPause");
    await registry.connect(issuerA).revokeCertificate(CERT_1); // still allowed during an incident

    await registry.connect(admin).unpause();
    await registry.connect(issuerA).registerCertificate(CERT_2, "REF-0002");
    expect((await registry.verifyCertificate(CERT_2)).status).to.equal(Status.Active);
  });
});
