const hre = require("hardhat");

async function main() {
  const tokenAddress = "0xc486DF540703b0BC257feF2228a9b6AA1b3DaD82";
  const vaultAddress = "0x4061A452CE5927C2420060Eb7A680798B86e0117";

  const token = await hre.ethers.getContractAt("MockMNEE", tokenAddress);
  const vault = await hre.ethers.getContractAt("SentinelVault", vaultAddress);

  const [signer] = await hre.ethers.getSigners();
  console.log("Using account:", signer.address);

  
  const balance = await token.balanceOf(signer.address);
  console.log("Token balance:", hre.ethers.formatUnits(balance, 18), "MNEE");

  
  console.log("Approving vault...");
  const approveTx = await token.approve(vaultAddress, hre.ethers.parseUnits("10000", 18));
  await approveTx.wait();
  console.log("Approved!");

  
  console.log("Depositing 1000 MNEE...");
  const depositTx = await vault.deposit(hre.ethers.parseUnits("1000", 18));
  await depositTx.wait();
  console.log("Deposited!");

 
  const vaultBalance = await vault.getVaultBalance();
  console.log("Vault balance:", hre.ethers.formatUnits(vaultBalance, 18), "MNEE");
}

main().catch(console.error);