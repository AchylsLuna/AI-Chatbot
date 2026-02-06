import hre from 'hardhat'

const { ethers } = hre

const main = async () => {
  const Ledger = await ethers.getContractFactory('AppointmentLedger')
  const ledger = await Ledger.deploy()
  await ledger.waitForDeployment()
  console.log('AppointmentLedger deployed to:', await ledger.getAddress())
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
