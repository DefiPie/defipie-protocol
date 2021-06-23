// >npx hardhat run scripts/deploy_protocol_in_matic.js --network mumbai
const ControllerData = require('../artifacts/contracts/Controller.sol/Controller.json');

const BigNumber = require('bignumber.js');
const hre = require("hardhat");
const dotenv = require('dotenv');
const network = hre.network.name;
const fs = require('fs');
const envConfig = dotenv.parse(fs.readFileSync(`.env`));
for (const k in envConfig) {
    process.env[k] = envConfig[k]
}

async function main() {
    const PPIEDelegate = await hre.ethers.getContractFactory("PPIEDelegate");
    const ppieDelegate = await PPIEDelegate.deploy();

    console.log(`PPIEDelegate smart contract has been deployed to: ${ppieDelegate.address}`);

    const PEtherDelegate = await hre.ethers.getContractFactory("PEtherDelegate");
    const pEtherDelegate = await PEtherDelegate.deploy();

    console.log(`PEtherDelegate smart contract has been deployed to: ${pEtherDelegate.address}`);

    const Controller = await hre.ethers.getContractFactory("Controller");
    const controller = await Controller.deploy();

    console.log(`Controller smart contract has been deployed to: ${controller.address}`);

    const Unitroller = await hre.ethers.getContractFactory("Unitroller");
    const unitroller = await Unitroller.deploy();

    console.log(`Unitroller smart contract has been deployed to: ${unitroller.address}`);

    const ClaimCalc = await hre.ethers.getContractFactory("ClaimCalc");
    const claimCalc = await ClaimCalc.deploy(
        unitroller.address
    );

    console.log(`ClaimCalc smart contract has been deployed to: ${claimCalc.address}`);

    let baseRatePerYear = new BigNumber('20000000000000000');
    let multiplierPerYear = new BigNumber('850000000000000000');

    const BaseInterestRateModel = await hre.ethers.getContractFactory("BaseInterestRateModel");
    const baseInterestRateModel = await BaseInterestRateModel.deploy(
        baseRatePerYear.toString(),
        multiplierPerYear.toString()
    );

    console.log(`BaseInterestRateModel smart contract has been deployed to: ${baseInterestRateModel.address}`);

    const Registry = await hre.ethers.getContractFactory("Registry");
    const registry = await Registry.deploy();

    console.log(`Registry smart contract has been deployed to: ${registry.address}`);

    const PErc20Delegate = await hre.ethers.getContractFactory("PErc20Delegate");
    const pErc20Delegate = await PErc20Delegate.deploy();

    console.log(`PErc20Delegate smart contract has been deployed to: ${pErc20Delegate.address}`);

    const RegistryProxy = await hre.ethers.getContractFactory("RegistryProxy");
    const registryProxy = await RegistryProxy.deploy(
        registry.address,
        pErc20Delegate.address
    );

    console.log(`RegistryProxy smart contract has been deployed to: ${registryProxy.address}`);

    const UniswapPriceOracle = await hre.ethers.getContractFactory("UniswapPriceOracle");
    const uniswapPriceOracle = await UniswapPriceOracle.deploy();

    console.log(`UniswapPriceOracle smart contract has been deployed to: ${uniswapPriceOracle.address}`);

    const UniswapPriceOracleProxy = await hre.ethers.getContractFactory("UniswapPriceOracleProxy");
    const uniswapPriceOracleProxy = await UniswapPriceOracleProxy.deploy(
        uniswapPriceOracle.address,
        registryProxy.address,
        process.env.SushiFactoryAddress,
        process.env.WMATICAddress,
        process.env.ChainlinkAddress
    );

    console.log(`UniswapPriceOracleProxy smart contract has been deployed to: ${uniswapPriceOracleProxy.address}`);

    const CalcPoolPrice = await hre.ethers.getContractFactory("CalcPoolPrice");
    const calcPoolPrice = await CalcPoolPrice.deploy(
        uniswapPriceOracleProxy.address
    );

    console.log(`CalcPoolPrice smart contract has been deployed to: ${calcPoolPrice.address}`);

    let minUniswapLiquidity= new BigNumber('1');
    let initialExchangeRateMantissa = new BigNumber('20000000000000000');
    let initialReserveFactorMantissa = new BigNumber('100000000000000000');

    const PTokenFactory = await hre.ethers.getContractFactory("PTokenFactory");
    const pTokenFactory = await PTokenFactory.deploy(
        registryProxy.address,
        minUniswapLiquidity.toString(),
        uniswapPriceOracleProxy.address,
        unitroller.address,
        baseInterestRateModel.address,
        initialExchangeRateMantissa.toString(),
        initialReserveFactorMantissa.toString()
    );

    console.log(`PTokenFactory smart contract has been deployed to: ${pTokenFactory.address}`);

    await unitroller._setPendingImplementation(controller.address);
    await controller._become(unitroller.address);

    const Unitroller1 = await hre.ethers.getContractFactory("Controller");
    const unitroller1 = await Unitroller1.attach(unitroller.address);

    await unitroller1._setPriceOracle(uniswapPriceOracleProxy.address);
    await unitroller1._setFactoryContract(pTokenFactory.address);
    await unitroller1._setLiquidationIncentive('1080000000000000000');
    await unitroller1._setMaxAssets(20);
    await unitroller1._setCloseFactor('500000000000000000');

    const Registry1 = await hre.ethers.getContractFactory("Registry");
    const registry1 = await Registry1.attach(registryProxy.address);

    await registry1._setFactoryContract(pTokenFactory.address);

    await pTokenFactory.createPETH(pEtherDelegate.address);
    await pTokenFactory.createPPIE(process.env.PIE_ADDRESS, ppieDelegate.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });