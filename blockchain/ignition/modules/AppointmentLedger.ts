import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const AppointmentLedgerModule = buildModule("AppointmentLedgerModule", (m) => {
  // This tells Ignition to find the "AppointmentLedger" contract and deploy it
  const ledger = m.contract("AppointmentLedger");

  return { ledger };
});

export default AppointmentLedgerModule;