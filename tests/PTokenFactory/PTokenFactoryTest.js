const BigNumber = require('bignumber.js');

const {
    blockNumber
} = require('../Utils/Ethereum');

const {
    makeToken,
    makeInterestRateModel,
    makeController,
    makePTokenFactory,
    makeRegistryProxy
} = require('../Utils/DeFiPie');

describe('PToken Factory tests', () => {
    let root, admin, accounts;
    let pTokenFactory, priceOracle, uniswapOracle, mockPriceFeed, mockUniswapV2Factory, mockUniswapV2Pool, WETHToken, asset, registryProxy;
    let controller, interestRateModel, exchangeRate, reserveFactor;

    beforeEach(async () => {
        [root, admin, ...accounts] = saddle.accounts;

        interestRateModel = await makeInterestRateModel();
        exchangeRate = 1;
        reserveFactor = 0.1;

        registryProxy = await makeRegistryProxy();
        controller = await makeController({registryProxy: registryProxy});

        mockPriceFeed = await deploy('MockPriceFeed');
        mockUniswapV2Factory = await deploy('MockUniswapV2Factory');
        mockUniswapV2Pool = await deploy('MockUniswapV2Pool');
        WETHToken = await makeToken();
        asset = await makeToken();

        let tx1 = await send(mockUniswapV2Factory, 'setPair', [mockUniswapV2Pool._address]);
        let tx2 = await send(mockUniswapV2Factory, 'setPairExist', [true]);
        let pair = await call(mockUniswapV2Factory, "getPair", [WETHToken._address, asset._address]);
        expect(pair).toEqual(mockUniswapV2Pool._address);

        priceOracle = await deploy('PriceOracleHarness', [
            mockPriceFeed._address
        ]);
        let tx = await send(priceOracle, '_setRegistry', [registryProxy._address]);

        uniswapOracle = await deploy('UniswapV2PriceOracleHarness', [
            mockUniswapV2Factory._address,
            WETHToken._address
        ]);

        let tx0 = await send(uniswapOracle, '_setRegistry', [registryProxy._address]);
        let tx0_ = await send(priceOracle, '_addOracle', [uniswapOracle._address]);

        await send(mockUniswapV2Pool, 'setData', [
            asset._address,
            WETHToken._address,
            '185850109323804242560637514',
            '517682812260927681611929',
            '222207120848530231902067171756422825567',
            '18388112711916799881959720317173237214852815'
        ]);

        pTokenFactory = await makePTokenFactory({
            registryProxy: registryProxy,
            controller: controller,
            interestRateModel: interestRateModel,
            exchangeRate: exchangeRate,
            reserveFactor: reserveFactor,
            mockPriceFeed: mockPriceFeed,
            mockUniswapV2Factory: mockUniswapV2Factory,
            mockUniswapV2Pool: mockUniswapV2Pool,
            priceOracle: priceOracle
        });
    });

    describe("constructor", () => {
        it("gets address of controller", async () => {
            let controllerAddress = await call(pTokenFactory, "controller");
            expect(controllerAddress).toEqual(controller._address);
        });

        it("gets address of interestRateModel", async () => {
            let interestRateModelAddress = await call(pTokenFactory, "interestRateModel");
            expect(interestRateModelAddress).toEqual(interestRateModel._address);
        });

        it("gets value of initialExchangeRateMantissa", async () => {
            let initialExchangeRateMantissaValue = await call(pTokenFactory, "initialExchangeRateMantissa");
            expect(+initialExchangeRateMantissaValue).toEqual(1e18);
        });

        it("gets value of initialReserveFactorMantissa", async () => {
            let initialReserveFactorMantissaValue = await call(pTokenFactory, "initialReserveFactorMantissa");
            expect(+initialReserveFactorMantissaValue).toEqual(1e17);
        });

        it("gets value of decimals", async () => {
            let decimalsValue = await call(pTokenFactory, "decimals");
            expect(+decimalsValue).toEqual(8);
        });
    });

    describe("Create token", () => {
        it("create token with default data", async () => {
            let underlying = await makeToken();
            let tx = await send(mockUniswapV2Pool, 'setData', [underlying._address, WETHToken._address]);
            expect(tx).toSucceed();

            let result = await send(pTokenFactory, 'createPToken', [underlying._address]);

            let pTokenAddress = result.events['PTokenCreated'].returnValues['newPToken'];

            let block = await web3.eth.getBlock(await blockNumber());
            let startBorrowTimestamp = +block.timestamp + +86400;

            expect(result).toSucceed();
            expect(result).toHaveLog('PTokenCreated', {newPToken: pTokenAddress, startBorrowTimestamp: startBorrowTimestamp});
        });

        it("create token (black list usage)", async () => {
            let underlying = await makeToken();
            let tx = await send(mockUniswapV2Pool, 'setData', [underlying._address, WETHToken._address]);
            expect(tx).toSucceed();

            let result = await send(pTokenFactory, '_addBlackList', [underlying._address], {from: accounts[1]});
            expect(result).toHaveFactoryFailure('UNAUTHORIZED', 'ADD_UNDERLYING_TO_BLACKLIST');

            result = await send(pTokenFactory, '_addBlackList', [underlying._address]);
            expect(result).toSucceed();

            let blackListStatus = await call(pTokenFactory, "getBlackListStatus", [underlying._address]);
            expect(blackListStatus).toEqual(true);

            result = await send(pTokenFactory, 'createPToken', [underlying._address]);
            expect(result).toHaveFactoryFailure('INVALID_POOL', 'UNDERLYING_IN_BLACKLIST');

            result = await send(pTokenFactory, '_removeBlackList', [underlying._address], {from: accounts[1]});
            expect(result).toHaveFactoryFailure('UNAUTHORIZED', 'REMOVE_UNDERLYING_FROM_BLACKLIST');

            result = await send(pTokenFactory, '_removeBlackList', [underlying._address]);
            expect(result).toSucceed();

            blackListStatus = await call(pTokenFactory, "getBlackListStatus", [underlying._address]);
            expect(blackListStatus).toEqual(false);

            result = await send(pTokenFactory, 'createPToken', [underlying._address]);
            let pTokenAddress = result.events['PTokenCreated'].returnValues['newPToken'];

            let block = await web3.eth.getBlock(await blockNumber());
            let startBorrowTimestamp = +block.timestamp + +86400;

            expect(result).toSucceed();
            expect(result).toHaveLog('PTokenCreated', { newPToken: pTokenAddress, startBorrowTimestamp: startBorrowTimestamp });
        });
    });

    describe("check minOracleLiquidity", () => {
        it("set minOracleLiquidity", async () => {
            await send(pTokenFactory, '_setMinOracleLiquidity', [1]);
            expect(await call(pTokenFactory, 'minOracleLiquidity')).toEqual('1');
        });

        it("set minUniswapLiquidity, not UNAUTHORIZED", async () => {
            let result = await send(pTokenFactory, '_setMinOracleLiquidity', [1], {from: accounts[1]});
            expect(result).toHaveFactoryFailure('UNAUTHORIZED', 'SET_MIN_LIQUIDITY_OWNER_CHECK');
        });
    });

    describe("invalid pool", () => {
        it("invalid pool, deficiency eth liquidity in pool", async () => {
            let underlying = await makeToken();

            let reserves = await call(mockUniswapV2Pool, 'getReserves');
            let reserve0 = new BigNumber(reserves[0]);
            let reserve1 = new BigNumber(reserves[1]);

            await send(mockUniswapV2Pool, 'setData', [underlying._address, WETHToken._address, reserve0.minus(1), reserve1.minus(1)]);
            await send(pTokenFactory, '_setMinOracleLiquidity', [reserve1]);

            let result = await send(pTokenFactory, 'createPToken', [underlying._address]);

            expect(result).toHaveFactoryFailure('INVALID_POOL', 'DEFICIENCY_LIQUIDITY_IN_POOL_OR_PAIR_IS_NOT_EXIST');
        });

        it("invalid pool, pool not exist", async () => {
            await send(mockUniswapV2Factory, 'setPairExist', [false]);

            let underlying = await makeToken();

            let result = await send(pTokenFactory, 'createPToken', [underlying._address]);

            expect(result).toHaveFactoryFailure('INVALID_POOL', 'DEFICIENCY_LIQUIDITY_IN_POOL_OR_PAIR_IS_NOT_EXIST');
        });
    });

    describe("oracle address", () => {
        it("set oracle address", async () => {
            await send(registryProxy, '_setOracle', [accounts[1]]);
            expect(await call(pTokenFactory, 'getOracle')).toEqual(accounts[1]);
        });

        it("set oracle address, not UNAUTHORIZED", async () => {
            let result = await send(registryProxy, '_setOracle', [accounts[2]], {from: accounts[2]});
            expect(result).toHaveRegistryFailure('UNAUTHORIZED', 'SET_NEW_ORACLE');
        });
    });

    describe("controller address", () => {
        it("set controller address", async () => {
            await send(pTokenFactory, '_setController', [accounts[1]]);
            expect(await call(pTokenFactory, 'controller')).toEqual(accounts[1]);
        });

        it("set controller address, not UNAUTHORIZED", async () => {
            let result = await send(pTokenFactory, '_setController', [accounts[2]], {from: accounts[2]});
            expect(result).toHaveFactoryFailure('UNAUTHORIZED', 'SET_NEW_CONTROLLER');
        });
    });

    describe("interestRateModel address", () => {
        it("set interestRateModel address", async () => {
            await send(pTokenFactory, '_setInterestRateModel', [accounts[1]]);
            expect(await call(pTokenFactory, 'interestRateModel')).toEqual(accounts[1]);
        });

        it("set interestRateModel address, not UNAUTHORIZED", async () => {
            let result = await send(pTokenFactory, '_setInterestRateModel', [accounts[2]], {from: accounts[2]});
            expect(result).toHaveFactoryFailure('UNAUTHORIZED', 'SET_NEW_INTEREST_RATE_MODEL');
        });
    });

    describe("set exchange rate value", () => {
        it("set exchange rate value", async () => {
            await send(pTokenFactory, '_setInitialExchangeRateMantissa', ['11']);
            expect(await call(pTokenFactory, 'initialExchangeRateMantissa')).toEqual('11');
        });

        it("set ExchangeRateMantissa value, not UNAUTHORIZED", async () => {
            let result = await send(pTokenFactory, '_setInitialExchangeRateMantissa', ['12'], {from: accounts[2]});
            expect(result).toHaveFactoryFailure('UNAUTHORIZED', 'SET_NEW_EXCHANGE_RATE');
        });
    });

    describe("set reserve factor value", () => {
        it("set reserve factor value", async () => {
            await send(pTokenFactory, '_setInitialReserveFactorMantissa', ['11']);
            expect(await call(pTokenFactory, 'initialReserveFactorMantissa')).toEqual('11');
        });

        it("set reserveFactorMantissa value, not UNAUTHORIZED", async () => {
            let result = await send(pTokenFactory, '_setInitialReserveFactorMantissa', ['12'], {from: accounts[2]});
            expect(result).toHaveFactoryFailure('UNAUTHORIZED', 'SET_NEW_RESERVE_FACTOR');
        });
    });

    describe("set decimals value", () => {
        it("set decimals value", async () => {
            await send(pTokenFactory, '_setPTokenDecimals', ['11']);
            expect(await call(pTokenFactory, 'decimals')).toEqual('11');
        });

        it("set decimals value, not UNAUTHORIZED", async () => {
            let result = await send(pTokenFactory, '_setPTokenDecimals', ['12'], {from: accounts[2]});
            expect(result).toHaveFactoryFailure('UNAUTHORIZED', 'SET_NEW_DECIMALS');
        });
    });
});