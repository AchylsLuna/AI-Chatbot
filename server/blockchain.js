import { ethers } from 'ethers'

const DEFAULT_ABI = [
  'function recordAppointmentHash(string reservationId, bytes32 payloadHash) public returns (bytes32)',
]

const loadAbi = () => {
  if (process.env.CONTRACT_ABI) {
    try {
      return JSON.parse(process.env.CONTRACT_ABI)
    } catch (error) {
      console.warn('Invalid CONTRACT_ABI JSON. Falling back to default ABI.')
    }
  }
  return DEFAULT_ABI
}

export const recordAppointmentOnChain = async ({
  reservationId,
  payloadHash,
}) => {
  if (!payloadHash) {
    throw new Error('payloadHash is required for blockchain logging')
  }
  const rpcUrl = process.env.WEB3_RPC_URL
  const contractAddress = process.env.CONTRACT_ADDRESS
  const privateKey = process.env.CONTRACT_PRIVATE_KEY

  if (!rpcUrl || !contractAddress || !privateKey) {
    return { txStatus: 'skipped', txHash: null, chainId: null }
  }

  const abi = loadAbi()
  const functionName = process.env.CONTRACT_FUNCTION || 'recordAppointmentHash'

  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const wallet = new ethers.Wallet(privateKey, provider)
  const contract = new ethers.Contract(contractAddress, abi, wallet)

  if (typeof contract[functionName] !== 'function') {
    throw new Error(`Contract function ${functionName} not found in ABI`)
  }

  const tx = await contract[functionName](reservationId, payloadHash)
  const receipt = await tx.wait()
  const network = await provider.getNetwork()

  return {
    txStatus: receipt?.status === 1 ? 'confirmed' : 'failed',
    txHash: tx.hash,
    chainId: network.chainId.toString(),
  }
}
