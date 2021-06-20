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
    const UChildERC20 = await hre.ethers.getContractFactory("UChildERC20");
    const implementation = await UChildERC20.deploy();

    console.log(`Implementation smart contract has been deployed to: ${implementation.address}`);

    //Deploy of staking smart contract
    const UChildERC20Proxy = await hre.ethers.getContractFactory("UChildERC20Proxy");
    const proxy = await UChildERC20Proxy.deploy(
        implementation.address
    );

    console.log(`Proxy smart contract has been deployed to: ${proxy.address}`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });