// $ npx hardhat run scripts/08_verify_maximillion.js --network mumbai
const hre = require("hardhat");
const dotenv = require('dotenv');
const network = hre.network.name;
const fs = require('fs');
const envConfig = dotenv.parse(fs.readFileSync(`.env`));
for (const k in envConfig) {
    process.env[k] = envConfig[k]
}

async function main() {
    let dir = './networks/';
    const fileName = network + '.json';
    let data = JSON.parse(await fs.readFileSync(dir + fileName, { encoding: 'utf8' }));

    const [deployer] = await hre.ethers.getSigners();

    console.log('Network', network);
    console.log('Deploying contracts with the account:', deployer.address);
    console.log('Account balance:', (await deployer.getBalance()).toString());

    let prefix = network.toUpperCase();
    let PETH_ADDRESS = process.env[prefix + '_PETH_ADDRESS'];

    // Verify block
    // Pie contract verify
    try {
        await hre.run("verify:verify", {
            address: data.maximillion,
            constructorArguments: [PETH_ADDRESS],
        });
    } catch (e) {
        console.log(e);
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });