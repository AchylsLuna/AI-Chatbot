import { expect } from "chai";
import hre from "hardhat";

describe("AppointmentLedger", function () {
  let ledger: any;
  let systemWallet: any;
  let otherAccount: any;
  let doctorWallet: any;

  // This runs automatically before every single 'it' block
  beforeEach(async function () {
    [systemWallet, otherAccount, doctorWallet] = await hre.ethers.getSigners();
    
    const Ledger = await hre.ethers.getContractFactory("AppointmentLedger");
    ledger = await Ledger.deploy();
  });

  describe("Deployment", function () {
    it("Should set the right system wallet", async function () {
      // The systemWallet address in the contract should match the deployer's address
      expect(await ledger.systemWallet()).to.equal(systemWallet.address);
    });
  });

  describe("Transactions", function () {
    const mockMongoId = "65a1b2c3d4e5f6g7h8i9j0k1";
    const patientId = "pat_123";
    const doctorId = "doc_456";

    it("Should record an appointment and emit AppointmentCreated event", async function () {
      const tx = await ledger.recordAppointment(mockMongoId, patientId, doctorId);

      await expect(tx)
        .to.emit(ledger, "AppointmentCreated")
        .withArgs(mockMongoId, patientId, doctorId);

      const record = await ledger.records(mockMongoId);
      expect(record.status).to.equal(0); 
    });

    it("Should update the appointment status and emit StatusUpdated event", async function () {
      await ledger.recordAppointment(mockMongoId, patientId, doctorId);

      const tx = await ledger.updateStatus(mockMongoId, 2);

      await expect(tx)
        .to.emit(ledger, "StatusUpdated")
        .withArgs(mockMongoId, 2);

      const record = await ledger.records(mockMongoId);
      expect(record.status).to.equal(2);
    });

    it("Should securely store a SOAP Note Hash", async function () {
      const mockHash = "8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b";

      await ledger.recordAppointment(mockMongoId, patientId, doctorId);
      
      const tx = await ledger.updateSoapNote(mockMongoId, mockHash);

      await expect(tx)
        .to.emit(ledger, "SoapNoteUpdated")
        .withArgs(mockMongoId, mockHash);

      const record = await ledger.records(mockMongoId);
      expect(record.soapNoteHash).to.equal(mockHash);
    });
  });

  describe("Security (Access Control)", function () {
    const mockMongoId = "65a1b2c3d4e5f6g7h8i9j0k1";

    it("Should revert if anyone other than the system wallet tries to update status", async function () {
      await expect(
        ledger.connect(otherAccount).updateStatus(mockMongoId, 1)
      ).to.be.revertedWith("Only system relayer can execute");
    });

    it("Should revert if unauthorized account tries to update medical hashes", async function () {
      const fakeHash = "invalid_hash_data";

      await expect(
        ledger.connect(doctorWallet).updateSoapNote(mockMongoId, fakeHash)
      ).to.be.revertedWith("Only system relayer can execute");
    });
  });
});