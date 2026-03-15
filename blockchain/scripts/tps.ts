import { network } from "hardhat";

async function main() {
    const connection = await network.connect();
    const { ethers, provider } = connection;
    const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
    
    try {
        const ledger = await ethers.getContractAt("AppointmentLedger", CONTRACT_ADDRESS);
        const [signer] = await ethers.getSigners();

        // 1. Disable automining so transactions queue in the mempool
        await provider.request({ method: "evm_setAutomine", params: [false] });

        console.log(`Starting TPS Test with wallet: ${signer.address}`);
        console.log("Sending 500 transactions into the mempool...");
        console.time("TPS Test Duration");

        let currentNonce = await ethers.provider.getTransactionCount(signer.address);
        const txPromises = [];

        for (let i = 0; i < 500; i++) {
            const tx = ledger.recordAppointment(`bulk_id_${i}`, "pat_123", "doc_456", {
                nonce: currentNonce++
            });
            txPromises.push(tx);
        }

        // Wait for all HTTP requests to reach the node
        const responses = await Promise.all(txPromises);
        
        console.log("All transactions queued. Mining block...");
        
        // 2. Manually mine all 500 transactions into a single block
        await provider.request({ method: "evm_mine", params: [] });

        await responses[responses.length - 1].wait();
        console.timeEnd("TPS Test Duration");

        // 3. Turn automining back on for normal use
        await provider.request({ method: "evm_setAutomine", params: [true] });
    } finally {
        await connection.close();
    }
}

main().catch((error) => {
    console.error("TPS Test Failed:", error);
    process.exitCode = 1;
});
