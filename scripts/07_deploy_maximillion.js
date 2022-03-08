// $ npx hardhat run scripts/07_deploy_maximillion.js --network mumbai
const hre = require("hardhat");
const dotenv = require('dotenv');
const network = hre.network.name;
const fs = require('fs');
const envConfig = dotenv.parse(fs.readFileSync(`.env`));
for (const k in envConfig) {
    process.env[k] = envConfig[k]
}

async function main() {
    let namesAndAddresses = {};
    const [deployer] = await hre.ethers.getSigners();

    console.log('Network', network);
    console.log('Deploying contracts with the account:', deployer.address);
    console.log('Account balance:', (await deployer.getBalance()).toString());

    let prefix = network.toUpperCase();
    let PETH_ADDRESS = process.env[prefix + '_PETH_ADDRESS'];

    // Deploy block

    const Maximillion = await hre.ethers.getContractFactory("Maximillion");
    const maximillion = await Maximillion.deploy(
        PETH_ADDRESS
    );

    console.log(`Maximillion smart contract has been deployed to: ${maximillion.address}`);

    let data;
    let dir = './networks/';
    const fileName = network + '.json';

    try {
        data = JSON.parse(await fs.readFileSync(dir + fileName, { encoding: 'utf8' }));
        data.maximillion = maximillion.address;
        data = await JSON.stringify(data, null, 2);
    } catch (e) {
        namesAndAddresses.maximillion = maximillion.address;
        data = await JSON.stringify(namesAndAddresses, null, 2);

        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    await fs.writeFileSync(dir + fileName, data, { encoding: 'utf8' });
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });