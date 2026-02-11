import crypto from 'node:crypto'

// A mock function to simulate blockchain interaction
// Replace this with your actual Web3/Ethers.js logic if you have it
export const recordAppointmentOnChain = async ({ reservationId, payloadHash }) => {
  console.log(`[Blockchain] Recording reservation ${reservationId} with hash ${payloadHash}`)
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500))

  // Return a success response
  return {
    txHash: '0x' + crypto.randomBytes(32).toString('hex'),
    txStatus: 'confirmed',
    chainId: 1337 // Localhost/Testnet ID
  }
}