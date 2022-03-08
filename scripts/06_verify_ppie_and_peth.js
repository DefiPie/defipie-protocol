// $ npx hardhat run scripts/06_verify_ppie_and_peth.js --network bsctestnet
const bn = require('bignumber.js');
const hre = require("hardhat");
const dotenv = require('dotenv');
const network = hre.network.name;
const fs = require('fs');
const envConfig = dotenv.parse(fs.readFileSync(`.env`));
for (const k in envConfig) {
    process.env[k] = envConfig[k]
}

async function calcExchangeRate(factoryDecimals, factoryInitialExchangeRateMantissa, underlyingDecimals) {
    let bnFDec = new bn(factoryDecimals);
    let unDec = new bn(underlyingDecimals);
    let initExcRate = new bn(factoryInitialExchangeRateMantissa.toString());

    let factor;
    let result;
    let ten = new bn(10);

    if (factoryDecimals >= underlyingDecimals) {
        factor = await ten.pow(bnFDec.minus(unDec));
        result = await initExcRate.multipliedBy(factor);
    } else {
        factor = await ten.pow(unDec.minus(bnFDec));
        result = await initExcRate.multipliedBy(factor);
    }

    return result;
}

async function main() {
    // Get addresses from file

    let dir = './networks/';
    const fileName = network + '.json';
    let data = JSON.parse(await fs.readFileSync(dir + fileName, { encoding: 'utf8' }));

    let pETHDelegatorAddress = '0xDa75D1996610b7FC159C882A49bedc5D62ae797c';
    let pPIEDelegatorAddress = '0x7c657198140d58eeC21841F61DEc8644a269415e';
    let pTokenFactoryAddress = data.pTokenFactory;

    // We get the contract
    let PETHDelegator = await ethers.getContractFactory("PETHDelegator");
    let contract = await PETHDelegator.attach(pETHDelegatorAddress);

    let pETHImplementation = await contract.implementation();

    let PToken = await ethers.getContractFactory("PEtherDelegate");
    contract = await PToken.attach(pETHDelegatorAddress);

    let controller = await contract.controller();
    let interestRateModel = await contract.interestRateModel();
    let initialReserveFactorMantissa = await contract.reserveFactorMantissa();
    let name = await contract.name();
    let symbol = await contract.symbol();
    let decimals = await contract.decimals();
    let registry = await contract.registry();

    let PTokenFactory = await ethers.getContractFactory("PTokenFactory");
    contract = await PTokenFactory.attach(pTokenFactoryAddress);

    let factoryInitialExchangeRateMantissa = await contract.initialExchangeRateMantissa();
    let factoryDecimals = await contract.decimals();
    let tokenInitialExchangeRateMantissa = await calcExchangeRate(factoryDecimals, factoryInitialExchangeRateMantissa, 18);
    let initialExchangeRate = await tokenInitialExchangeRateMantissa.toFixed();

    // Verify block

    // 1. PEther delegate contract verify
    try {
        await hre.run("verify:verify", {
            address: pETHDelegatorAddress,
            constructorArguments: [
                pETHImplementation,
                controller,
                interestRateModel,
                initialExchangeRate,
                initialReserveFactorMantissa,
                name,
                symbol,
                decimals,
                registry
            ],
            contract: "contracts/PEtherDelegator.sol:PETHDelegator"
        });
    } catch (e) {
        console.log(e);
    }

    let PPIEDelegator = await ethers.getContractFactory("PPIEDelegator");
    contract = await PPIEDelegator.attach(pPIEDelegatorAddress);

    let pPIEImplementation = await contract.implementation();

    PToken = await ethers.getContractFactory("PPIEDelegate");
    contract = await PToken.attach(pPIEDelegatorAddress);

    controller = await contract.controller();
    interestRateModel = await contract.interestRateModel();
    initialReserveFactorMantissa = await contract.reserveFactorMantissa();
    name = await contract.name();
    symbol = await contract.symbol();
    decimals = await contract.decimals();
    registry = await contract.registry();

    let underlying = await contract.underlying();
    let EIP20 = await ethers.getContractFactory("PErc20");
    contract = await EIP20.attach(underlying);

    let underlyingDecimals = await contract.decimals();
    tokenInitialExchangeRateMantissa = await calcExchangeRate(factoryDecimals, factoryInitialExchangeRateMantissa, underlyingDecimals);
    initialExchangeRate = await tokenInitialExchangeRateMantissa.toFixed();

    // 2. PPIE delegate contract verify
    try {
        await hre.run("verify:verify", {
            address: pPIEDelegatorAddress,
            constructorArguments: [
                underlying,
                pPIEImplementation,
                controller,
                interestRateModel,
                initialExchangeRate,
                initialReserveFactorMantissa,
                name,
                symbol,
                decimals,
                registry
            ],
            contract: "contracts/PPIEDelegator.sol:PPIEDelegator"
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