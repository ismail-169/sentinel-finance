const hre = require("hardhat");

async function main() {
  const vaultAddress = "0x4061A452CE5927C2420060Eb7A680798B86e0117";
  const vault = await hre.ethers.getContractAt("SentinelVault", vaultAddress);
  
  const [signer] = await hre.ethers.getSigners();
  const testVendor = "0x1234567890123456789012345678901234567890";
  
  console.log("Requesting payment...");
  const tx = await vault.requestPayment(
    testVendor,
    hre.ethers.parseUnits("50", 18),
    signer.address
  );
  await tx.wait();
  console.log("Payment requested!");
}

main().catch(console.error);