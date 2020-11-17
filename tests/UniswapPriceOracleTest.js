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
    makePToken,
    makeRegistryProxy,
} = require('./Utils/DeFiPie');

describe('UniswapPriceOracle', () => {
    let root, admin, accounts;
    let uniswapPriceOracle, pEth, pOther, mockPriceFeed, otherAddress, registryProxy;

    beforeEach(async () => {
        [root, admin, ...accounts] = saddle.accounts;

        mockPriceFeed = await deploy('MockPriceFeed');
        registryProxy = await makeRegistryProxy();
        uniswapPriceOracle = await deploy('UniswapPriceOracleHarness', [
            registryProxy._address,
            mockPriceFeed._address,
            mockPriceFeed._address,
            mockPriceFeed._address,
        ]);

        await send(mockPriceFeed, 'setReserves', [
            '185850109323804242560637514',
            '517682812260927681611929'
        ]);
        await send(mockPriceFeed, 'setPricesCumulativeLast', [
            '222207120848530231902067171756422825567',
            '18388112711916799881959720317173237214852815'
        ]);

        pEth = await makePToken({
            kind: "pether",
            controllerOpts: {kind: "bool"},
            supportMarket: true,
            registryProxy: registryProxy,
            mockPriceFeed: mockPriceFeed,
            uniswapPriceOracle: uniswapPriceOracle,
        });

        pOther = await makePToken({
            controller: pEth.controller,
            supportMarket: true,
            registryProxy: registryProxy,
            mockPriceFeed: mockPriceFeed,
            uniswapPriceOracle: uniswapPriceOracle,
        });

        otherAddress = await call(pOther, "underlying");
        await send(mockPriceFeed, 'setToken0Address', [otherAddress]);
        await send(mockPriceFeed, 'setToken1Address', [mockPriceFeed._address]);

        let block = await saddle.web3.eth.getBlock("latest");
        await send(mockPriceFeed, 'setBlockTimestampLast', [block.timestamp]);

        expect(
            await send(uniswapPriceOracle, 'update', [otherAddress])
        ).toHaveLog("PriceUpdated", {
            asset: otherAddress,
            price: "1114194259329652800", // 1,11$ with 18 decimals of precision
        });
    });

    describe("check update function", () => {
        it("Check update function", async () => {
            let data = await call(uniswapPriceOracle, "cumulativePrices", [otherAddress]);
            let period = await call(uniswapPriceOracle, "PERIOD");
            let timestamp = +data.blockTimestampPrevious + +period +1;

            mine(timestamp);

            await send(mockPriceFeed, 'setReserves', [
                '185833232609097660547126583',
                '518393146531750468783635'
            ]);

            await send(mockPriceFeed, 'setPricesCumulativeLast', [
                '222215615064106418572107375213052053317',
                '18389206346193927773189674665585517662154410'
            ]);

            await send(mockPriceFeed, 'setBlockTimestampLast', [timestamp]);

            expect(
                await send(uniswapPriceOracle, 'update', [otherAddress])
            ).toHaveLog("PriceUpdated", {
                asset: otherAddress,
                price: "1088802937255133600", // 1,08$ with 18 decimals of precision
            });

            let otherInEth = new BigNumber('2722007343137834'); // 1 eth = 367,3759 other
            let otherPriceInEth = await call(uniswapPriceOracle, "getCourseInETH", [otherAddress]);
            expect(otherPriceInEth).toEqual(otherInEth.valueOf());
        });

        it("Call update function two times", async () => {
            let block = await saddle.web3.eth.getBlock("latest");
            let period = await call(uniswapPriceOracle, "PERIOD");

            let timestamp = +block.timestamp + +period;
            mine(timestamp);

            await send(uniswapPriceOracle, 'update', [otherAddress]);

            let result = await send(uniswapPriceOracle, 'update', [otherAddress]);
            expect(result).toHaveOracleFailure('UPDATE_PRICE', 'PERIOD_NOT_ELAPSED');
        });

        it("New pool", async () => {
            let newPOther = await makePToken({controller: pEth.controller, supportMarket: true});
            let newOtherAddress = await call(newPOther, "underlying");

            let newMockPriceFeed = await deploy('MockPriceFeed');

            await send(newMockPriceFeed, 'setToken0Address', [newOtherAddress]);
            await send(newMockPriceFeed, 'setToken1Address', [newMockPriceFeed._address]);

            uniswapPriceOracle = await deploy('UniswapPriceOracleHarness', [
                registryProxy._address,
                newMockPriceFeed._address,
                newMockPriceFeed._address,
                newMockPriceFeed._address,
            ]);

            await send(newMockPriceFeed, 'setReserves', [
                '5050000000000000000000000000000000',
                '101000000000000000'
            ]);

            await send(newMockPriceFeed, 'setPricesCumulativeLast', ['0', '0']);

            let block = await saddle.web3.eth.getBlock("latest");
            await send(newMockPriceFeed, 'setBlockTimestampLast', [block.timestamp]);

            await send(uniswapPriceOracle, 'update', [newOtherAddress]);

            let newTimestamp = +block.timestamp+10;
            mine(newTimestamp);

            await send(newMockPriceFeed, 'setReserves', [
                '5050000000000000000000000000000000',
                '101000000000000000'
            ]);
            await send(newMockPriceFeed, 'setPricesCumulativeLast', [
                '20353803685456524192',
                '50884509213641310759598864026356940800000000000000000'
            ]);

            await send(newMockPriceFeed, 'setBlockTimestampLast', [newTimestamp]);

            let otherInEth = new BigNumber('19'); // 1 eth = 5х10**16
            await send(uniswapPriceOracle, 'update', [newOtherAddress]);

            let otherPriceInEth = await call(uniswapPriceOracle, "getCourseInETH", [newOtherAddress]);
            expect(otherPriceInEth).toEqual(otherInEth.valueOf());
        });
    });

    describe("constructor", () => {
        it("gets address of registry", async () => {
            let registryProxyAddress = await call(uniswapPriceOracle, "registry");
            expect(registryProxyAddress).toEqual(registryProxy._address);
        });

        it("gets address of Uniswap factory", async () => {
            let uniswapFactory = await call(uniswapPriceOracle, "uniswapFactory");
            expect(uniswapFactory).toEqual(mockPriceFeed._address);
        });

        it("gets address of Uniswap WETH", async () => {
            let WETHUniswap = await call(uniswapPriceOracle, "WETHUniswap");
            expect(WETHUniswap).toEqual(mockPriceFeed._address);
        });

        it("gets address of Chainlink price feed", async () => {
            let ETHUSDPriceFeed = await call(uniswapPriceOracle, "ETHUSDPriceFeed");
            expect(ETHUSDPriceFeed).toEqual(mockPriceFeed._address);
        });
    });

    describe("check getUnderlyingPrice function", () => {
        it("Returns price in USD for Eth", async () => {
            let latestAnswer = new BigNumber(400e8); // 400 x 10e8
            await send(mockPriceFeed, 'setLatestAnswer', [latestAnswer]);

            let ethInUsd = new BigNumber(400e18); // 400 $
            let ethPrice = await call(uniswapPriceOracle, "getUnderlyingPrice", [pEth._address]);

            expect(ethPrice).toEqual(ethInUsd.valueOf());
        });

        it("Returns price in USD for Other", async () => {
            let latestAnswer = new BigNumber(400e8); // 400 x 10e8
            await send(mockPriceFeed, 'setLatestAnswer', [latestAnswer]);

            let otherInUsd = new BigNumber('1114194259329652800'); // 1,11 dollar
            let otherPrice = await call(uniswapPriceOracle, "getUnderlyingPrice", [pOther._address]);

            expect(otherPrice).toEqual(otherInUsd.valueOf());
        });
    });

    describe("check getCourseToETH function", () => {
        it("Returns course to ETH for ETH", async () => {
            let ethInEth = new BigNumber(1e18); // 1 eth = 1 eth
            let ethPriceInEth = await call(uniswapPriceOracle, "getCourseInETH", [pEth._address]);

            expect(ethPriceInEth).toEqual(ethInEth.valueOf());
        });

        it("Returns course to ETH for Other", async () => {
            let otherInEth = new BigNumber('2785485648324132'); // 1 eth = 359,003824199 other

            let otherPriceInEth = await call(uniswapPriceOracle, "getCourseInETH", [otherAddress]);
            expect(otherPriceInEth).toEqual(otherInEth.valueOf());
        });
    });

    describe("check getPriceInUSD function", () => {
        it("Returns price for Eth", async () => {
            let latestAnswer = new BigNumber(500e8); // 500$ x 10e8, chainlink USD with 8 decimals of precision
            await send(mockPriceFeed, 'setLatestAnswer', [latestAnswer]);

            let ethInUsd = new BigNumber(500e18); // 500 $ oracle USD with 18 decimals of precision
            let ethPrice = await call(uniswapPriceOracle, "getPriceInUSD", [pEth._address]);

            expect(ethPrice).toEqual(ethInUsd.valueOf());
        });

        it("Returns price for Other", async () => {
            let latestAnswer = new BigNumber(500e8); // 500$ x 10e8 chainlink USD with 8 decimals of precision
            await send(mockPriceFeed, 'setLatestAnswer', [latestAnswer]);

            let otherInUsd = new BigNumber('1392742824162066000'); // 1,36$ with 18 decimals of precision
            let otherPrice = await call(uniswapPriceOracle, "getPriceInUSD", [otherAddress]);

            expect(otherPrice).toEqual(otherInUsd.valueOf());
        });
    });
});