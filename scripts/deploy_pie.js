const hre = require("hardhat");
const dotenv = require('dotenv');
const network = hre.network.name;
const fs = require('fs');
const envConfig = dotenv.parse(fs.readFileSync(`.env`));
for (const k in envConfig) {
    process.env[k] = envConfig[k]
}

async function main() {
    //Deploy of staking smart contract
    const Pie = await hre.ethers.getContractFactory("Pie");
    const pie = await Pie.deploy(
        process.env.PIE_HOLDER
    );

    console.log(`Pie smart contract has been deployed to: ${pie.address}`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });