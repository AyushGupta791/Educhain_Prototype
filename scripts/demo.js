// End-to-end demo of the main use case on the local Hardhat network (synthetic data only).
// Run: npx hardhat run scripts/demo.js     (never prints keys)
const { ethers } = require("hardhat");

const STATUS = ["None (not found)", "Active (valid)", "Revoked"];
const hashOf = (t) => ethers.sha256(ethers.toUtf8Bytes(t));
const step = (n, msg) => console.log(`\n=== Step ${n}: ${msg}`);

async function main() {
  const [admin, university, employer] = await ethers.getSigners();

  step(1, "Deploy the contract (admin = test account #0)");
  const registry = await ethers.deployContract("CertificateRegistry", [admin.address]);
  await registry.waitForDeployment();
  console.log("Contract address:", await registry.getAddress());

  step(2, "Admin grants ISSUER_ROLE to the university test account");
  await (await registry.connect(admin).grantRole(await registry.ISSUER_ROLE(), university.address)).wait();
  console.log("Issuer:", university.address);

  step(3, "University hashes a SYNTHETIC certificate off-chain and registers the hash");
  const certificate = "SYNTHETIC CERTIFICATE #0001 - Example University - BSc Software Engineering";
  const h = hashOf(certificate);
  console.log("SHA-256 hash:", h);
  await (await registry.connect(university).registerCertificate(h, "REF-0001")).wait();
  console.log("Registered. Only the hash and an opaque reference are on-chain.");

  step(4, "Employer verifies the genuine document");
  let r = await registry.connect(employer).verifyCertificate(h);
  console.log("Result:", STATUS[Number(r.status)]);

  step(5, "Employer verifies a TAMPERED document (one word changed)");
  const tampered = hashOf(certificate.replace("BSc", "MSc"));
  r = await registry.connect(employer).verifyCertificate(tampered);
  console.log("Result:", STATUS[Number(r.status)]);

  step(6, "Unauthorized account tries to register a hash");
  try {
    await registry.connect(employer).registerCertificate(hashOf("FAKE"), "REF-FAKE");
  } catch (e) {
    console.log("Rejected as expected:", e.message.split("\n")[0].slice(0, 120));
  }

  step(7, "University revokes the certificate (e.g. issued in error)");
  await (await registry.connect(university).revokeCertificate(h)).wait();
  r = await registry.connect(employer).verifyCertificate(h);
  console.log("Result after revocation:", STATUS[Number(r.status)]);

  console.log("\nDemo finished. Now run the tests with: npx hardhat test");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
