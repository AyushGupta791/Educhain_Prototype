// Deploys CertificateRegistry to the local Hardhat Network using a test account.
// Run: npx hardhat run scripts/deploy.js
const { ethers } = require("hardhat");

async function main() {
  const [admin] = await ethers.getSigners(); // test account created by Hardhat
  const registry = await ethers.deployContract("CertificateRegistry", [admin.address]);
  await registry.waitForDeployment();
  console.log("CertificateRegistry deployed (local Hardhat network) at:", await registry.getAddress());
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
