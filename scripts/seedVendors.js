import hre from "hardhat";
import fs from "fs";

async function main() {
  const deployment = JSON.parse(fs.readFileSync("deployment.json", "utf8"));
  const vendors = JSON.parse(fs.readFileSync("data/vendors.json", "utf8"));

  console.log(`Seeding vendors on ${deployment.network}...`);

  const vault = await hre.ethers.getContractAt("SentinelVault", deployment.vaultAddress);

  for (const vendor of vendors.trustedVendors) {
    console.log(`Adding ${vendor.name}: ${vendor.address}`);
    const tx = await vault.setTrustedVendor(vendor.address, true);
    await tx.wait();
    console.log(`  ✓ Added`);
  }

  console.log("\nAll vendors seeded successfully");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});