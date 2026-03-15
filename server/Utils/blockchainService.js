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

const rpcUrl = String(process.env.RPC_URL || "").trim();
const systemWalletPrivateKey = String(process.env.SYSTEM_WALLET_PRIVATE_KEY || "").trim();
const contractAddress = String(process.env.CONTRACT_ADDRESS || "").trim();
const hasBlockchainConfig = Boolean(rpcUrl && systemWalletPrivateKey && contractAddress);

let provider = null;
let wallet = null;
let contract = null;
let blockchainEnabled = false;

if (hasBlockchainConfig) {
    try {
        provider = new ethers.JsonRpcProvider(rpcUrl);
        wallet = new ethers.Wallet(systemWalletPrivateKey, provider);
        contract = new ethers.Contract(contractAddress, contractABI, wallet);
        blockchainEnabled = true;
    } catch (error) {
        console.warn("[Blockchain] Disabled due to invalid runtime configuration.", error?.message || error);
    }
} else {
    console.warn("[Blockchain] Disabled because RPC_URL, SYSTEM_WALLET_PRIVATE_KEY, or CONTRACT_ADDRESS is not configured.");
}

export const blockchainService = {
    async logAppointmentToChain(mongoId, patientId, doctorId) {
            if (!blockchainEnabled) return null;
            try {
                // 1. Check balance BEFORE the transaction
                const balanceBefore = await provider.getBalance(wallet.address);
                console.log(`[Gas Check] Balance Before: ${ethers.formatEther(balanceBefore)} ETH`);

                // 2. Execute the transaction
                const tx = await contract.recordAppointment(String(mongoId), String(patientId), String(doctorId));
                
                // Wait for it to actually mine so the fee is deducted
                await tx.wait(); 
                
                // 3. Check balance AFTER the transaction
                const balanceAfter = await provider.getBalance(wallet.address);
                console.log(`[Gas Check] Balance After:  ${ethers.formatEther(balanceAfter)} ETH`);
                
                console.log(`[Blockchain] Appointment Logged: ${tx.hash}`);
                return tx.hash;
            } catch (error) { 
                console.error("Blockchain Error:", error); 
            }
        },
    async updateStatusOnChain(mongoId, statusString) {
        if (!blockchainEnabled) return null;
        try {
            const statusMap = { 'Pending': 0, 'Confirmed': 1, 'Completed': 2, 'Cancelled': 3 };
            const tx = await contract.updateStatus(String(mongoId), statusMap[statusString]);
            console.log(`[Blockchain] Status Updated: ${tx.hash}`);
        } catch (error) { console.error("Blockchain Error:", error); }
    },
    async updateSoapNoteOnChain(mongoId, hash) {
        if (!blockchainEnabled) return null;
        try {
            const tx = await contract.updateSoapNote(String(mongoId), hash);
            console.log(`[Blockchain] SOAP Hash Secured: ${tx.hash}`);
        } catch (error) { console.error("Blockchain Error:", error); }
    },
    async updatePrescriptionsOnChain(mongoId, hash) {
        if (!blockchainEnabled) return null;
        try {
            const tx = await contract.updatePrescriptions(String(mongoId), hash);
            console.log(`[Blockchain] Prescription Hash Secured: ${tx.hash}`);
        } catch (error) { console.error("Blockchain Error:", error); }
    }
};
