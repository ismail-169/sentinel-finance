require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL
const MAINNET_RPC = process.env.MAINNET_RPC_URL 
const PRIVATE_KEY = process.env.PRIVATE_KEY 
const MAINNET_KEY = process.env.MAINNET_PRIVATE_KEY 
const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY 

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {},
    sepolia: {
      url: SEPOLIA_RPC,
      accounts: [PRIVATE_KEY],
      chainId: 11155111
    },
    mainnet: {
      url: MAINNET_RPC,
      accounts: MAINNET_KEY ? [MAINNET_KEY] : [],
      chainId: 1
    }
  },
  etherscan: {
    apiKey: ETHERSCAN_KEY
  }
};