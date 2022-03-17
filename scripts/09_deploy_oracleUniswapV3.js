// $ npx hardhat run scripts/09_deploy_oracleUniswapV3.js --network rinkeby
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

    let EXCHANGE_FACTORY_V3, WNATIVE_ADDRESS, PRICE_FEED_ADDRESS;
    let prefix = network.toUpperCase();

    EXCHANGE_FACTORY_V3 = process.env[prefix + '_EXCHANGE_FACTORY_V3'];
    WNATIVE_ADDRESS = process.env[prefix + '_WNATIVE_ADDRESS'];
    PRICE_FEED_ADDRESS = process.env[prefix + '_PRICE_FEED_ADDRESS'];

    console.log('EXCHANGE_FACTORY: ', EXCHANGE_FACTORY_V3);
    console.log('WNATIVE_ADDRESS: ', WNATIVE_ADDRESS);
    console.log('PRICE_FEED_ADDRESS: ', PRICE_FEED_ADDRESS);

    // Deploy block

    // 1. Uniswap V3 price oracle implementation deploy
    const UniswapV3PriceOracle = await hre.ethers.getContractFactory("UniswapV3PriceOracle");
    const uniswapV3PriceOracle = await UniswapV3PriceOracle.deploy();

    console.log(`UniswapV3PriceOracle smart contract has been deployed to: ${uniswapV3PriceOracle.address}`);

    namesAndAddresses.uniswapV3PriceOracle = uniswapV3PriceOracle.address;

    let tx1 = await uniswapV3PriceOracle.deployTransaction.wait();
    console.log('tx1 hash', tx1.transactionHash);

    // get data
    let dir = './networks/';
    let fileName = network + '.json';
    let data = JSON.parse(await fs.readFileSync(dir + fileName, { encoding: 'utf8' }));

    // 2. Uniswap price oracle proxy deploy
    const UniswapV3PriceOracleProxy = await hre.ethers.getContractFactory("UniswapV3PriceOracleProxy");
    let uniswapV3PriceOracleProxy = await UniswapV3PriceOracleProxy.deploy(
        uniswapV3PriceOracle.address,
        data.registryProxy,
        EXCHANGE_FACTORY_V3,
        WNATIVE_ADDRESS
    );

    console.log(`UniswapV3PriceOracleProxy smart contract has been deployed to: ${uniswapV3PriceOracleProxy.address}`);

    namesAndAddresses.uniswapV3PriceOracleProxy = uniswapV3PriceOracleProxy.address;

    let tx3 = await uniswapV3PriceOracleProxy.deployTransaction.wait();
    console.log('tx3 hash', tx3.transactionHash);

    // Save addresses to file
    data = await JSON.stringify(namesAndAddresses, null, 2);
    dir = './networks/';
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    fileName = network + '_uniswapV3.json';

    await fs.writeFileSync(dir + fileName, data, { encoding: 'utf8' });
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });