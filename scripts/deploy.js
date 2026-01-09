const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = hre.network.name;
  console.log(`Deploying Sentinel Finance to ${network}...`);

  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${hre.ethers.formatEther(balance)} ETH`);

  let tokenAddress;

  if (network === "mainnet") {
    tokenAddress = "0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF";
    console.log(`Using mainnet MNEE: ${tokenAddress}`);
  } else {
    console.log("\n--- Deploying MockMNEE (with faucet) ---");
    const MockMNEE = await hre.ethers.getContractFactory("MockMNEE");
    const mockToken = await MockMNEE.deploy();
    await mockToken.waitForDeployment();
    tokenAddress = await mockToken.getAddress();
    console.log(`MockMNEE deployed: ${tokenAddress}`);
  }

  console.log("\n--- Deploying VaultFactory ---");
  const VaultFactory = await hre.ethers.getContractFactory("VaultFactory");
  const factory = await VaultFactory.deploy(tokenAddress);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log(`VaultFactory deployed: ${factoryAddress}`);

  const deployment = {
    network,
    deployer: deployer.address,
    tokenAddress,
    factoryAddress,
    deployedAt: new Date().toISOString()
  };

  fs.writeFileSync("deployment.json", JSON.stringify(deployment, null, 2));
  console.log("\nSaved to deployment.json");

  console.log("\n========================================");
  console.log("        DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log(`Network:       ${network}`);
  console.log(`MockMNEE:      ${tokenAddress}`);
  console.log(`VaultFactory:  ${factoryAddress}`);
  console.log("========================================");
  console.log("\nUpdate your App.js with these addresses:");
  console.log(`mneeToken: '${tokenAddress}'`);
  console.log(`vaultFactory: '${factoryAddress}'`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});