// $ npx hardhat run scripts/04_verify_protocol.js --network rinkeby
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
    // Get addresses from file

    let dir = './networks/';
    const fileName = network + '.json';
    let data = JSON.parse(await fs.readFileSync(dir + fileName, { encoding: 'utf8' }));

    let BLOCKS_PER_YEAR, EXCHANGE_FACTORY, WNATIVE_ADDRESS, PRICE_FEED_ADDRESS, GOVERNANCE_PERIOD, PIE_ADDRESS;
    let prefix = network.toUpperCase();

    BLOCKS_PER_YEAR = process.env[prefix + '_BLOCKS_PER_YEAR'];
    EXCHANGE_FACTORY = process.env[prefix + '_EXCHANGE_FACTORY'];
    WNATIVE_ADDRESS = process.env[prefix + '_WNATIVE_ADDRESS'];
    PRICE_FEED_ADDRESS = process.env[prefix + '_PRICE_FEED_ADDRESS'];
    GOVERNANCE_PERIOD = process.env[prefix + '_GOVERNANCE_PERIOD'];
    PIE_ADDRESS = process.env[prefix + '_PIE_ADDRESS'];

    console.log('BLOCKS_PER_YEAR: ', BLOCKS_PER_YEAR);
    console.log('EXCHANGE_FACTORY: ', EXCHANGE_FACTORY);
    console.log('WNATIVE_ADDRESS: ', WNATIVE_ADDRESS);
    console.log('PRICE_FEED_ADDRESS: ', PRICE_FEED_ADDRESS);
    console.log('GOVERNANCE_PERIOD: ', GOVERNANCE_PERIOD);
    console.log('PIE_ADDRESS: ', PIE_ADDRESS);

    // Verify block

    // 1. PPIE delegate contract verify
    try {
        await hre.run("verify:verify", {
            address: data.ppieDelegate,
            constructorArguments: [],
            contract: "contracts/Tokens/PPIEDelegate.sol:PPIEDelegate"
        });
    } catch (e) {
        console.log(e);
    }

    // 2. PEther delegate contract verify
    try {
        await hre.run("verify:verify", {
            address: data.pEtherDelegate,
            constructorArguments: [],
            contract: "contracts/Tokens/PEtherDelegate.sol:PEtherDelegate"
        });
    } catch (e) {
        console.log(e);
    }

    // 3. PERC20 delegate contract verify
    try {
        await hre.run("verify:verify", {
            address: data.pErc20Delegate,
            constructorArguments: [],
            contract: "contracts/Tokens/PErc20Delegate.sol:PErc20Delegate"
        });
    } catch (e) {
        console.log(e);
    }

    // 4. Registry contract verify
    try {
        await hre.run("verify:verify", {
            address: data.registry,
            constructorArguments: [],
            contract: "contracts/Registry.sol:Registry"
        });
    } catch (e) {
        console.log(e);
    }

    // 5. Registry proxy contract verify
    try {
        await hre.run("verify:verify", {
            address: data.registryProxy,
            constructorArguments: [
                data.registry,
                data.pErc20Delegate
            ],
            contract: "contracts/RegistryProxy.sol:RegistryProxy"
        });
    } catch (e) {
        console.log(e);
    }

    // 6. Controller contract verify
    try {
        await hre.run("verify:verify", {
            address: data.controller,
            constructorArguments: [],
            contract: "contracts/Control/Controller.sol:Controller"
        });
    } catch (e) {
        console.log(e);
    }

    try {
        await hre.run("verify:verify", {
            address: data.distributor,
            constructorArguments: [],
            contract: "contracts/Control/Distributor.sol:Distributor"
        });
    } catch (e) {
        console.log(e);
    }

    // 7. Unitroller contract verify
    try {
        await hre.run("verify:verify", {
            address: data.unitroller,
            constructorArguments: [
                data.registryProxy
            ],
            contract: "contracts/Control/Unitroller.sol:Unitroller"
        });
    } catch (e) {
        console.log(e);
    }

    try {
        await hre.run("verify:verify", {
            address: data.distributorProxy,
            constructorArguments: [
                data.distributor,
                data.registryProxy,
                data.unitroller
            ],
            contract: "contracts/Control/DistributorProxy.sol:DistributorProxy"
        });
    } catch (e) {
        console.log(e);
    }

    // 8. Base Interest Rate model contract verify
    try {
        await hre.run("verify:verify", {
            address: data.baseInterestRateModel,
            constructorArguments: [
                BLOCKS_PER_YEAR,
                process.env.BASE_RATE_PER_YEAR,
                process.env.MULTIPLIER_RATE_PER_YEAR
            ],
            contract: "contracts/Models/BaseInterestRateModel.sol:BaseInterestRateModel"
        });
    } catch (e) {
        console.log(e);
    }

    // 9. Price oracle and uniswap price oracle contracts verify
    try {
        await hre.run("verify:verify", {
            address: data.priceOracle,
            constructorArguments: [],
            contract: "contracts/Oracles/PriceOracle.sol:PriceOracle"
        });
    } catch (e) {
        console.log(e);
    }

    try {
        await hre.run("verify:verify", {
            address: data.uniswapV2PriceOracle,
            constructorArguments: [],
            contract: "contracts/Oracles/UniswapV2PriceOracle.sol:UniswapV2PriceOracle"
        });
    } catch (e) {
        console.log(e);
    }

    // 10. Price oracle and Uniswap price oracle proxy contracts verify
    try {
        await hre.run("verify:verify", {
            address: data.priceOracleProxy,
            constructorArguments: [
                data.priceOracle,
                data.registryProxy,
                PRICE_FEED_ADDRESS
            ],
            contract: "contracts/Oracles/PriceOracleProxy.sol:PriceOracleProxy"
        });
    } catch (e) {
        console.log(e);
    }

    try {
        await hre.run("verify:verify", {
            address: data.uniswapV2PriceOracleProxy,
            constructorArguments: [
                data.uniswapV2PriceOracle,
                data.registryProxy,
                EXCHANGE_FACTORY,
                WNATIVE_ADDRESS
            ],
            contract: "contracts/Oracles/UniswapV2PriceOracleProxy.sol:UniswapV2PriceOracleProxy"
        });
    } catch (e) {
        console.log(e);
    }

    if (network !== 'bsc' && network !== 'bscTestnet') {
        // 3a. Add uniswap v3
        try {
            await hre.run("verify:verify", {
                address: data.uniswapV3PriceOracle,
                constructorArguments: [],
                contract: "contracts/Oracles/UniswapV3PriceOracle.sol:UniswapV3PriceOracle"
            });
        } catch (e) {
            console.log(e);
        }

        let EXCHANGE_FACTORY_V3;

        EXCHANGE_FACTORY_V3 = process.env[prefix + '_EXCHANGE_FACTORY_V3'];

        console.log('EXCHANGE_FACTORY: ', EXCHANGE_FACTORY_V3);

        try {
            await hre.run("verify:verify", {
                address: data.uniswapV3PriceOracleProxy,
                constructorArguments: [
                    data.uniswapV3PriceOracle,
                    data.registryProxy,
                    EXCHANGE_FACTORY_V3,
                    WNATIVE_ADDRESS
                ],
                contract: "contracts/UniswapV3PriceOracleProxy.sol:UniswapV3PriceOracleProxy"
            });
        } catch (e) {
            console.log(e);
        }
    }

    // 11. PToken factory contracts verify
    try {
        await hre.run("verify:verify", {
            address: data.pTokenFactoryImpl,
            constructorArguments: [],
            contract: "contracts/PTokenFactory.sol:PTokenFactory"
        });
    } catch (e) {
        console.log(e);
    }

    try {
        await hre.run("verify:verify", {
            address: data.pTokenFactoryProxy,
            constructorArguments: [
                data.pTokenFactoryImpl,
                data.registryProxy,
                data.unitroller,
                data.baseInterestRateModel,
                process.env.INITIAL_EXCHANGE_RATE_MANTISSA,
                process.env.INITIAL_RESERVE_FACTOR_MANTISSA,
                process.env.MIN_LIQUIDITY_IN_POOL
            ],
            contract: "contracts/PTokenFactoryProxy.sol:PTokenFactoryProxy"
        });
    } catch (e) {
        console.log(e);
    }

    // 12. Verify VotingEscrow
    try {
        await hre.run("verify:verify", {
            address: data.votingEscrow,
            constructorArguments: [],
            contract: "contracts/Governance/VotingEscrow.sol:VotingEscrow"
        });
    } catch (e) {
        console.log(e);
    }

    // 12a. Verify VotingEscrow Proxy
    try {
        await hre.run("verify:verify", {
            address: data.votingEscrowProxy,
            constructorArguments: [
                data.votingEscrow,
                data.registryProxy,
                PIE_ADDRESS,
                process.env.VE_NAME,
                process.env.VE_SYMBOL,
                process.env.VE_INTERVAL,
                process.env.VE_MIN_DURATION,
                process.env.VE_MAX_DURATION,
                process.env.VE_MIN_LOCK_AMOUNT,
                data.governor
            ],
            contract: "contracts/Governance/VotingEscrowProxy.sol:VotingEscrowProxy"
        });
    } catch (e) {
        console.log(e);
    }

    // 13. Claim calc contract verify
    try {
        await hre.run("verify:verify", {
            address: data.claimCalc,
            constructorArguments: [
                data.unitroller,
                data.distributorProxy
            ],
            contract: "contracts/Lens/CalcClaim.sol:ClaimCalc"
        });
    } catch (e) {
        console.log(e);
    }

    // 14. Calc pool Price contract verify
    try {
        await hre.run("verify:verify", {
            address: data.calcPoolPrice,
            constructorArguments: [data.priceOracleProxy],
            contract: "contracts/Lens/CalcPoolPrice.sol:CalcPoolPrice"
        });
    } catch (e) {
        console.log(e);
    }

    // 15. Timelock contract verify
    try {
        await hre.run("verify:verify", {
            address: data.timelock,
            constructorArguments: [
                deployer.address,
                process.env.TIMELOCK_DELAY
            ],
            contract: "contracts/Governance/Timelock.sol:Timelock"
        });
    } catch (e) {
        console.log(e);
    }

    // 16. Governor contract verify
    try {
        await hre.run("verify:verify", {
            address: data.governor,
            constructorArguments: [
                data.timelock,
                data.registryProxy,
                process.env.GOVERNANCE_GUARDIAN,
                GOVERNANCE_PERIOD,
            ],
            contract: "contracts/Governance/Governor.sol:Governor"
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