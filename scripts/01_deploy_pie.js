// $ npx hardhat run scripts/01_deploy_pie.js --network rinkeby
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

    // Deploy block

    // Deploy token smart contract
    const Pie = await hre.ethers.getContractFactory("Pie");
    const pie = await Pie.deploy(
        process.env.PIE_HOLDER
    );

    console.log(`Pie smart contract has been deployed to: ${pie.address}`);

    namesAndAddresses.pie = pie.address;

    // Save addresses to file

    let data = await JSON.stringify(namesAndAddresses, null, 2);
    let dir = './networks/';
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    const fileName = network + '.json';

    await fs.writeFileSync(dir + fileName, data, { encoding: 'utf8' });
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });