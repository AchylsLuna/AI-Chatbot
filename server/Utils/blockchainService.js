import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

// Minimal ABI for the functions we need
const contractABI = [
    "function recordAppointment(string _mongoId, string _patientId, string _doctorId) public",
    "function updateStatus(string _mongoId, uint8 _newStatus) public",
    "function updateSoapNote(string _mongoId, string _hash) public",
    "function updatePrescriptions(string _mongoId, string _hash) public"
];

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.SYSTEM_WALLET_PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractABI, wallet);

export const blockchainService = {
    async logAppointmentToChain(mongoId, patientId, doctorId) {
        try {
            const tx = await contract.recordAppointment(String(mongoId), String(patientId), String(doctorId));
            console.log(`[Blockchain] Appointment Logged: ${tx.hash}`);
            return tx.hash;
        } catch (error) { console.error("Blockchain Error:", error); }
    },
    async updateStatusOnChain(mongoId, statusString) {
        try {
            const statusMap = { 'Pending': 0, 'Confirmed': 1, 'Completed': 2, 'Cancelled': 3 };
            const tx = await contract.updateStatus(String(mongoId), statusMap[statusString]);
            console.log(`[Blockchain] Status Updated: ${tx.hash}`);
        } catch (error) { console.error("Blockchain Error:", error); }
    },
    async updateSoapNoteOnChain(mongoId, hash) {
        try {
            const tx = await contract.updateSoapNote(String(mongoId), hash);
            console.log(`[Blockchain] SOAP Hash Secured: ${tx.hash}`);
        } catch (error) { console.error("Blockchain Error:", error); }
    },
    async updatePrescriptionsOnChain(mongoId, hash) {
        try {
            const tx = await contract.updatePrescriptions(String(mongoId), hash);
            console.log(`[Blockchain] Prescription Hash Secured: ${tx.hash}`);
        } catch (error) { console.error("Blockchain Error:", error); }
    }
};