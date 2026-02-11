import 'dotenv/config'
import '@nomicfoundation/hardhat-ethers'

const config = {
  solidity: '0.8.24',
  networks: {
    localhost: {
      url: process.env.WEB3_RPC_URL || 'http://127.0.0.1:8545',
    },
  },
}

export default config
