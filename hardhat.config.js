require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/DjC-dfft5f193-RJ1YmEi";
const MAINNET_RPC = process.env.MAINNET_RPC_URL || "https://eth.llamarpc.com";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
const MAINNET_KEY = process.env.MAINNET_PRIVATE_KEY || "";
const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY || "";

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