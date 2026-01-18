const hre = require("hardhat");
const fetch = require('node-fetch');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("=".repeat(50));
  console.log("SENTINEL FINANCE - MAINNET DEPLOYMENT");
  console.log("=".repeat(50));
  console.log("Deployer:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const balanceEth = hre.ethers.formatEther(balance);
  console.log("Balance:", balanceEth, "ETH");
  
  const REAL_MNEE_ADDRESS = "0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF";  // Declare ONCE at the top
  
  console.log("\n[Estimating Deployment Cost...]");

  // Get current gas price from provider (updated for ethers v6)
  const feeData = await hre.ethers.provider.getFeeData();
  const gasPrice = feeData.gasPrice;
  const gasPriceGwei = Number(hre.ethers.formatUnits(gasPrice, 'gwei')).toFixed(2);
  console.log("Current Gas Price:", gasPriceGwei, "Gwei");

  // Get factory artifact and estimate deployment gas WITH constructor params
  const VaultFactory = await hre.ethers.getContractFactory("VaultFactory");
  const deployTx = await VaultFactory.getDeployTransaction(REAL_MNEE_ADDRESS);
  const estimatedGas = await deployer.estimateGas(deployTx);
  console.log("Estimated Gas Units:", estimatedGas.toString());
  
  // Calculate total cost (gas units * gas price) + 20% buffer
  const totalCostWei = estimatedGas * gasPrice;
  const bufferCostWei = totalCostWei * BigInt(120) / BigInt(100);  // +20%
  const minEthNeeded = hre.ethers.formatEther(bufferCostWei);
  console.log("Minimum ETH Needed (with 20% buffer):", minEthNeeded, "ETH");
  
  // Fetch current ETH price for USD estimate (using Coingecko API)
  let ethUsd = 3300;  // Default fallback
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    const data = await response.json();
    ethUsd = data.ethereum.usd;
  } catch (err) {
    console.warn("ETH price fetch failed - using fallback $3300");
  }
  const minUsdNeeded = (parseFloat(minEthNeeded) * ethUsd).toFixed(0);
  console.log("Approximate USD Cost:", "~$" + minUsdNeeded);
  
  // Check balance against estimate
  if (parseFloat(balanceEth) < parseFloat(minEthNeeded)) {
    console.log("\n❌ INSUFFICIENT BALANCE");
    console.log("Need at least:", minEthNeeded, "ETH (~$" + minUsdNeeded + ")");
    console.log("Current balance:", balanceEth, "ETH");
    process.exit(1);
  }
  
  console.log("=".repeat(50));

  // REMOVED DUPLICATE: const REAL_MNEE_ADDRESS = "0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF";

  console.log("\n[1/2] Deploying VaultFactory...");
  console.log("Using MNEE Token:", REAL_MNEE_ADDRESS);
  
  const factory = await VaultFactory.deploy(REAL_MNEE_ADDRESS, {
    gasLimit: estimatedGas * BigInt(120) / BigInt(100),  // Use buffer for gas limit
    gasPrice: gasPrice,
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