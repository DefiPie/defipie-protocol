// $ npx hardhat run scripts/10_verify_oracleUniswapV3.js --network rinkeby
const hre = require("hardhat");
const dotenv = require('dotenv');
const network = hre.network.name;
const fs = require('fs');
const envConfig = dotenv.parse(fs.readFileSync(`.env`));
for (const k in envConfig) {
    process.env[k] = envConfig[k]
}

async function main() {
    const [deployer] = await hre.ethers.getSigners();

    console.log('Network', network);
    console.log('Verify contracts with the account:', deployer.address);
    console.log('Account balance:', (await deployer.getBalance()).toString());

    let EXCHANGE_FACTORY_V3, WNATIVE_ADDRESS, PRICE_FEED_ADDRESS;
    let prefix = network.toUpperCase();

    EXCHANGE_FACTORY_V3 = process.env[prefix + '_EXCHANGE_FACTORY_V3'];
    WNATIVE_ADDRESS = process.env[prefix + '_WNATIVE_ADDRESS'];
    PRICE_FEED_ADDRESS = process.env[prefix + '_PRICE_FEED_ADDRESS'];

    console.log('EXCHANGE_FACTORY: ', EXCHANGE_FACTORY_V3);
    console.log('WNATIVE_ADDRESS: ', WNATIVE_ADDRESS);
    console.log('PRICE_FEED_ADDRESS: ', PRICE_FEED_ADDRESS);

    let dir = './networks/';
    const fileNameOracleV3 = network + '_uniswapV3.json';
    let dataOracleV3 = JSON.parse(await fs.readFileSync(dir + fileNameOracleV3, { encoding: 'utf8' }));

    // Verify block
    try {
        await hre.run("verify:verify", {
            address: dataOracleV3.uniswapV3PriceOracle,
            constructorArguments: [],
            contract: "contracts/Oracles/UniswapV3PriceOracle.sol:UniswapV3PriceOracle"
        });
    } catch (e) {
        console.log(e);
    }

    const fileName = network +'.json';
    let data = JSON.parse(await fs.readFileSync(dir + fileName, { encoding: 'utf8' }));

    // Verify block
    try {
        await hre.run("verify:verify", {
            address: dataOracleV3.uniswapV3PriceOracleProxy,
            constructorArguments: [
                dataOracleV3.uniswapV3PriceOracle,
                data.registryProxy,
                EXCHANGE_FACTORY_V3,
                WNATIVE_ADDRESS
            ],
            contract: "contracts/Oracles/UniswapV3PriceOracleProxy.sol:UniswapV3PriceOracleProxy"
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