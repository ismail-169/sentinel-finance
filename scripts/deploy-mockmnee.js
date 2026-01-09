const { ethers } = require("hardhat");

async function main() {
  const MockMNEE = await ethers.getContractFactory("MockMNEE");
  const mnee = await MockMNEE.deploy();
  await mnee.waitForDeployment();
  console.log("MockMNEE deployed to:", await mnee.getAddress());
}

main().catch(console.error);