const BigNumber = require('bignumber.js');

const {
    makeToken,
    makeInterestRateModel,
    makeController,
    makePTokenFactory,
    makeRegistryProxy
} = require('./Utils/DeFiPie');

describe('PToken Factory tests', () => {
    let root, admin, accounts;
    let pTokenFactory, oracle, mockPriceFeed, mockUniswapFactory, mockUniswapPool, WETHToken, asset, registryProxy;
    let controller, interestRateModel, exchangeRate, reserveFactor;

    beforeEach(async () => {
        [root, admin, ...accounts] = saddle.accounts;

        interestRateModel = await makeInterestRateModel();
        exchangeRate = 1;
        reserveFactor = 0.1;

        registryProxy = await makeRegistryProxy();
        controller = await makeController({registryProxy: registryProxy});

        mockPriceFeed = await deploy('MockPriceFeed');
        mockUniswapFactory = await deploy('MockUniswapFactory');
        mockUniswapPool = await deploy('MockUniswapPool');
        WETHToken = await makeToken();
        asset = await makeToken();

        let tx1 = await send(mockUniswapFactory, 'setPair', [mockUniswapPool._address]);
        let tx2 = await send(mockUniswapFactory, 'setPairExist', [true]);
        let pair = await call(mockUniswapFactory, "getPair", [WETHToken._address, asset._address]);
        expect(pair).toEqual(mockUniswapPool._address);

        oracle = await deploy('UniswapPriceOracleHarness', [
            mockUniswapFactory._address,
            WETHToken._address,
            mockPriceFeed._address,
        ]);

        await send(mockUniswapPool, 'setData', [
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
            exchangeRate:exchangeRate,
            reserveFactor:reserveFactor,
            mockPriceFeed:mockPriceFeed,
            mockUniswapFactory:mockUniswapFactory,
            mockUniswapPool:mockUniswapPool,
            uniswapOracle:oracle
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
            let tx = await send(mockUniswapPool, 'setData', [underlying._address, WETHToken._address]);
            expect(tx).toSucceed();

            let result = await send(pTokenFactory, 'createPToken', [underlying._address]);

            let pTokenAddress = result.events['PTokenCreated'].returnValues['newPToken'];

            expect(result).toSucceed();
            expect(result).toHaveLog('PTokenCreated', {newPToken: pTokenAddress});
        });

        it("create token (black list usage)", async () => {
            let underlying = await makeToken();
            let tx = await send(mockUniswapPool, 'setData', [underlying._address, WETHToken._address]);
            expect(tx).toSucceed();

            let result = await send(pTokenFactory, 'addBlackList', [underlying._address], {from: accounts[1]});
            expect(result).toHaveFactoryFailure('UNAUTHORIZED', 'ADD_UNDERLYING_TO_BLACKLIST');

            result = await send(pTokenFactory, 'addBlackList', [underlying._address]);
            expect(result).toSucceed();

            let blackListStatus = await call(pTokenFactory, "getBlackListStatus", [underlying._address]);
            expect(blackListStatus).toEqual(true);

            result = await send(pTokenFactory, 'createPToken', [underlying._address]);
            expect(result).toHaveFactoryFailure('INVALID_POOL', 'UNDERLYING_IN_BLACKLIST');

            result = await send(pTokenFactory, 'removeBlackList', [underlying._address], {from: accounts[1]});
            expect(result).toHaveFactoryFailure('UNAUTHORIZED', 'REMOVE_UNDERLYING_FROM_BLACKLIST');

            result = await send(pTokenFactory, 'removeBlackList', [underlying._address]);
            expect(result).toSucceed();

            blackListStatus = await call(pTokenFactory, "getBlackListStatus", [underlying._address]);
            expect(blackListStatus).toEqual(false);

            result = await send(pTokenFactory, 'createPToken', [underlying._address]);
            let pTokenAddress = result.events['PTokenCreated'].returnValues['newPToken'];

            expect(result).toSucceed();
            expect(result).toHaveLog('PTokenCreated', {newPToken: pTokenAddress});
        });
    });

    describe("check minUniswapLiquidity", () => {
        it("set minUniswapLiquidity", async () => {
            await send(pTokenFactory, 'setMinUniswapLiquidity', [1]);
            expect(await call(pTokenFactory, 'minUniswapLiquidity')).toEqual('1');
        });

        it("set minUniswapLiquidity, not UNAUTHORIZED", async () => {
            let result = await send(pTokenFactory, 'setMinUniswapLiquidity', [1], {from: accounts[1]});
            expect(result).toHaveFactoryFailure('UNAUTHORIZED', 'SET_MIN_LIQUIDITY_OWNER_CHECK');
        });
    });

    describe("invalid pool", () => {
        it("invalid pool, deficiency eth liquidity in pool", async () => {
            let underlying = await makeToken();

            let reserves = await call(mockUniswapPool, 'getReserves');
            let reserve0 = new BigNumber(reserves[0]);
            let reserve1 = new BigNumber(reserves[1]);

            await send(mockUniswapPool, 'setData', [underlying._address, WETHToken._address, reserve0.minus(1), reserve1.minus(1)]);
            await send(pTokenFactory, 'setMinUniswapLiquidity', [reserve1]);

            let result = await send(pTokenFactory, 'createPToken', [underlying._address]);

            expect(result).toHaveFactoryFailure('INVALID_POOL', 'DEFICIENCY_LIQUIDITY_IN_POOL_OR_PAIR_IS_NOT_EXIST');
        });

        it("invalid pool, pool not exist", async () => {
            await send(mockUniswapFactory, 'setPairExist', [false]);

            let underlying = await makeToken();

            let result = await send(pTokenFactory, 'createPToken', [underlying._address]);

            expect(result).toHaveFactoryFailure('INVALID_POOL', 'DEFICIENCY_LIQUIDITY_IN_POOL_OR_PAIR_IS_NOT_EXIST');
        });
    });

    describe("oracle address", () => {
        it("set oracle address", async () => {
            await send(registryProxy, 'setOracle', [accounts[1]]);
            expect(await call(pTokenFactory, 'getOracle')).toEqual(accounts[1]);
        });

        it("set oracle address, not UNAUTHORIZED", async () => {
            let result = await send(registryProxy, 'setOracle', [accounts[2]], {from: accounts[2]});
            expect(result).toHaveRegistryFailure('UNAUTHORIZED', 'SET_NEW_ORACLE');
        });
    });

    describe("controller address", () => {
        it("set controller address", async () => {
            await send(pTokenFactory, 'setController', [accounts[1]]);
            expect(await call(pTokenFactory, 'controller')).toEqual(accounts[1]);
        });

        it("set controller address, not UNAUTHORIZED", async () => {
            let result = await send(pTokenFactory, 'setController', [accounts[2]], {from: accounts[2]});
            expect(result).toHaveFactoryFailure('UNAUTHORIZED', 'SET_NEW_CONTROLLER');
        });
    });

    describe("interestRateModel address", () => {
        it("set interestRateModel address", async () => {
            await send(pTokenFactory, 'setInterestRateModel', [accounts[1]]);
            expect(await call(pTokenFactory, 'interestRateModel')).toEqual(accounts[1]);
        });

        it("set interestRateModel address, not UNAUTHORIZED", async () => {
            let result = await send(pTokenFactory, 'setInterestRateModel', [accounts[2]], {from: accounts[2]});
            expect(result).toHaveFactoryFailure('UNAUTHORIZED', 'SET_NEW_INTEREST_RATE_MODEL');
        });
    });

    describe("set exchange rate value", () => {
        it("set exchange rate value", async () => {
            await send(pTokenFactory, 'setInitialExchangeRateMantissa', ['11']);
            expect(await call(pTokenFactory, 'initialExchangeRateMantissa')).toEqual('11');
        });

        it("set ExchangeRateMantissa value, not UNAUTHORIZED", async () => {
            let result = await send(pTokenFactory, 'setInitialExchangeRateMantissa', ['12'], {from: accounts[2]});
            expect(result).toHaveFactoryFailure('UNAUTHORIZED', 'SET_NEW_EXCHANGE_RATE');
        });
    });

    describe("set reserve factor value", () => {
        it("set reserve factor value", async () => {
            await send(pTokenFactory, 'setInitialReserveFactorMantissa', ['11']);
            expect(await call(pTokenFactory, 'initialReserveFactorMantissa')).toEqual('11');
        });

        it("set reserveFactorMantissa value, not UNAUTHORIZED", async () => {
            let result = await send(pTokenFactory, 'setInitialReserveFactorMantissa', ['12'], {from: accounts[2]});
            expect(result).toHaveFactoryFailure('UNAUTHORIZED', 'SET_NEW_RESERVE_FACTOR');
        });
    });

    describe("set decimals value", () => {
        it("set decimals value", async () => {
            await send(pTokenFactory, 'setPTokenDecimals', ['11']);
            expect(await call(pTokenFactory, 'decimals')).toEqual('11');
        });

        it("set decimals value, not UNAUTHORIZED", async () => {
            let result = await send(pTokenFactory, 'setPTokenDecimals', ['12'], {from: accounts[2]});
            expect(result).toHaveFactoryFailure('UNAUTHORIZED', 'SET_NEW_DECIMALS');
        });
    });
});