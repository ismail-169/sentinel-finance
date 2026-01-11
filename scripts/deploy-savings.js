

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying SentinelSavings Contract...\n");

  const network = hre.network.name;
  console.log(`📡 Network: ${network}`);

  const MNEE_ADDRESSES = {
    sepolia: "0x250ff89cf1518F42F3A4c927938ED73444491715",
    mainnet: "0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF"
  };

  const mneeAddress = MNEE_ADDRESSES[network];
  if (!mneeAddress) {
    throw new Error(`No MNEE address configured for network: ${network}`);
  }

  console.log(`💰 MNEE Token: ${mneeAddress}`);

  const [deployer] = await hre.ethers.getSigners();
  console.log(`👤 Deployer: ${deployer.address}`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`💵 Balance: ${hre.ethers.formatEther(balance)} ETH\n`);

  console.log("📦 Deploying SentinelSavings...");
  
  const SentinelSavings = await hre.ethers.getContractFactory("SentinelSavings");
  const savingsContract = await SentinelSavings.deploy(mneeAddress);
  
  await savingsContract.waitForDeployment();
  const savingsAddress = await savingsContract.getAddress();

  console.log(`✅ SentinelSavings deployed to: ${savingsAddress}\n`);

  
  const deploymentPath = path.join(__dirname, "..", "deployment.json");
  let deployment = {};
  
  if (fs.existsSync(deploymentPath)) {
    deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  }

  deployment.savingsContract = savingsAddress;
  deployment.savingsDeployedAt = new Date().toISOString();
  deployment.savingsNetwork = network;

  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log("📄 Updated deployment.json");

  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "SentinelSavings.sol",
    "SentinelSavings.json"
  );

  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const backendPath = path.join(__dirname, "..", "backend", "SentinelSavings.json");
    fs.writeFileSync(backendPath, JSON.stringify(artifact, null, 2));
    console.log("📋 Copied ABI to backend/SentinelSavings.json");
  }

  if (network !== "localhost" && network !== "hardhat") {
    console.log("\n⏳ Waiting for block confirmations...");
    await savingsContract.deploymentTransaction().wait(5);

    console.log("🔍 Verifying on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: savingsAddress,
        constructorArguments: [mneeAddress],
      });
      console.log("✅ Verified on Etherscan!");
    } catch (error) {
      console.log("⚠️ Verification failed:", error.message);
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("📊 DEPLOYMENT SUMMARY");
  console.log("=".repeat(50));
  console.log(`Network:          ${network}`);
  console.log(`MNEE Token:       ${mneeAddress}`);
  console.log(`SentinelSavings:  ${savingsAddress}`);
  console.log(`Deployer:         ${deployer.address}`);
  console.log("=".repeat(50));

  console.log("\n📝 NEXT STEPS:");
  console.log("1. Update frontend NETWORKS config with savingsContract address");
  console.log("2. Update backend .env with SAVINGS_CONTRACT_ADDRESS");
  console.log("3. Test createPlan and deposit functions");
  console.log("\n🎉 Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });