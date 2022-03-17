const BigNumber = require('bignumber.js');

const mine = (timestamp) => {
    return new Promise((resolve, reject) => {
        saddle.web3.currentProvider.send({
            jsonrpc: '2.0',
            method: 'evm_mine',
            id: Date.now(),
            params: [timestamp],
        }, (err, res) => {
            if (err) return reject(err);
            resolve(res)
        })
    })
};

const {
    makeToken,
    makePToken,
    makeRegistryProxy,
} = require('../Utils/DeFiPie');

const {
    constants,    // Common constants, like the zero address and largest integers
} = require('@openzeppelin/test-helpers');

describe('PriceOracle', () => {
    let root, admin, accounts;
    let priceOracle, mockPriceFeed, registryProxy;
    let mockUniswapV2Factory, mockUniswapV2Pool, WETHToken, asset, uniswapV2PriceOracle;
    let pEth, pOther;
    let mockUniswapV3Factory, uniswapV3PriceOracle;

    beforeEach(async () => {
        [root, admin, ...accounts] = saddle.accounts;

        registryProxy = await makeRegistryProxy();
        mockPriceFeed = await deploy('MockPriceFeed');

        priceOracle = await deploy('PriceOracleHarness', [
            mockPriceFeed._address,
        ]);
        let tx = await send(priceOracle, '_setRegistry', [registryProxy._address]);

        mockUniswapV2Factory = await deploy('MockUniswapV2Factory');
        mockUniswapV2Pool = await deploy('MockUniswapV2Pool');
        WETHToken = await makeToken();
        asset = await makeToken();

        let tx1 = await send(mockUniswapV2Factory, 'setPair', [mockUniswapV2Pool._address]);
        let tx2 = await send(mockUniswapV2Factory, 'setPairExist', [true]);
        let pair = await call(mockUniswapV2Factory, "getPair", [WETHToken._address, asset._address]);
        expect(pair).toEqual(mockUniswapV2Pool._address);

        uniswapV2PriceOracle = await deploy('UniswapV2PriceOracleHarness', [
            mockUniswapV2Factory._address,
            WETHToken._address
        ]);

        let tx0 = await send(uniswapV2PriceOracle, '_setRegistry', [registryProxy._address]);
        let tx0_ = await send(priceOracle, '_addOracle', [uniswapV2PriceOracle._address]);

        let tx3 = await send(uniswapV2PriceOracle, '_setRegistry', [registryProxy._address]);

        await send(mockUniswapV2Pool, 'setData', [
            asset._address,
            WETHToken._address,
            '185850109323804242560637514',
            '517682812260927681611929',
            '222207120848530231902067171756422825567',
            '18388112711916799881959720317173237214852815'
        ]);

        pEth = await makePToken({
            kind: "pether",
            controllerOpts: {kind: "bool"},
            supportMarket: true,
            registryProxy: registryProxy,
            mockPriceFeed: mockPriceFeed,
            mockUniswapV2Factory: mockUniswapV2Factory,
            mockUniswapV2Pool: mockUniswapV2Pool,
            priceOracle: priceOracle,
            WETHToken: WETHToken
        });

        pOther = await makePToken({
            controller: pEth.controller,
            supportMarket: true,
            registryProxy: registryProxy,
            mockPriceFeed: mockPriceFeed,
            mockUniswapV2Factory: mockUniswapV2Factory,
            mockUniswapV2Pool: mockUniswapV2Pool,
            priceOracle: priceOracle,
            underlying: asset,
            WETHToken: WETHToken
        });

        let otherAddress = await call(pOther, "underlying");
        expect(asset._address).toEqual(otherAddress);

        mockUniswapV3Factory = await deploy('MockUniswapV3Factory');

        uniswapV3PriceOracle = await deploy('UniswapV3PriceOracleHarness', [
            mockUniswapV3Factory._address,
            WETHToken._address
        ]);

        let result = await send(uniswapV3PriceOracle, '_setRegistry', [registryProxy._address]);
        expect(result).toSucceed();
    });

    describe("constructor", () => {
        it("gets address of registry", async () => {
            let registryProxyAddress = await call(priceOracle, "registry");
            expect(registryProxyAddress).toEqual(registryProxy._address);
        });

        it("gets address of Chainlink price feed", async () => {
            let ETHUSDPriceFeed = await call(priceOracle, "ETHUSDPriceFeed");
            expect(ETHUSDPriceFeed).toEqual(mockPriceFeed._address);
        });
    });

    describe("admin value", () => {
        it("check admin from registry and oracle", async () => {
            let oracleAdmin = await call(priceOracle, "getMyAdmin");
            let registryAdmin = await call(registryProxy, "admin");
            expect(oracleAdmin).toEqual(registryAdmin);
        });
    });

    describe("check getUnderlyingPrice function", () => {
        it("Returns price in USD for Eth", async () => {
            let latestAnswer = new BigNumber(400e8); // 400 x 10e8
            await send(mockPriceFeed, 'setLatestAnswer', [latestAnswer]);

            let ethInUsd = new BigNumber(400e18); // 400 $
            let ethPrice = await call(priceOracle, "getUnderlyingPrice", [pEth._address]);

            expect(ethPrice).toEqual(ethInUsd.valueOf());
        });

        it("Returns price in USD for Other", async () => {
            let latestAnswer = new BigNumber(400e8); // 400 x 10e8
            await send(mockPriceFeed, 'setLatestAnswer', [latestAnswer]);

            let otherInUsd = new BigNumber('1114194259329652800'); // 1,11 dollar
            let otherPrice = await call(priceOracle, "getUnderlyingPrice", [pOther._address]);

            expect(otherPrice).toEqual(otherInUsd.valueOf());
        });
    });

    describe("check updateUnderlyingPrice function", () => {
        it("Returns 0 for pEth", async () => {
            let answer = await call(priceOracle, "updateUnderlyingPrice", [pEth._address]);

            expect(answer).toEqual('0');
        });
    });

    describe("check getPriceInUSD and getPriceInETH functions", () => {
        it("Returns price for Eth", async () => {
            let latestAnswer = new BigNumber(500e8); // 500$ x 10e8, chainlink USD with 8 decimals of precision
            await send(mockPriceFeed, 'setLatestAnswer', [latestAnswer]);

            let ethInUsd = new BigNumber(500e18); // 500 $ oracle USD with 18 decimals of precision
            let otherPriceInETH = await call(priceOracle, "getPriceInETH", [pEth._address]);
            let ethPrice = (new BigNumber(500)).multipliedBy(otherPriceInETH);

            expect(ethPrice.toString()).toEqual(ethInUsd.toString());

            ethInUsd = await call(priceOracle, "getPriceInUSD", [pEth._address]);
            expect(ethPrice.toString()).toEqual(ethInUsd.toString());
        });

        it("Returns price for Other", async () => {
            let latestAnswer = new BigNumber(500e8); // 500$ x 10e8 chainlink USD with 8 decimals of precision
            await send(mockPriceFeed, 'setLatestAnswer', [latestAnswer]);

            let otherInUsd = new BigNumber('1392742824162066000'); // 1,39$ with 18 decimals of precision
            let otherPriceInETH = await call(priceOracle, "getPriceInETH", [asset._address]);
            let otherPriceInUSD = (new BigNumber(500)).multipliedBy(otherPriceInETH);

            expect(otherInUsd.toString()).toEqual(otherPriceInUSD.toString());

            otherInUsd = await call(priceOracle, "getPriceInUSD", [asset._address]);
            expect(otherInUsd.toString()).toEqual(otherPriceInUSD.toString());
        });

        it("Returns price for Other", async () => {
            let emptyAssetPrice = new BigNumber('0'); // 1,39$ with 18 decimals of precision
            let emptyAssetPriceInETH = await call(priceOracle, "getPriceInETH", [accounts[2]]);

            expect(emptyAssetPrice.toString()).toEqual(emptyAssetPriceInETH.toString());

            emptyAssetPrice = await call(priceOracle, "getPriceInUSD", [accounts[2]]);
            expect(emptyAssetPrice.toString()).toEqual(emptyAssetPriceInETH.toString());
        });
    });

    describe("check add oracle function", () => {
        it("add oracle, not UNAUTHORIZED", async () => {
            let result = await send(priceOracle, '_addOracle', [
                uniswapV3PriceOracle._address
            ], {from: accounts[2]});

            expect(result).toHaveOracleFailure('UNAUTHORIZED', 'ADD_ORACLE');
        });

        it('add oracle, invalid address for oracle', async () => {
            await expect(
                send(priceOracle, '_addOracle', [
                    constants.ZERO_ADDRESS
                ]),
            ).rejects.toRevert('revert PriceOracle: invalid address for oracle');
        });

        it("add oracle, but oracle exist", async () => {
            let result = await send(priceOracle, '_addOracle', [
                uniswapV2PriceOracle._address
            ]);

            expect(result).toHaveOracleFailure('ORACLE_EXIST', 'ADD_ORACLE');
        });

        it("add oracle twice", async () => {
            let result = await send(priceOracle, '_addOracle', [
                uniswapV3PriceOracle._address
            ]);

            expect(result).toSucceed();

            result = await send(priceOracle, '_addOracle', [
                uniswapV3PriceOracle._address
            ]);

            expect(result).toHaveOracleFailure('ORACLE_EXIST', 'ADD_ORACLE');
        });

        it("add oracle, check data", async () => {
            let priceOracles = await call(priceOracle, "getAllPriceOracles");
            expect(priceOracles).toEqual([uniswapV2PriceOracle._address]);

            let tx1 = await send(priceOracle, '_addOracle', [
                uniswapV3PriceOracle._address
            ]);

            priceOracles = await call(priceOracle, "getAllPriceOracles");
            expect(priceOracles).toEqual([uniswapV2PriceOracle._address, uniswapV3PriceOracle._address]);

            let newUniswapV3PriceOracle = await deploy('UniswapV3PriceOracleHarness', [
                mockUniswapV3Factory._address,
                WETHToken._address
            ]);

            let tx2 = await send(priceOracle, '_addOracle', [
                newUniswapV3PriceOracle._address
            ]);

            priceOracles = await call(priceOracle, "getAllPriceOracles");
            expect(priceOracles).toEqual([uniswapV2PriceOracle._address, uniswapV3PriceOracle._address, newUniswapV3PriceOracle._address]);
        });

        it('add oracle, check event', async () => {
            let result = await send(priceOracle, '_addOracle', [
                uniswapV3PriceOracle._address
            ]);

            let length = await call(priceOracle, "getPriceOraclesLength");

            expect(result).toHaveLog('OracleAdded', {
                oracleId: '' + (+length - 1),
                oracle: uniswapV3PriceOracle._address
            });
        });
    });

    describe("check search pair function", () => {
        it("Add 2 oracles and check state", async () => {
            let mockOracle1 = await deploy('FixedUniswapPriceOracle');
            let mockOracle2 = await deploy('FixedUniswapPriceOracle');

            // update oracles
            let result = await send(priceOracle, '_updateOracle', [
                '0',
                mockOracle1._address
            ]);

            result = await send(priceOracle, '_addOracle', [
                mockOracle2._address
            ]);

            // set pairs
            result = await send(mockOracle1, 'setSearchPair', [
                accounts[2],
                '1000'
            ]);

            // check search pair
            result = await call(priceOracle, "searchPair", [
                asset._address
            ]);

            expect(result).toMatchObject({0: mockOracle1._address, 1: accounts[2], 2: '1000'});

            // set better pair
            result = await send(mockOracle2, 'setSearchPair', [
                accounts[3],
                '2000'
            ]);

            // check search pair
            result = await call(priceOracle, "searchPair", [
                asset._address
            ]);
            expect(result).toMatchObject({0: mockOracle2._address, 1: accounts[3], 2: '2000'});
        });
    });

});