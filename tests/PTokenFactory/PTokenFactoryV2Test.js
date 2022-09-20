const BigNumber = require('bignumber.js');

const {
    blockNumber, increaseTime
} = require('../Utils/Ethereum');

const {
    makeToken,
    makePToken,
    makeRegistryProxy,
    makePTokenFactory,
    makeController,
    makeInterestRateModel
} = require('../Utils/DeFiPie');

const {
    constants,    // Common constants, like the zero address and largest integers
} = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');


describe('PToken Factory tests', () => {
    let root, admin, accounts;
    let priceOracle, mockPriceFeed, registryProxy;
    let pTokenFactory, mockUniswapV2Factory, mockUniswapV2Pool, mockUniswapV2Pool2, mockUniswapV2Pool3, WETHToken, asset, uniswapV2PriceOracle, asset2;
    let pEth, pOther, pOther2;
    let mockUniswapV3Factory, uniswapV3PriceOracle;

    beforeEach(async () => {
        [root, admin, ...accounts] = saddle.accounts;

        interestRateModel = await makeInterestRateModel();
        exchangeRate = 1;
        reserveFactor = 0.1;

        registryProxy = await makeRegistryProxy();
        controller = await makeController({registryProxy: registryProxy, kind: "bool"});

        mockPriceFeed = await deploy('MockPriceFeed');

        priceOracle = await deploy('PriceOracleHarness', [
            mockPriceFeed._address,
        ]);
        let tx = await send(priceOracle, '_setRegistry', [registryProxy._address]);

        mockUniswapV2Factory = await deploy('MockUniswapV2FactoryV2');
        mockUniswapV2Pool = await deploy('MockUniswapV2Pool', [mockUniswapV2Factory._address]);
        mockUniswapV2Pool2 = await deploy('MockUniswapV2Pool', [mockUniswapV2Factory._address]);
        mockUniswapV2Pool3 = await deploy('MockUniswapV2Pool', [mockUniswapV2Factory._address]);

        WETHToken = await makeToken();
        asset = await makeToken();
        asset2 = await makeToken();

        let tx1 = await send(mockUniswapV2Factory, 'addPair', [WETHToken._address, asset._address, mockUniswapV2Pool._address]);

        await send(mockUniswapV2Factory, 'addPair', [WETHToken._address, asset2._address, mockUniswapV2Pool2._address]);

        await send(mockUniswapV2Factory, 'addPair', [asset._address, asset2._address, mockUniswapV2Pool3._address]);

        let pair = await call(mockUniswapV2Factory, "getPair", [WETHToken._address, asset._address]);
        expect(pair).toEqual(mockUniswapV2Pool._address);

        uniswapV2PriceOracle = await deploy('UniswapV2PriceOracleMock', [
            mockUniswapV2Factory._address,
            WETHToken._address
        ]);

        let tx0 = await send(uniswapV2PriceOracle, '_setRegistry', [registryProxy._address]);
        let tx0_ = await send(priceOracle, '_addOracle', [uniswapV2PriceOracle._address]);

        await send(mockUniswapV2Pool, 'setData', [
            asset._address,
            WETHToken._address,
            '185850109323804242560637514',
            '517682812260927681611929',
            '222207120848530231902067171756422825567',
            '18388112711916799881959720317173237214852815'
        ]);

        await send(mockUniswapV2Pool2, 'setData', [
            asset2._address,
            WETHToken._address,
            '185850109323804242560637514',
            '517682812260927681611929',
            '222207120848530231902067171756422825567',
            '18388112711916799881959720317173237214852815'
        ]);

        await send(mockUniswapV2Pool3, 'setData', [
            asset._address,
            asset2._address,
            '185850109323804242560637514',
            '517682812260927681611929',
            '222207120848530231902067171756422825567',
            '18388112711916799881959720317173237214852815'
        ]);

        pEth = await makePToken({
            kind: "pether",
            controller: controller,
            supportMarket: true,
            registryProxy: registryProxy,
            mockPriceFeed: mockPriceFeed,
            mockUniswapV2Factory: mockUniswapV2Factory,
            mockUniswapV2Pool: mockUniswapV2Pool,
            priceOracle: priceOracle,
            WETHToken: WETHToken
        });

        pOther = await makePToken({
            controller: controller,
            supportMarket: true,
            registryProxy: registryProxy,
            mockPriceFeed: mockPriceFeed,
            mockUniswapV2Factory: mockUniswapV2Factory,
            mockUniswapV2Pool: mockUniswapV2Pool,
            priceOracle: priceOracle,
            underlying: asset,
            WETHToken: WETHToken
        });

        pOther2 = await makePToken({
            controller: controller,
            supportMarket: true,
            registryProxy: registryProxy,
            mockPriceFeed: mockPriceFeed,
            mockUniswapV2Factory: mockUniswapV2Factory,
            mockUniswapV2Pool: mockUniswapV2Pool,
            priceOracle: priceOracle,
            underlying: asset2,
            WETHToken: WETHToken
        });

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

        await send(registryProxy, '_setFactoryContract', [pTokenFactory._address]);

        await send(registryProxy, '_setOracle', [priceOracle._address]);
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
        it("create LP pToken", async () => {
            await increaseTime(86401);

            let block = await web3.eth.getBlock(await blockNumber());
            let startBorrowTimestamp = +block.timestamp;

            await send(mockUniswapV2Pool2, 'setBlockTimeStampLast', [block.timestamp]);
            await send(mockUniswapV2Pool, 'setBlockTimeStampLast', [block.timestamp]);

            let result = await send(pTokenFactory, 'createPToken', [mockUniswapV2Pool3._address]);

            let pTokenAddress = result.events['PTokenCreated'].returnValues['newPToken'];

            expect(result).toSucceed();
            expect(result).toHaveLog('PTokenCreated', {newPToken: pTokenAddress, startBorrowTimestamp: startBorrowTimestamp, underlyingType: '2'});
        });

        it("short create LP pToken", async () => {
            let pLPtoken = await makePToken({
                controller: controller,
                supportMarket: true,
                registryProxy: registryProxy,
                mockPriceFeed: mockPriceFeed,
                mockUniswapV2Factory: mockUniswapV2Factory,
                mockUniswapV2Pool: mockUniswapV2Pool3,
                priceOracle: priceOracle,
                underlying: mockUniswapV2Pool3,
                WETHToken: WETHToken,
                uniswapFactoryVersion: 2
            });

            expect(pLPtoken._address).not.toEqual(ZERO_ADDRESS);
            expect(await call(pLPtoken, 'decimals')).toEqual('8');
        });
    });
});
