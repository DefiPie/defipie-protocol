// $ npx hardhat run scripts/05_setValues_protocol.js --network rinkeby
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

    console.log('Network: ', network);
    console.log('Set values for contracts with the account:', deployer.address);
    console.log('Account balance:', (await deployer.getBalance()).toString());

    let prefix = network.toUpperCase();
    let PIE_ADDRESS = process.env[prefix + '_PIE_ADDRESS'];

    // 1. Controller transactions
    // Set implementation for unitroller
    const UnitrollerInterface = await hre.ethers.getContractFactory("Unitroller");
    const unitrollerInterface = await UnitrollerInterface.attach(data.unitroller);

    let tx1 = await unitrollerInterface._setPendingImplementation(data.controller);
    console.log("Tx1 hash: ", tx1.hash);
    await tx1.wait();

    const ControllerInterface = await hre.ethers.getContractFactory("Controller");
    const controllerInterface = await ControllerInterface.attach(data.controller);

    let tx2 = await controllerInterface._become(data.unitroller);
    console.log("Tx2 hash: ", tx2.hash);
    await tx2.wait();

    // Settings transactions
    const unitrollerWithControllerInterface = await ControllerInterface.attach(data.unitroller);
    let tx3 = await unitrollerWithControllerInterface._setLiquidationIncentive(process.env.CONTROLLER_LIQUIDATION_INCENTIVE);
    console.log("Tx3 hash: ", tx3.hash);
    let tx4 = await unitrollerWithControllerInterface._setMaxAssets(process.env.CONTROLLER_MAX_ASSETS);
    console.log("Tx4 hash: ", tx4.hash);
    let tx5 = await unitrollerWithControllerInterface._setCloseFactor(process.env.CONTROLLER_CLOSE_FACTOR);
    console.log("Tx5 hash: ", tx5.hash);
    let tx6 = await unitrollerWithControllerInterface._setFeeFactorMaxMantissa(process.env.CONTROLLER_FEE_FACTOR_MAX_MANTISSA);
    console.log("Tx6 hash: ", tx6.hash);
    let tx7 = await unitrollerWithControllerInterface._setLiquidateGuardian(process.env.CONTROLLER_LIQUIDATE_GUARDIAN);
    console.log("Tx7 hash: ", tx7.hash);
    let tx8 = await unitrollerWithControllerInterface._setPauseGuardian(process.env.CONTROLLER_PAUSE_GUARDIAN);
    console.log("Tx8 hash: ", tx8.hash);

    // 2. Registry transactions
    const RegistryInterface = await hre.ethers.getContractFactory("Registry");
    const registryInterface = await RegistryInterface.attach(data.registryProxy);

    let tx9 = await registryInterface._setFactoryContract(data.pTokenFactory);
    console.log("Tx9 hash", tx9.hash);
    await tx9.wait();

    let tx10 = await registryInterface._setOracle(data.uniswapPriceOracleProxy);
    console.log("Tx10 hash", tx10.hash);
    await tx10.wait();

    // 3. Factory transactions
    const PTokenFactoryInterface = await hre.ethers.getContractFactory("PTokenFactory");
    const pTokenFactoryInterface = await PTokenFactoryInterface.attach(data.pTokenFactory);

    let tx11 = await pTokenFactoryInterface._createPETH(data.pEtherDelegate, "ETH");
    console.log("Tx11 hash", tx11.hash);
    await tx11.wait();

    let tx12 = await pTokenFactoryInterface._createPPIE(PIE_ADDRESS, data.ppieDelegate);
    console.log("Tx12 hash", tx12.hash);
    await tx12.wait();

    console.log('Finish!');
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });