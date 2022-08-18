// $ npx hardhat run scripts/11_deploy_jumpRateModel.js --network rinkeby
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
    const JumpRateModel = await hre.ethers.getContractFactory("JumpRateModel");
    const jumpRateModel = await JumpRateModel.deploy(
        process.env.JRM_RINKEBY_BLOCKS_PER_YEAR,
        process.env.JRM_RINKEBY_BASE_RATE_PER_YEAR,
        process.env.JRM_RINKEBY_MULTIPLIER_RATE_PER_YEAR,
        process.env.JRM_RINKEBY_JUMP_MULTIPLIER_PER_YEAR,
        process.env.JRM_RINKEBY_KINK
    );

    console.log(`JumpRateModel smart contract has been deployed to: ${jumpRateModel.address}`);

    namesAndAddresses.jumpRateModel = jumpRateModel.address;

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