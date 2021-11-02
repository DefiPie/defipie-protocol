// >npx hardhat run scripts/deploy_maximillion.js --network mumbai

const hre = require("hardhat");
const dotenv = require('dotenv');
const fs = require('fs');
const envConfig = dotenv.parse(fs.readFileSync(`.env`));
for (const k in envConfig) {
    process.env[k] = envConfig[k]
}

async function main() {
    const Maximillion = await hre.ethers.getContractFactory("Maximillion");
    const maximillion = await Maximillion.deploy(
        process.env.PETH_ADDRESS
    );

    console.log(`Maximillion smart contract has been deployed to: ${maximillion.address}`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });