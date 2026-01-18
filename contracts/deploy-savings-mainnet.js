const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("=".repeat(50));
  console.log("SENTINEL SAVINGS - MAINNET DEPLOYMENT");
  console.log("=".repeat(50));
  console.log("Deployer:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const balanceEth = hre.ethers.formatEther(balance);
  console.log("Balance:", balanceEth, "ETH");

  const REAL_MNEE_ADDRESS = "0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF";
  
  console.log("\n[Estimating Deployment Cost...]");
  
  const feeData = await hre.ethers.provider.getFeeData();
  const gasPrice = feeData.gasPrice;
  const gasPriceGwei = Number(hre.ethers.formatUnits(gasPrice, 'gwei')).toFixed(2);
  console.log("Current Gas Price:", gasPriceGwei, "Gwei");

  const SentinelSavings = await hre.ethers.getContractFactory("SentinelSavings");
  const deployTx = await SentinelSavings.getDeployTransaction(REAL_MNEE_ADDRESS);
  const estimatedGas = await deployer.estimateGas(deployTx);
  console.log("Estimated Gas Units:", estimatedGas.toString());
  
  const totalCostWei = estimatedGas * gasPrice;
  const bufferCostWei = totalCostWei * BigInt(120) / BigInt(100);
  const minEthNeeded = hre.ethers.formatEther(bufferCostWei);
  console.log("Minimum ETH Needed (with 20% buffer):", minEthNeeded, "ETH");
  
  if (parseFloat(balanceEth) < parseFloat(minEthNeeded)) {
    console.log("\n❌ INSUFFICIENT BALANCE");
    console.log("Need at least:", minEthNeeded, "ETH");
    console.log("Current balance:", balanceEth, "ETH");
    process.exit(1);
  }
  
  console.log("=".repeat(50));

  console.log("\n[1/2] Deploying SentinelSavings...");
  console.log("Using MNEE Token:", REAL_MNEE_ADDRESS);
  
  const savings = await SentinelSavings.deploy(REAL_MNEE_ADDRESS, {
    gasLimit: estimatedGas * BigInt(120) / BigInt(100),
    gasPrice: gasPrice,
  });
  await savings.waitForDeployment();
  
  const savingsAddress = await savings.getAddress();
  console.log("SentinelSavings deployed:", savingsAddress);

  console.log("\n[2/2] Verifying deployment...");
  const mneeInSavings = await savings.mneeToken();
  console.log("MNEE in Savings:", mneeInSavings);

  console.log("\n" + "=".repeat(50));
  console.log("DEPLOYMENT COMPLETE");
  console.log("=".repeat(50));
  console.log("SentinelSavings:", savingsAddress);
  console.log("MNEE Token:", REAL_MNEE_ADDRESS);
  console.log("=".repeat(50));

  console.log("\nUpdate your frontend with:");
  console.log(`sentinelSavings: '${savingsAddress}'`);

  console.log("\nTo verify on Etherscan:");
  console.log(`npx hardhat verify --network mainnet ${savingsAddress} "${REAL_MNEE_ADDRESS}"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });