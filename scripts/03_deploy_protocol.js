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

    // 4. Base Interest Rate model
    const BaseInterestRateModel = await hre.ethers.getContractFactory("BaseInterestRateModel");
    const baseInterestRateModel = await BaseInterestRateModel.deploy(
        BLOCKS_PER_YEAR,
        process.env.BASE_RATE_PER_YEAR,
        process.env.MULTIPLIER_RATE_PER_YEAR,
    );

    console.log(`BaseInterestRateModel smart contract has been deployed to: ${baseInterestRateModel.address}`);

    namesAndAddresses.baseInterestRateModel = baseInterestRateModel.address;

    // 5. Uniswap price oracle deploy
    const UniswapPriceOracle = await hre.ethers.getContractFactory("UniswapPriceOracle");
    const uniswapPriceOracle = await UniswapPriceOracle.deploy();

    console.log(`UniswapPriceOracle smart contract has been deployed to: ${uniswapPriceOracle.address}`);

    namesAndAddresses.uniswapPriceOracle = uniswapPriceOracle.address;

    let tx1 = await uniswapPriceOracle.deployTransaction.wait();
    console.log('tx1 hash', tx1.transactionHash);

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
    if (process.env.TIMELOCK_ADMIN) {
        const Timelock = await hre.ethers.getContractFactory("Timelock");
        const timelock = await Timelock.deploy(
            process.env.TIMELOCK_ADMIN,
            process.env.TIMELOCK_DELAY
        );

        console.log(`Timelock smart contract has been deployed to: ${timelock.address}`);

        namesAndAddresses.timelock = timelock.address;
    }

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

    // 10. Uniswap price oracle proxy deploy
    const UniswapPriceOracleProxy = await hre.ethers.getContractFactory("UniswapPriceOracleProxy");
    let uniswapPriceOracleProxy = await UniswapPriceOracleProxy.deploy(
        uniswapPriceOracle.address,
        registryProxy.address,
        EXCHANGE_FACTORY,
        WNATIVE_ADDRESS,
        PRICE_FEED_ADDRESS
    );

    console.log(`UniswapPriceOracleProxy smart contract has been deployed to: ${uniswapPriceOracleProxy.address}`);

    namesAndAddresses.uniswapPriceOracleProxy = uniswapPriceOracleProxy.address;

    let tx3 = await uniswapPriceOracleProxy.deployTransaction.wait();
    console.log('tx3 hash', tx3.transactionHash);

    // 11. Unitroller deploy
    const Unitroller = await hre.ethers.getContractFactory("Unitroller");
    const unitroller = await Unitroller.deploy(
        registryProxy.address
    );

    console.log(`Unitroller smart contract has been deployed to: ${unitroller.address}`);

    namesAndAddresses.unitroller = unitroller.address;

    let tx4 = await unitroller.deployTransaction.wait();
    console.log('tx4 hash', tx4.transactionHash);

    // 12. PToken Factory deploy
    const PTokenFactory = await hre.ethers.getContractFactory("PTokenFactory");
    const pTokenFactory = await PTokenFactory.deploy(
        registryProxy.address,
        process.env.MIN_LIQUIDITY_IN_POOL,
        unitroller.address,
        baseInterestRateModel.address,
        process.env.INITIAL_EXCHANGE_RATE_MANTISSA,
        process.env.INITIAL_RESERVE_FACTOR_MANTISSA
    );

    console.log(`PTokenFactory smart contract has been deployed to: ${pTokenFactory.address}`);

    namesAndAddresses.pTokenFactory = pTokenFactory.address;

    // 13. Deploy Governor
    if (typeof timelock !== 'undefined') {
        const Governor = await hre.ethers.getContractFactory("Governor");
        const governor = await Governor.deploy(
            timelock.address,
            registryProxy.address,
            process.env.GOVERNANCE_GUARDIAN,
            GOVERNANCE_PERIOD,
        );

        console.log(`Governor smart contract has been deployed to: ${governor.address}`);

        namesAndAddresses.governor = governor.address;
    }

    // 14. Deploy Calc Pool Price
    const CalcPoolPrice = await hre.ethers.getContractFactory("CalcPoolPrice");
    const calcPoolPrice = await CalcPoolPrice.deploy(
        uniswapPriceOracleProxy.address
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