// $ npx hardhat run scripts/03_deploy_protocol.js --network rinkeby
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

    console.log('Network: ', network);
    console.log('Deploying contracts with the account:', deployer.address);
    console.log('Account balance:', (await deployer.getBalance()).toString());

    let BLOCKS_PER_YEAR, EXCHANGE_FACTORY, WNATIVE_ADDRESS, PRICE_FEED_ADDRESS, GOVERNANCE_PERIOD;
    let prefix = network.toUpperCase();

    BLOCKS_PER_YEAR = process.env[prefix + '_BLOCKS_PER_YEAR'];
    EXCHANGE_FACTORY = process.env[prefix + '_EXCHANGE_FACTORY'];
    WNATIVE_ADDRESS = process.env[prefix + '_WNATIVE_ADDRESS'];
    PRICE_FEED_ADDRESS = process.env[prefix + '_PRICE_FEED_ADDRESS'];
    GOVERNANCE_PERIOD = process.env[prefix + '_GOVERNANCE_PERIOD'];

    console.log('BLOCKS_PER_YEAR: ', BLOCKS_PER_YEAR);
    console.log('EXCHANGE_FACTORY: ', EXCHANGE_FACTORY);
    console.log('WNATIVE_ADDRESS: ', WNATIVE_ADDRESS);
    console.log('PRICE_FEED_ADDRESS: ', PRICE_FEED_ADDRESS);
    console.log('GOVERNANCE_PERIOD: ', GOVERNANCE_PERIOD);

    // 1. PERC20 delegate deploy
    const PErc20Delegate = await hre.ethers.getContractFactory("PErc20Delegate");
    const pErc20Delegate = await PErc20Delegate.deploy();

    console.log(`PErc20Delegate smart contract has been deployed to: ${pErc20Delegate.address}`);

    namesAndAddresses.pErc20Delegate = pErc20Delegate.address;

    // 2. Registry deploy
    const Registry = await hre.ethers.getContractFactory("Registry");
    const registry = await Registry.deploy();

    console.log(`Registry smart contract has been deployed to: ${registry.address}`);

    namesAndAddresses.registry = registry.address;

    // 3. Controller deploy
    const Controller = await hre.ethers.getContractFactory("Controller");
    const controller = await Controller.deploy();

    console.log(`Controller smart contract has been deployed to: ${controller.address}`);

    namesAndAddresses.controller = controller.address;

    const Distributor = await hre.ethers.getContractFactory("Distributor");
    const distributor = await Distributor.deploy();

    console.log(`Distributor smart contract has been deployed to: ${distributor.address}`);

    namesAndAddresses.distributor = distributor.address;

    // 4. Base Interest Rate model
    const BaseInterestRateModel = await hre.ethers.getContractFactory("BaseInterestRateModel");
    const baseInterestRateModel = await BaseInterestRateModel.deploy(
        BLOCKS_PER_YEAR,
        process.env.BASE_RATE_PER_YEAR,
        process.env.MULTIPLIER_RATE_PER_YEAR,
    );

    console.log(`BaseInterestRateModel smart contract has been deployed to: ${baseInterestRateModel.address}`);

    namesAndAddresses.baseInterestRateModel = baseInterestRateModel.address;

    // 5. Price oracle deploy (uniswap + price oracle)
    const UniswapV2PriceOracle = await hre.ethers.getContractFactory("UniswapV2PriceOracle");
    const uniswapV2PriceOracle = await UniswapV2PriceOracle.deploy();

    console.log(`UniswapV2PriceOracle smart contract has been deployed to: ${uniswapV2PriceOracle.address}`);

    namesAndAddresses.uniswapV2PriceOracle = uniswapV2PriceOracle.address;

    let tx1 = await uniswapV2PriceOracle.deployTransaction.wait();
    console.log('tx1 hash', tx1.transactionHash);

    const PriceOracle = await hre.ethers.getContractFactory("PriceOracle");
    const priceOracle = await PriceOracle.deploy();

    console.log(`PriceOracle smart contract has been deployed to: ${priceOracle.address}`);

    namesAndAddresses.priceOracle = priceOracle.address;

    let tx1_ = await priceOracle.deployTransaction.wait();
    console.log('tx1_ hash', tx1_.transactionHash);

    // 6. Registry deploy proxy
    const RegistryProxy = await hre.ethers.getContractFactory("RegistryProxy");
    const registryProxy = await RegistryProxy.deploy(
        registry.address,
        pErc20Delegate.address
    );

    console.log(`RegistryProxy smart contract has been deployed to: ${registryProxy.address}`);

    namesAndAddresses.registryProxy = registryProxy.address;

    let tx2 = await registryProxy.deployTransaction.wait();
    console.log('tx2 hash', tx2.transactionHash);

    // 7. Deploy Timelock
    const Timelock = await hre.ethers.getContractFactory("Timelock");
    const timelock = await Timelock.deploy(
        process.env.TIMELOCK_ADMIN,
        process.env.TIMELOCK_DELAY
    );

    console.log(`Timelock smart contract has been deployed to: ${timelock.address}`);

    namesAndAddresses.timelock = timelock.address;

    // 8. PETH delegate deploy
    const PEtherDelegate = await hre.ethers.getContractFactory("PEtherDelegate");
    const pEtherDelegate = await PEtherDelegate.deploy();

    console.log(`PEtherDelegate smart contract has been deployed to: ${pEtherDelegate.address}`);

    namesAndAddresses.pEtherDelegate = pEtherDelegate.address;

    // 9. PPIE delegate deploy
    const PPIEDelegate = await hre.ethers.getContractFactory("PPIEDelegate");
    const ppieDelegate = await PPIEDelegate.deploy();

    console.log(`PPIEDelegate smart contract has been deployed to: ${ppieDelegate.address}`);

    namesAndAddresses.ppieDelegate = ppieDelegate.address;

    // 10. Price oracle proxy and uniswap price oracle proxy deploy
    const PriceOracleProxy = await hre.ethers.getContractFactory("PriceOracleProxy");
    let priceOracleProxy = await PriceOracleProxy.deploy(
        priceOracle.address,
        registryProxy.address,
        PRICE_FEED_ADDRESS
    );

    console.log(`PriceOracleProxy smart contract has been deployed to: ${priceOracleProxy.address}`);

    namesAndAddresses.priceOracleProxy = priceOracleProxy.address;

    let tx3 = await priceOracleProxy.deployTransaction.wait();
    console.log('tx3 hash', tx3.transactionHash);

    const UniswapV2PriceOracleProxy = await hre.ethers.getContractFactory("UniswapV2PriceOracleProxy");
    let uniswapV2PriceOracleProxy = await UniswapV2PriceOracleProxy.deploy(
        uniswapV2PriceOracle.address,
        registryProxy.address,
        EXCHANGE_FACTORY,
        WNATIVE_ADDRESS
    );

    console.log(`UniswapV2PriceOracleProxy smart contract has been deployed to: ${uniswapV2PriceOracleProxy.address}`);

    namesAndAddresses.uniswapV2PriceOracleProxy = uniswapV2PriceOracleProxy.address;

    let tx3_ = await uniswapV2PriceOracleProxy.deployTransaction.wait();
    console.log('tx3_ hash', tx3_.transactionHash);

    if (network !== 'bsc' && network !== 'bscTestnet') {
        // 10a. Add uniswap v3
        let EXCHANGE_FACTORY_V3;

        EXCHANGE_FACTORY_V3 = process.env[prefix + '_EXCHANGE_FACTORY_V3'];

        console.log('EXCHANGE_FACTORY: ', EXCHANGE_FACTORY_V3);

        // Uniswap V3 price oracle implementation deploy
        const UniswapV3PriceOracle = await hre.ethers.getContractFactory("UniswapV3PriceOracle");
        const uniswapV3PriceOracle = await UniswapV3PriceOracle.deploy();

        console.log(`UniswapV3PriceOracle smart contract has been deployed to: ${uniswapV3PriceOracle.address}`);

        namesAndAddresses.uniswapV3PriceOracle = uniswapV3PriceOracle.address;

        let tx1 = await uniswapV3PriceOracle.deployTransaction.wait();
        console.log('tx1 hash', tx1.transactionHash);

        // 2. Uniswap price oracle proxy deploy
        const UniswapV3PriceOracleProxy = await hre.ethers.getContractFactory("UniswapV3PriceOracleProxy");
        let uniswapV3PriceOracleProxy = await UniswapV3PriceOracleProxy.deploy(
            uniswapV3PriceOracle.address,
            registryProxy.address,
            EXCHANGE_FACTORY_V3,
            WNATIVE_ADDRESS
        );

        console.log(`UniswapV3PriceOracleProxy smart contract has been deployed to: ${uniswapV3PriceOracleProxy.address}`);

        namesAndAddresses.uniswapV3PriceOracleProxy = uniswapV3PriceOracleProxy.address;

        let tx3 = await uniswapV3PriceOracleProxy.deployTransaction.wait();
        console.log('tx3 hash', tx3.transactionHash);
    }

    // 11. Unitroller deploy
    const Unitroller = await hre.ethers.getContractFactory("Unitroller");
    const unitroller = await Unitroller.deploy(
        registryProxy.address
    );

    console.log(`Unitroller smart contract has been deployed to: ${unitroller.address}`);

    namesAndAddresses.unitroller = unitroller.address;

    let tx4 = await unitroller.deployTransaction.wait();
    console.log('tx4 hash', tx4.transactionHash);

    const DistributorProxy = await hre.ethers.getContractFactory("DistributorProxy");
    const distributorProxy = await DistributorProxy.deploy(
        distributor.address,
        registryProxy.address,
        unitroller.address
    );

    console.log(`DistributorProxy smart contract has been deployed to: ${distributorProxy.address}`);

    namesAndAddresses.distributorProxy = distributorProxy.address;

    let tx4_ = await distributorProxy.deployTransaction.wait();
    console.log('tx4_ hash', tx4_.transactionHash);

    // 12. PToken Factory deploy
    const PTokenFactoryImpl = await hre.ethers.getContractFactory("PTokenFactory");
    const pTokenFactoryImpl = await PTokenFactoryImpl.deploy();

    console.log(`PTokenFactory smart contract has been deployed to: ${pTokenFactoryImpl.address}`);

    namesAndAddresses.pTokenFactoryImpl = pTokenFactoryImpl.address;

    const pTokenFactoryProxy = await PTokenFactory.deploy(
        pTokenFactoryImpl.address,
        registryProxy.address,
        unitroller.address,
        baseInterestRateModel.address,
        process.env.INITIAL_EXCHANGE_RATE_MANTISSA,
        process.env.INITIAL_RESERVE_FACTOR_MANTISSA,
        process.env.MIN_LIQUIDITY_IN_POOL
    );

    console.log(`PTokenFactoryProxy smart contract has been deployed to: ${pTokenFactoryProxy.address}`);

    namesAndAddresses.pTokenFactoryProxy = pTokenFactoryProxy.address;

    // 13. Deploy Governor
    const Governor = await hre.ethers.getContractFactory("Governor");
    const governor = await Governor.deploy(
        timelock.address,
        registryProxy.address,
        process.env.GOVERNANCE_GUARDIAN,
        GOVERNANCE_PERIOD,
    );

    console.log(`Governor smart contract has been deployed to: ${governor.address}`);

    namesAndAddresses.governor = governor.address;

    // 14. Deploy Calc pool Price
    const CalcPoolPrice = await hre.ethers.getContractFactory("CalcPoolPrice");
    const calcPoolPrice = await CalcPoolPrice.deploy(
        PriceOracleProxy.address
    );

    console.log(`CalcPoolPrice smart contract has been deployed to: ${calcPoolPrice.address}`);

    namesAndAddresses.calcPoolPrice = calcPoolPrice.address;

    // 15. Deploy Claim calc
    const ClaimCalc = await hre.ethers.getContractFactory("ClaimCalc");
    const claimCalc = await ClaimCalc.deploy(
        unitroller.address
    );

    console.log(`ClaimCalc smart contract has been deployed to: ${claimCalc.address}`);

    namesAndAddresses.claimCalc = claimCalc.address;

    // Save addresses to file

    let data = await JSON.stringify(namesAndAddresses, null, 2);
    let dir = './networks/';
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    const fileName = network + '.json';

    await fs.writeFileSync(dir + fileName, data, { encoding: 'utf8' });

    console.log('Finish!');
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });