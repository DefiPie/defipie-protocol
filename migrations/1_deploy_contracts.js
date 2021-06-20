// for deploy:
// > truffle migrate --network bsctestnet
// for verify:
// truffle run verify Registry@0xAcCd67fe87b8A657e9dCCFAE2770e49260f9c034 --network bsctestnet
// for proxy contract verify for bsctestnet see:
// https://docs.binance.org/smart-chain/developer/upgrade/verify-proxy.html

const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8575"));
const BigNumber = require('bignumber.js');

const Pie = artifacts.require("Pie");
const PErc20Delegate = artifacts.require("PErc20Delegate");
const PPIEDelegate = artifacts.require("PPIEDelegate");
const PEtherDelegate = artifacts.require("PEtherDelegate");
const Controller = artifacts.require("Controller");
const Unitroller = artifacts.require("Unitroller");
const BaseInterestRateModel = artifacts.require("BaseInterestRateModel");
const Registry = artifacts.require("Registry");
const RegistryProxy = artifacts.require("RegistryProxy");
const UniswapPriceOracle = artifacts.require("UniswapPriceOracle");
const UniswapPriceOracleProxy = artifacts.require("UniswapPriceOracleProxy");
const PTokenFactory = artifacts.require("PTokenFactory");
const Maximillion = artifacts.require("Maximillion");
const ClaimCalc = artifacts.require("ClaimCalc");
const CalcPoolPrice = artifacts.require("CalcPoolPrice");

const ControllerData = require('../build/contracts/Controller.json');
const RegistryData = require('../build/contracts/Registry.json');

module.exports = async function(deployer, network, accounts) {

    await deployer.deploy(Pie, accounts[0]);
    const PieContractInstance = await Pie.deployed();
    console.log('Pie', PieContractInstance.address);

    await deployer.deploy(PPIEDelegate);
    const PPIEDelegateContractInstance = await PPIEDelegate.deployed();
    console.log('PPIEDelegate', PPIEDelegateContractInstance.address);

    await deployer.deploy(PEtherDelegate);
    const PEtherDelegateContractInstance = await PEtherDelegate.deployed();
    console.log('PEtherDelegate', PEtherDelegateContractInstance.address);

    await deployer.deploy(Controller);
    const ControllerContractInstance = await Controller.deployed();
    console.log('Controller', ControllerContractInstance.address);

    await deployer.deploy(Unitroller);
    const UnitrollerContractInstance = await Unitroller.deployed();
    console.log('Unitroller', UnitrollerContractInstance.address);

    await deployer.deploy(ClaimCalc, UnitrollerContractInstance.address);
    const ClaimCalcInstance = await ClaimCalc.deployed();
    console.log('ClaimCalc', ClaimCalcInstance.address);

    let baseRatePerYear = new BigNumber('20000000000000000');
    let multiplierPerYear = new BigNumber('850000000000000000');

    await deployer.deploy(BaseInterestRateModel,
        baseRatePerYear.toString(),
        multiplierPerYear.toString()
    );
    const BaseInterestRateModelContractInstance = await BaseInterestRateModel.deployed();
    console.log('BaseInterestRateModel', BaseInterestRateModelContractInstance.address);

    await deployer.deploy(Registry);
    const RegistryContractInstance = await Registry.deployed();
    console.log('Registry', RegistryContractInstance.address);

    await deployer.deploy(PErc20Delegate);
    const PErc20DelegateContractInstance = await PErc20Delegate.deployed();
    console.log('PErc20Delegate', PErc20DelegateContractInstance.address);

    await deployer.deploy(RegistryProxy,
        RegistryContractInstance.address,
        PErc20DelegateContractInstance.address
    );
    const RegistryProxyContractInstance = await RegistryProxy.deployed();
    console.log('RegistryProxy', RegistryProxyContractInstance.address);

    await deployer.deploy(UniswapPriceOracle);
    const UniswapPriceOracleInstance = await UniswapPriceOracle.deployed();
    console.log('UniswapPriceOracle', UniswapPriceOracleInstance.address);

    let PancakeFactoryAddress = '0xbcfccbde45ce874adcb698cc183debcf17952812';
    let WETHPancakeAddress = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';
    let ChainlinkAddress = '0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE';

    let RegistryProxyAddress = '0xddf147af5Bb55B1bE9bf6c37BFA5FEAf08Ac6Abd';
    let oracle = '0x826a527F5201dFd5a0Add51637faf30a82eA51AE';

    await deployer.deploy(UniswapPriceOracleProxy,
        oracle,
        RegistryProxyAddress,
        PancakeFactoryAddress,
        WETHPancakeAddress,
        ChainlinkAddress
    );
    const UniswapPriceOracleProxyContractInstance = await UniswapPriceOracleProxy.deployed();
    console.log('UniswapPriceOracleProxy', UniswapPriceOracleProxyContractInstance.address);

    await deployer.deploy(CalcPoolPrice, UniswapPriceOracleProxyContractInstance.address);
    const CalcPoolPriceInstance = await CalcPoolPrice.deployed();
    console.log('CalcPoolPrice', CalcPoolPriceInstance.address);

    let minUniswapLiquidity= new BigNumber('1000000000000000000');
    let initialExchangeRateMantissa = new BigNumber('20000000000000000');
    let initialReserveFactorMantissa = new BigNumber('100000000000000000');

    await deployer.deploy(PTokenFactory,
        RegistryProxyContractInstance.address,
        minUniswapLiquidity.toString(),
        UniswapPriceOracleProxyContractInstance.address,
        UnitrollerContractInstance.address,
        BaseInterestRateModelContractInstance.address,
        initialExchangeRateMantissa.toString(),
        initialReserveFactorMantissa.toString()
    );
    const PTokenFactoryContractInstance = await PTokenFactory.deployed();
    console.log('PTokenFactory', PTokenFactoryContractInstance.address);

    await UnitrollerContractInstance._setPendingImplementation(ControllerContractInstance.address);
    await ControllerContractInstance._become(UnitrollerContractInstance.address);

    let unitroller1 = new web3.eth.Contract(ControllerData.abi, UnitrollerContractInstance.address);
    await unitroller1.methods._setPriceOracle(UniswapPriceOracleProxyContractInstance.address).send({from: accounts[0]});
    await unitroller1.methods._setFactoryContract(PTokenFactoryContractInstance.address).send({from: accounts[0]});
    await unitroller1.methods._setLiquidationIncentive('1080000000000000000').send({from: accounts[0]});
    await unitroller1.methods._setMaxAssets(20).send({from: accounts[0]});
    await unitroller1.methods._setCloseFactor('500000000000000000').send({from: accounts[0]});

    let registry1 = new web3.eth.Contract(RegistryData.abi, RegistryProxyContractInstance.address);
    await registry1.methods._setFactoryContract(PTokenFactoryContractInstance.address).send({from: accounts[0]});

    await PTokenFactoryContractInstance.createPETH(PEtherDelegateContractInstance.address);
    await PTokenFactoryContractInstance.createPPIE(PieContractInstance.address, PPIEDelegateContractInstance.address);

    // await deployer.deploy(Maximillion,
    //     PEther address
    // );
    // const MaximillionContractInstance = await Maximillion.deployed();
    // console.log('Maximillion', MaximillionContractInstance.address);

    console.log('Finish!');
};