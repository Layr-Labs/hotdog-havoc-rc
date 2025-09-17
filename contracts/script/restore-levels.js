const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Load contract data from avsTaskHook.json
const contractData = JSON.parse(fs.readFileSync(path.join(__dirname, '../outputs/devnet/avsTaskHook.json'), 'utf8'));

// HotdogHavoc ABI - only the functions we need
const ABI = [
    "function createLevel(string memory name, tuple(uint8 x, uint8 y)[] memory blocks) public returns (uint256)"
];

// Developer wallet private key
const PRIVATE_KEY = '5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';

// Contract address from avsTaskHook.json
const CONTRACT_ADDRESS = contractData.address;

async function main() {
    // Connect to local Anvil
    const provider = new ethers.JsonRpcProvider('http://localhost:9545');
    
    // Create wallet from private key
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log('Using wallet address:', wallet.address);

    // Create contract instance with signer
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

    // Read the snapshot file
    const snapshot = JSON.parse(fs.readFileSync('level-snapshot.json', 'utf8'));
    console.log(`Found ${snapshot.levels.length} levels to restore`);

    // Restore each level
    for (const level of snapshot.levels) {
        console.log(`Creating level: ${level.name}`);
        try {
            const tx = await contract.createLevel(level.name, level.blocks);
            console.log(`Transaction sent: ${tx.hash}`);
            await tx.wait();
            console.log(`Level "${level.name}" created successfully`);
        } catch (error) {
            console.error(`Failed to create level "${level.name}":`, error.message);
        }
    }

    console.log('Level restoration complete');
}

main().catch(console.error); 