const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("=".repeat(50));
  console.log("SENTINEL FINANCE - MAINNET DEPLOYMENT");
  console.log("=".repeat(50));
  console.log("Deployer:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const balanceEth = hre.ethers.formatEther(balance);
  console.log("Balance:", balanceEth, "ETH");
  
  if (parseFloat(balanceEth) < 0.05) {
    console.log("\n❌ INSUFFICIENT BALANCE");
    console.log("Need at least 0.05 ETH (~$150-200) for deployment");
    console.log("Current balance:", balanceEth, "ETH");
    process.exit(1);
  }
  
  console.log("=".repeat(50));

  const REAL_MNEE_ADDRESS = "0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF";

  console.log("\n[1/2] Deploying VaultFactory...");
  console.log("Using MNEE Token:", REAL_MNEE_ADDRESS);
  
  const VaultFactory = await hre.ethers.getContractFactory("VaultFactory");
  const factory = await VaultFactory.deploy(REAL_MNEE_ADDRESS, {
    gasLimit: 3000000
  });
  await factory.waitForDeployment();
  
  const factoryAddress = await factory.getAddress();
  console.log("VaultFactory deployed:", factoryAddress);

  console.log("\n[2/2] Verifying deployment...");
  const mneeInFactory = await factory.mneeToken();
  console.log("MNEE in Factory:", mneeInFactory);
  console.log("Admin:", await factory.admin());

  console.log("\n" + "=".repeat(50));
  console.log("DEPLOYMENT COMPLETE");
  console.log("=".repeat(50));
  console.log("VaultFactory:", factoryAddress);
  console.log("MNEE Token:", REAL_MNEE_ADDRESS);
  console.log("=".repeat(50));

  console.log("\nUpdate App.js with:");
  console.log(`mainnet: {`);
  console.log(`  mneeToken: '${REAL_MNEE_ADDRESS}',`);
  console.log(`  vaultFactory: '${factoryAddress}'`);
  console.log(`}`);

  console.log("\nTo verify on Etherscan:");
  console.log(`npx hardhat verify --network mainnet ${factoryAddress} "${REAL_MNEE_ADDRESS}"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });