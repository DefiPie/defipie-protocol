const BigNumber = require('bignumber.js');

const {
    makeToken,
    makeInterestRateModel,
    makeController,
    makePTokenFactory
} = require('./Utils/DeFiPie');

describe('PToken Factory tests', () => {
    let root, admin, accounts;
    let pTokenFactory, oracleAddress, oracle, factoryUniswapAddress, factoryUniswap;
    let controller, interestRateModel, exchangeRate, reserveFactor;

    beforeEach(async () => {
        [root, admin, ...accounts] = saddle.accounts;

        controller = await makeController();
        interestRateModel = await makeInterestRateModel();
        exchangeRate = 1;
        reserveFactor = 0.1;

        pTokenFactory = await makePTokenFactory({controller: controller, interestRateModel: interestRateModel, exchangeRate:exchangeRate, reserveFactor:reserveFactor});
        oracleAddress = await call(pTokenFactory, "oracle");
        oracle = await saddle.getContractAt('UniswapPriceOracle', oracleAddress);
        factoryUniswapAddress = await call(oracle, "uniswapFactory");
        factoryUniswap = await saddle.getContractAt('MockPriceFeed', factoryUniswapAddress);
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
    });

    describe("Create token", () => {
        it("create token with default data", async () => {
            let underlying = await makeToken();

            let result = await send(pTokenFactory, 'createPToken', [underlying._address]);

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
        it("invalid pool, deficiency ith liquidiy in pool", async () => {
            let reserves = await call(factoryUniswap, 'getReserves');
            let reserve0 = new BigNumber(reserves[0]);
            let reserve1 = new BigNumber(reserves[1]);

            await send(pTokenFactory, 'setMinUniswapLiquidity', [reserve0]);
            await send(factoryUniswap, 'setReserves', [reserve0.minus(1), reserve1.minus(1)]);

            let underlying = await makeToken();

            let result = await send(pTokenFactory, 'createPToken',
                [
                    underlying._address
                ]
            );

            expect(result).toHaveFactoryFailure('INVALID_POOL', 'DEFICIENCY_ETH_LIQUIDITY_IN_POOL');
        });

        it("invalid pool, pool not exist", async () => {
            await send(factoryUniswap, 'setPairExist', [false]);

            let underlying = await makeToken();

            let result = await send(pTokenFactory, 'createPToken',
                [
                    underlying._address
                ]
            );

            expect(result).toHaveFactoryFailure('INVALID_POOL', 'PAIR_IS_NOT_EXIST');
        });
    });

    describe("oracle address", () => {
        it("set oracle address", async () => {
            await send(pTokenFactory, 'setOracle', [accounts[1]]);
            expect(await call(pTokenFactory, 'oracle')).toEqual(accounts[1]);
        });

        it("set oracle address, not UNAUTHORIZED", async () => {
            let result = await send(pTokenFactory, 'setOracle', [accounts[2]], {from: accounts[2]});
            expect(result).toHaveFactoryFailure('UNAUTHORIZED', 'SET_NEW_ORACLE');
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
});