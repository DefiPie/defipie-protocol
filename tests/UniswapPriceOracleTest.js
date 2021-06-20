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
} = require('./Utils/DeFiPie');

const {
    constants,    // Common constants, like the zero address and largest integers
} = require('@openzeppelin/test-helpers');

describe('UniswapPriceOracle', () => {
    let root, admin, accounts;
    let uniswapPriceOracle, pEth, pOther, mockPriceFeed, otherAddress, registryProxy;
    let mockUniswapFactory, mockUniswapPool, WETHToken, asset;

    beforeEach(async () => {
        [root, admin, ...accounts] = saddle.accounts;

        registryProxy = await makeRegistryProxy();

        mockPriceFeed = await deploy('MockPriceFeed');
        mockUniswapFactory = await deploy('MockUniswapFactory');
        mockUniswapPool = await deploy('MockUniswapPool');
        WETHToken = await makeToken();
        asset = await makeToken();

        let tx1 = await send(mockUniswapFactory, 'setPair', [mockUniswapPool._address]);
        let tx2 = await send(mockUniswapFactory, 'setPairExist', [true]);
        let pair = await call(mockUniswapFactory, "getPair", [WETHToken._address, asset._address]);
        expect(pair).toEqual(mockUniswapPool._address);

        uniswapPriceOracle = await deploy('UniswapPriceOracleHarness', [
            mockUniswapFactory._address,
            WETHToken._address,
            mockPriceFeed._address,
        ]);

        let tx3 = await send(uniswapPriceOracle, '_setRegistry', [registryProxy._address]);

        await send(mockUniswapPool, 'setData', [
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
            mockUniswapFactory: mockUniswapFactory,
            mockUniswapPool: mockUniswapPool,
            uniswapPriceOracle: uniswapPriceOracle,
            WETHToken: WETHToken
        });

        pOther = await makePToken({
            controller: pEth.controller,
            supportMarket: true,
            registryProxy: registryProxy,
            mockPriceFeed: mockPriceFeed,
            mockUniswapFactory: mockUniswapFactory,
            mockUniswapPool: mockUniswapPool,
            uniswapPriceOracle: uniswapPriceOracle,
            underlying: asset,
            WETHToken: WETHToken
        });

        otherAddress = await call(pOther, "underlying");
        expect(asset._address).toEqual(otherAddress);

        let cumulativePrice = await call(uniswapPriceOracle, "cumulativePrices", [mockUniswapFactory._address, otherAddress]);
        expect('0').toEqual(cumulativePrice.priceCumulativePrevious);
        expect('0').toEqual(cumulativePrice.blockTimeStampPrevious);
        expect('0').toEqual(cumulativePrice.priceAverage[0]);

        let block = await saddle.web3.eth.getBlock("latest");
        await send(mockUniswapPool, 'setBlockTimeStampLast', [block.timestamp]);

        expect(
            await send(uniswapPriceOracle, 'update', [otherAddress])
        ).toHaveLog("PriceUpdated", {
            asset: otherAddress,
            price: "2785485648324132", // Price in ETH with 18 decimals of precision
        });

        let otherInUSD = new BigNumber('1114194259329652800'); // 1,11$ with 18 decimals of precision
        let otherPriceInUSD = await call(uniswapPriceOracle, "getPriceInUSD", [otherAddress]);
        expect(otherPriceInUSD).toEqual(otherInUSD.valueOf());
    });

    describe("check update function", () => {
        it("Check update function", async () => {
            let pairAddress = await call(uniswapPriceOracle, "assetPair", [otherAddress]);
            let data = await call(uniswapPriceOracle, "cumulativePrices", [pairAddress, otherAddress]);
            let period = await call(uniswapPriceOracle, "period");
            let timestamp = +data.blockTimeStampPrevious + +period +1;

            mine(timestamp);

            await send(mockUniswapPool, 'setData', [
                asset._address,
                WETHToken._address,
                '185833232609097660547126583',
                '518393146531750468783635',
                '222215615064106418572107375213052053317',
                '18389206346193927773189674665585517662154410'
            ]);

            await send(mockUniswapPool, 'setBlockTimeStampLast', [timestamp]);

            expect(
                await send(uniswapPriceOracle, 'update', [otherAddress])
            ).toHaveLog("PriceUpdated", {
                asset: otherAddress,
                price: "2722007343137834", // Price in ETH with 18 decimals of precision
            });

            let otherInUSD = new BigNumber('1088802937255133600'); // 1,08$ with 18 decimals of precision
            let otherPriceInUSD = await call(uniswapPriceOracle, "getPriceInUSD", [otherAddress]);
            expect(otherPriceInUSD).toEqual(otherInUSD.valueOf());
        });

        it("Call update function two times", async () => {
            let block = await saddle.web3.eth.getBlock("latest");
            let period = await call(uniswapPriceOracle, "period");

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
            let newMockUniswapFactory = await deploy('MockUniswapFactory');
            let newMockUniswapPool = await deploy('MockUniswapPool');
            let tx1 = await send(newMockUniswapFactory, 'setPair', [newMockUniswapPool._address]);
            let tx2 = await send(newMockUniswapFactory, 'setPairExist', [true]);

            uniswapPriceOracle = await deploy('UniswapPriceOracleHarness', [
                newMockUniswapFactory._address,
                WETHToken._address,
                newMockPriceFeed._address,
            ]);

            let tx3 = await send(uniswapPriceOracle, '_setRegistry', [registryProxy._address]);

            await send(newMockUniswapPool, 'setData', [
                newOtherAddress,
                WETHToken._address,
                '5050000000000000000000000000000000',
                '101000000000000000',
                '0',
                '0'
            ]);

            let block = await saddle.web3.eth.getBlock("latest");
            await send(newMockUniswapPool, 'setBlockTimeStampLast', [block.timestamp]);

            let cumulativePrice = await call(uniswapPriceOracle, "cumulativePrices", [newMockUniswapFactory._address, newOtherAddress]);
            expect('0').toEqual(cumulativePrice.priceCumulativePrevious);
            expect('0').toEqual(cumulativePrice.blockTimeStampPrevious);
            expect('0').toEqual(cumulativePrice.priceAverage[0]);

            await send(uniswapPriceOracle, 'update', [newOtherAddress]);

            let newTimestamp = +block.timestamp+10;
            mine(newTimestamp);

            await send(newMockUniswapPool, 'setData', [
                newOtherAddress,
                WETHToken._address,
                '5050000000000000000000000000000000',
                '101000000000000000',
                '20353803685456524192',
                '50884509213641310759598864026356940800000000000000000'
            ]);

            await send(newMockUniswapPool, 'setBlockTimeStampLast', [newTimestamp]);

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

        it("gets address of first pool factory", async () => {
            let uniswapFactory = await call(uniswapPriceOracle, "poolFactories", [0]);
            expect(uniswapFactory).toEqual(mockUniswapFactory._address);
        });

        it("gets address of WETH Token", async () => {
            let WETHToken_ = await call(uniswapPriceOracle, "WETHToken");
            expect(WETHToken_).toEqual(WETHToken._address);
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

    describe("check updateUnderlyingPrice function", () => {
        it("Returns 0 for pEth", async () => {
            let answer = await call(uniswapPriceOracle, "updateUnderlyingPrice", [pEth._address]);

            expect(answer).toEqual('0');
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

            let otherInUsd = new BigNumber('1392742824162066000'); // 1,39$ with 18 decimals of precision
            let otherPrice = await call(uniswapPriceOracle, "getPriceInUSD", [otherAddress]);

            expect(otherPrice).toEqual(otherInUsd.valueOf());
        });
    });

    describe("check init function", () => {
        it("Check initialized once", async () => {
            let testOracle = await deploy('UniswapPriceOracle');
            await send(testOracle, 'initialize', [
                mockUniswapFactory._address,
                WETHToken._address,
                mockPriceFeed._address,
            ]);

            await expect(
                send(testOracle, 'initialize', [
                    mockUniswapFactory._address,
                    WETHToken._address,
                    mockPriceFeed._address,
                ])
            ).rejects.toRevert('revert Oracle: may only be initialized once');
        });

        it('Invalid addresses for factory', async () => {
            let testOracle = await deploy('UniswapPriceOracle');

            await expect(
                send(testOracle, 'initialize', [
                    constants.ZERO_ADDRESS,
                    WETHToken._address,
                    mockPriceFeed._address,
                ]),
            ).rejects.toRevert('revert Oracle: invalid address for factory');
        });

        it('Check event', async () => {
            let testOracle = await deploy('UniswapPriceOracle');

            let result = await send(testOracle, 'initialize', [
                mockUniswapFactory._address,
                WETHToken._address,
                mockPriceFeed._address,
            ]);

            let block = await saddle.web3.eth.getBlock("latest");

            expect(result).toHaveLog('PoolAdded', {
                id: '0',
                poolFactory: mockUniswapFactory._address
            });
        });

        it('Check init data ', async () => {
            let testOracle = await deploy('UniswapPriceOracleHarness', [
                mockUniswapFactory._address,
                WETHToken._address,
                mockPriceFeed._address,
            ]);

            let tx0 = await send(testOracle, '_setRegistry', [registryProxy._address]);

            let factory = await call(testOracle, "poolFactories", [0]);
            expect(factory).toEqual(mockUniswapFactory._address);
        });
    });

    describe("check _setNewAddresses function", () => {
        it("Check set new addresses", async () => {
            let tx = await send(uniswapPriceOracle, '_setNewAddresses', [
                mockUniswapFactory._address,
                mockUniswapFactory._address,
            ]);

            let WETHToken = await call(uniswapPriceOracle, "WETHToken");
            expect(WETHToken).toEqual(mockUniswapFactory._address);

            let ETHUSDPriceFeed = await call(uniswapPriceOracle, "ETHUSDPriceFeed");
            expect(ETHUSDPriceFeed).toEqual(mockUniswapFactory._address);
        });

        it("set new addresses values, not UNAUTHORIZED", async () => {
            let result = await send(uniswapPriceOracle, '_setNewAddresses', [
                mockUniswapFactory._address,
                mockUniswapFactory._address,
            ], {from: accounts[2]});

            expect(result).toHaveOracleFailure('UNAUTHORIZED', 'UPDATE_DATA');
        });
    });

    describe("check _setNewRegistry function", () => {
        it("Check set new registry address", async () => {
            let tx = await send(uniswapPriceOracle, '_setNewRegistry', [
                accounts[2],
            ]);

            let registry = await call(uniswapPriceOracle, "registry");
            expect(registry).toEqual(accounts[2]);
        });

        it("set new registry address, not UNAUTHORIZED", async () => {
            let result = await send(uniswapPriceOracle, '_setNewRegistry', [
                accounts[2],
            ], {from: accounts[2]});

            expect(result).toHaveOracleFailure('UNAUTHORIZED', 'UPDATE_DATA');
        });
    });

    describe("check add pool function", () => {
        it("add pool, not UNAUTHORIZED", async () => {
            let result = await send(uniswapPriceOracle, '_addPool', [
                mockUniswapFactory._address
            ], {from: accounts[2]});

            expect(result).toHaveOracleFailure('UNAUTHORIZED', 'ADD_POOL_OR_COIN');
        });

        it('add pool, invalid address for factory', async () => {
            await expect(
                send(uniswapPriceOracle, '_addPool', [
                    constants.ZERO_ADDRESS
                ]),
            ).rejects.toRevert('revert Oracle: invalid address for factory');
        });

        it("add pool, but pool exist", async () => {
            let result = await send(uniswapPriceOracle, '_addPool', [
                mockUniswapFactory._address
            ]);

            expect(result).toHaveOracleFailure('POOL_OR_COIN_EXIST', 'ADD_POOL_OR_COIN');
        });

        it("add pool twice", async () => {
            let newMockUniswapFactory = await deploy('MockUniswapFactory');

            let result = await send(uniswapPriceOracle, '_addPool', [
                newMockUniswapFactory._address
            ]);

            expect(result).toSucceed();

            result = await send(uniswapPriceOracle, '_addPool', [
                newMockUniswapFactory._address
            ]);

            expect(result).toHaveOracleFailure('POOL_OR_COIN_EXIST', 'ADD_POOL_OR_COIN');
        });

        it("add pool, check data", async () => {
            let poolFactories = await call(uniswapPriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapFactory._address]);

            let newFactory1 = await deploy('MockUniswapFactory');

            let tx1 = await send(uniswapPriceOracle, '_addPool', [
                newFactory1._address
            ]);

            poolFactories = await call(uniswapPriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapFactory._address, newFactory1._address]);

            let newFactory2 = await deploy('MockUniswapFactory');

            let tx2 = await send(uniswapPriceOracle, '_addPool', [
                newFactory2._address
            ]);

            poolFactories = await call(uniswapPriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapFactory._address, newFactory1._address, newFactory2._address]);
        });

        it('add pool, check event', async () => {
            let newMockUniswapFactory = await deploy('MockUniswapFactory');

            let result = await send(uniswapPriceOracle, '_addPool', [
                newMockUniswapFactory._address
            ]);

            expect(result).toHaveLog('PoolAdded', {
                id: '1',
                poolFactory: newMockUniswapFactory._address
            });
        });
    });

    describe("check getPoolPair function", () => {
        it("check data", async () => {
            let newMockUniswapFactory1 = await deploy('MockUniswapFactory');
            let newMockUniswapPool1 = await deploy('MockUniswapPool');

            let tx1 = await send(newMockUniswapFactory1, 'setPair', [newMockUniswapPool1._address]);
            let tx2 = await send(newMockUniswapFactory1, 'setPairExist', [true]);

            let newMockUniswapFactory2 = await deploy('MockUniswapFactory');
            let newMockUniswapPool2 = await deploy('MockUniswapPool');

            let tx3 = await send(newMockUniswapFactory2, 'setPair', [newMockUniswapPool2._address]);
            let tx4 = await send(newMockUniswapFactory2, 'setPairExist', [true]);

            let pair1 = await call(mockUniswapFactory, "getPair", [WETHToken._address, asset._address]);
            expect(pair1).toEqual(mockUniswapPool._address);
            let pair2 = await call(newMockUniswapFactory1, "getPair", [WETHToken._address, asset._address]);
            expect(pair2).toEqual(newMockUniswapPool1._address);
            let pair3 = await call(newMockUniswapFactory2, "getPair", [WETHToken._address, asset._address]);
            expect(pair3).toEqual(newMockUniswapPool2._address);

            let tx5 = await send(mockUniswapFactory, 'setPairExist', [false]);

            pair1 = await call(uniswapPriceOracle, "getPoolPair", [asset._address, '0']);
            expect(pair1).toEqual(constants.ZERO_ADDRESS);

            let tx51 = await send(uniswapPriceOracle, '_addPool', [newMockUniswapFactory1._address]);
            let tx52 = await send(uniswapPriceOracle, '_addPool', [newMockUniswapFactory2._address]);

            pair1 = await call(uniswapPriceOracle, "getPoolPair", [asset._address, '0']);
            expect(pair1).toEqual(constants.ZERO_ADDRESS);
            pair2 = await call(uniswapPriceOracle, "getPoolPair", [asset._address, '1']);
            expect(pair2).toEqual(newMockUniswapPool1._address);
            pair3 = await call(uniswapPriceOracle, "getPoolPair", [asset._address, '2']);
            expect(pair3).toEqual(newMockUniswapPool2._address);

            let tx6 = await send(newMockUniswapFactory2, 'setPairExist', [false]);

            pair1 = await call(uniswapPriceOracle, "getPoolPair", [asset._address, '0']);
            expect(pair1).toEqual(constants.ZERO_ADDRESS);
            pair2 = await call(uniswapPriceOracle, "getPoolPair", [asset._address, '1']);
            expect(pair2).toEqual(newMockUniswapPool1._address);
            pair3 = await call(uniswapPriceOracle, "getPoolPair", [asset._address, '2']);
            expect(pair3).toEqual(constants.ZERO_ADDRESS);

            let tx7 = await send(newMockUniswapFactory1, 'setPairExist', [false]);

            pair1 = await call(uniswapPriceOracle, "getPoolPair", [asset._address, '0']);
            expect(pair1).toEqual(constants.ZERO_ADDRESS);
            pair2 = await call(uniswapPriceOracle, "getPoolPair", [asset._address, '1']);
            expect(pair2).toEqual(constants.ZERO_ADDRESS);
            pair3 = await call(uniswapPriceOracle, "getPoolPair", [asset._address, '2']);
            expect(pair3).toEqual(constants.ZERO_ADDRESS);

            let tx8 = await send(newMockUniswapFactory1, 'setPairExist', [true]);

            pair1 = await call(uniswapPriceOracle, "getPoolPair", [asset._address, '0']);
            expect(pair1).toEqual(constants.ZERO_ADDRESS);
            pair2 = await call(uniswapPriceOracle, "getPoolPair", [asset._address, '1']);
            expect(pair2).toEqual(newMockUniswapPool1._address);
            pair3 = await call(uniswapPriceOracle, "getPoolPair", [asset._address, '2']);
            expect(pair3).toEqual(constants.ZERO_ADDRESS);
        });
    });

    describe("check update pool function", () => {
        it("update pool, not UNAUTHORIZED", async () => {
            let result = await send(uniswapPriceOracle, '_updatePool', [
                '0',
                mockUniswapFactory._address
            ], {from: accounts[2]});

            expect(result).toHaveOracleFailure('UNAUTHORIZED', 'UPDATE_DATA');
        });

        it('update pool, invalid address for factory', async () => {
            await expect(
                send(uniswapPriceOracle, '_updatePool', [
                    '0',
                    constants.ZERO_ADDRESS
                ]),
            ).rejects.toRevert('revert Oracle: invalid address for factory');
        });

        it("update pool, but pool exist", async () => {
            let result = await send(uniswapPriceOracle, '_updatePool', [
                '0',
                mockUniswapFactory._address
            ]);

            expect(result).toHaveOracleFailure('POOL_OR_COIN_EXIST', 'UPDATE_DATA');

            let newMockUniswapFactory = await deploy('MockUniswapFactory');

            let tx = await send(uniswapPriceOracle, '_addPool', [
                newMockUniswapFactory._address
            ]);

            result = await send(uniswapPriceOracle, '_updatePool', [
                '0',
                newMockUniswapFactory._address
            ]);

            expect(result).toHaveOracleFailure('POOL_OR_COIN_EXIST', 'UPDATE_DATA');
        });

        it("update pool, check data", async () => {
            let newFactory1 = await deploy('MockUniswapFactory');

            let tx1 = await send(uniswapPriceOracle, '_addPool', [
                newFactory1._address
            ]);

            let newFactory2 = await deploy('MockUniswapFactory');

            let tx2 = await send(uniswapPriceOracle, '_addPool', [
                newFactory2._address
            ]);

            let poolFactories = await call(uniswapPriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapFactory._address, newFactory1._address, newFactory2._address]);

            let newFactory3 = await deploy('MockUniswapFactory');

            let tx3 = await send(uniswapPriceOracle, '_updatePool', [
                '0',
                newFactory3._address
            ]);

            let newFactory4 = await deploy('MockUniswapFactory');

            let tx4 = await send(uniswapPriceOracle, '_updatePool', [
                '1',
                newFactory4._address
            ]);

            let newFactory5 = await deploy('MockUniswapFactory');

            let tx5 = await send(uniswapPriceOracle, '_updatePool', [
                '2',
                newFactory5._address
            ]);

            poolFactories = await call(uniswapPriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([newFactory3._address, newFactory4._address, newFactory5._address]);
        });

        it('update pool, check event', async () => {
            let newMockUniswapFactory = await deploy('MockUniswapFactory');

            let result = await send(uniswapPriceOracle, '_updatePool', [
                '0',
                newMockUniswapFactory._address
            ]);

            expect(result).toHaveLog('PoolUpdated', {
                id: '0',
                poolFactory: newMockUniswapFactory._address
            });
        });
    });

    describe("check remove pool function", () => {
        it("remove pool, not UNAUTHORIZED", async () => {
            let result = await send(uniswapPriceOracle, '_removePool', [
                '0'
            ], {from: accounts[2]});

            expect(result).toHaveOracleFailure('UNAUTHORIZED', 'UPDATE_DATA');
        });

        it('remove pool, remove single pool', async () => {
            await expect(
                send(uniswapPriceOracle, '_removePool', [
                    '0'
                ]),
            ).rejects.toRevert('revert Oracle: must have one pool');
        });

        it("remove last pool, check data", async () => {
            let newMockUniswapFactory = await deploy('MockUniswapFactory');

            let result = await send(uniswapPriceOracle, '_addPool', [
                newMockUniswapFactory._address
            ]);

            expect(result).toSucceed();

            let poolFactories = await call(uniswapPriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapFactory._address, newMockUniswapFactory._address]);

            result = await send(uniswapPriceOracle, '_removePool', [
                '1'
            ]);

            expect(result).toHaveLog('PoolRemoved', {
                id: '1',
                poolFactory: newMockUniswapFactory._address
            });

            poolFactories = await call(uniswapPriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapFactory._address]);
        });

        it("remove pool, check data", async () => {
            let poolFactories = await call(uniswapPriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapFactory._address]);

            let newFactory1 = await deploy('MockUniswapFactory');

            let tx1 = await send(uniswapPriceOracle, '_addPool', [
                newFactory1._address
            ]);

            poolFactories = await call(uniswapPriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapFactory._address, newFactory1._address]);

            let newFactory2 = await deploy('MockUniswapFactory');

            let tx2 = await send(uniswapPriceOracle, '_addPool', [
                newFactory2._address
            ]);

            poolFactories = await call(uniswapPriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapFactory._address, newFactory1._address, newFactory2._address]);

            let tx21 = await send(uniswapPriceOracle, '_removePool', [
                '1'
            ]);

            poolFactories = await call(uniswapPriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapFactory._address, newFactory2._address]);

            let newFactory3 = await deploy('MockUniswapFactory');

            let tx3 = await send(uniswapPriceOracle, '_addPool', [
                newFactory3._address
            ]);

            poolFactories = await call(uniswapPriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapFactory._address, newFactory2._address, newFactory3._address]);

            let tx4 = await send(uniswapPriceOracle, '_removePool', [
                '2'
            ]);

            poolFactories = await call(uniswapPriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapFactory._address, newFactory2._address]);

            let tx5 = await send(uniswapPriceOracle, '_addPool', [
                newFactory3._address
            ]);

            poolFactories = await call(uniswapPriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapFactory._address, newFactory2._address, newFactory3._address]);

            let tx6 = await send(uniswapPriceOracle, '_removePool', [
                '1'
            ]);

            poolFactories = await call(uniswapPriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapFactory._address, newFactory3._address]);
        });

        it('remove pool, check event', async () => {
            let newFactory1 = await deploy('MockUniswapFactory');

            let tx1 = await send(uniswapPriceOracle, '_addPool', [
                newFactory1._address
            ]);

            let newFactory2 = await deploy('MockUniswapFactory');

            let tx2 = await send(uniswapPriceOracle, '_addPool', [
                newFactory2._address
            ]);

            let poolFactories = await call(uniswapPriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapFactory._address, newFactory1._address, newFactory2._address]);

            let result = await send(uniswapPriceOracle, '_removePool', [
                '1'
            ]);

            expect(result).toHaveLog('PoolRemoved', {
                id: '2',
                poolFactory: newFactory2._address
            });

            expect(result).toHaveLog('PoolUpdated', {
                id: '1',
                poolFactory: newFactory2._address
            });
        });
    });

    describe("check isNewAsset function", () => {
        it("add asset, check data", async () => {
            let isNewAsset = await call(uniswapPriceOracle, "isNewAsset", [asset._address]);
            expect(isNewAsset).toEqual(false);

            await send(uniswapPriceOracle, 'setPreviousTimeStampForAsset', [asset._address, '0']);

            isNewAsset = await call(uniswapPriceOracle, "isNewAsset", [asset._address]);
            expect(isNewAsset).toEqual(true);

            await send(uniswapPriceOracle, 'setPreviousTimeStampForAsset', [asset._address, '100']);

            isNewAsset = await call(uniswapPriceOracle, "isNewAsset", [asset._address]);
            expect(isNewAsset).toEqual(false);
        });
    });

    describe("check _setMinReserveLiquidity function", () => {
        it("Check set min reserve liquidity", async () => {
            let liquidity = '100';
            let tx = await send(uniswapPriceOracle, '_setMinReserveLiquidity', [
                liquidity,
            ]);

            let liquidity_ = await call(uniswapPriceOracle, "minReserveLiquidity");
            expect(liquidity_).toEqual(liquidity);
        });

        it("set new min reserve liquidity, not UNAUTHORIZED", async () => {
            let liquidity = '100';
            let result = await send(uniswapPriceOracle, '_setMinReserveLiquidity', [
                liquidity,
            ], {from: accounts[2]});

            expect(result).toHaveOracleFailure('UNAUTHORIZED', 'UPDATE_DATA');
        });
    });

    describe("check _setPeriod function", () => {
        it("Check set period", async () => {
            let period = '100';
            let tx = await send(uniswapPriceOracle, '_setPeriod', [
                period,
            ]);

            let period_ = await call(uniswapPriceOracle, "period");
            expect(period_).toEqual(period);
        });

        it("set period, not UNAUTHORIZED", async () => {
            let period = '100';
            let result = await send(uniswapPriceOracle, '_setPeriod', [
                period,
            ], {from: accounts[2]});

            expect(result).toHaveOracleFailure('UNAUTHORIZED', 'UPDATE_DATA');
        });
    });

    describe("check add stable coin function", () => {
        let stableCoin;

        beforeEach(async () => {
            stableCoin = await makeToken();
        });

        it("add stable coin, not UNAUTHORIZED", async () => {
            let result = await send(uniswapPriceOracle, '_addStableCoin', [
                stableCoin._address
            ], {from: accounts[2]});

            expect(result).toHaveOracleFailure('UNAUTHORIZED', 'ADD_POOL_OR_COIN');
        });

        it('add stable coin, invalid address for stable coin', async () => {
            await expect(
                send(uniswapPriceOracle, '_addStableCoin', [
                    constants.ZERO_ADDRESS
                ]),
            ).rejects.toRevert('revert Oracle: invalid address for stable coin');
        });

        it("add stable coin twice", async () => {
            let result = await send(uniswapPriceOracle, '_addStableCoin', [
                stableCoin._address
            ]);

            expect(result).toSucceed();

            result = await send(uniswapPriceOracle, '_addStableCoin', [
                stableCoin._address
            ]);

            expect(result).toHaveOracleFailure('POOL_OR_COIN_EXIST', 'ADD_POOL_OR_COIN');
        });

        it("add stable coin, check data", async () => {
            let stableCoins = await call(uniswapPriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([]);

            let tx1 = await send(uniswapPriceOracle, '_addStableCoin', [
                stableCoin._address
            ]);

            stableCoins = await call(uniswapPriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address]);

            let stableCoin2 = await makeToken();

            let tx2 = await send(uniswapPriceOracle, '_addStableCoin', [
                stableCoin2._address
            ]);

            stableCoins = await call(uniswapPriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin2._address]);
        });

        it('add stable coin, check event', async () => {
            let result = await send(uniswapPriceOracle, '_addStableCoin', [
                stableCoin._address
            ]);

            expect(result).toHaveLog('StableCoinAdded', {
                id: '0',
                coin: stableCoin._address,
            });
        });
    });

    describe("check remove stable coin function", () => {
        let stableCoin;

        beforeEach(async () => {
            stableCoin = await makeToken();

            let result = await send(uniswapPriceOracle, '_addStableCoin', [
                stableCoin._address
            ]);

            expect(result).toSucceed();
        });

        it("remove stable coin, not UNAUTHORIZED", async () => {
            let result = await send(uniswapPriceOracle, '_removeStableCoin', [
                '0'
            ], {from: accounts[2]});

            expect(result).toHaveOracleFailure('UNAUTHORIZED', 'UPDATE_DATA');
        });

        it('remove stable coin', async () => {
            let result = await send(uniswapPriceOracle, '_removeStableCoin', [
                '0'
            ]);

            expect(result).toSucceed();

            await expect(
                send(uniswapPriceOracle, '_removeStableCoin', [
                    '0'
                ]),
            ).rejects.toRevert('revert Oracle: stable coins are empty');
        });

        it("remove last stable coin, check data", async () => {
            let stableCoin2 = await makeToken();

            let result = await send(uniswapPriceOracle, '_addStableCoin', [
                stableCoin2._address
            ]);

            expect(result).toSucceed();

            let stableCoins = await call(uniswapPriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin2._address]);

            result = await send(uniswapPriceOracle, '_removeStableCoin', [
                '1'
            ]);

            expect(result).toHaveLog('StableCoinRemoved', {
                id: '1',
                coin: stableCoin2._address
            });

            stableCoins = await call(uniswapPriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address]);
        });

        it("remove stable coin, check data", async () => {
            let stableCoins = await call(uniswapPriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address]);

            let stableCoin2 = await makeToken();

            let result = await send(uniswapPriceOracle, '_addStableCoin', [
                stableCoin2._address
            ]);

            expect(result).toSucceed();

            stableCoins = await call(uniswapPriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin2._address]);

            let stableCoin3 = await makeToken();

            result = await send(uniswapPriceOracle, '_addStableCoin', [
                stableCoin3._address
            ]);

            expect(result).toSucceed();

            stableCoins = await call(uniswapPriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin2._address, stableCoin3._address]);

            let tx21 = await send(uniswapPriceOracle, '_removeStableCoin', [
                '1'
            ]);

            stableCoins = await call(uniswapPriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin3._address]);

            let stableCoin4 = await makeToken();

            result = await send(uniswapPriceOracle, '_addStableCoin', [
                stableCoin4._address
            ]);

            expect(result).toSucceed();

            stableCoins = await call(uniswapPriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin3._address, stableCoin4._address]);

            let tx4 = await send(uniswapPriceOracle, '_removeStableCoin', [
                '2'
            ]);

            stableCoins = await call(uniswapPriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin3._address]);

            let tx5 = await send(uniswapPriceOracle, '_addStableCoin', [
                stableCoin4._address
            ]);

            stableCoins = await call(uniswapPriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin3._address, stableCoin4._address]);

            let tx6 = await send(uniswapPriceOracle, '_removeStableCoin', [
                '1'
            ]);

            stableCoins = await call(uniswapPriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin4._address]);
        });

        it('remove pool, check event', async () => {
            let stableCoin2 = await makeToken();

            let result = await send(uniswapPriceOracle, '_addStableCoin', [
                stableCoin2._address
            ]);

            let stableCoin3 = await makeToken();

            result = await send(uniswapPriceOracle, '_addStableCoin', [
                stableCoin3._address
            ]);

            expect(result).toSucceed();

            let stableCoins = await call(uniswapPriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin2._address, stableCoin3._address]);

            result = await send(uniswapPriceOracle, '_removeStableCoin', [
                '1'
            ]);

            expect(result).toHaveLog('StableCoinRemoved', {
                id: '2',
                coin: stableCoin3._address
            });

            expect(result).toHaveLog('StableCoinUpdated', {
                id: '1',
                coin: stableCoin3._address
            });
        });
    });

    describe("check update stable coin function", () => {
        let stableCoin;

        beforeEach(async () => {
            stableCoin = await makeToken();

            let result = await send(uniswapPriceOracle, '_addStableCoin', [
                stableCoin._address
            ]);

            expect(result).toSucceed();
        });

        it("update stable coin, not UNAUTHORIZED", async () => {
            let result = await send(uniswapPriceOracle, '_updateStableCoin', [
                '0',
                stableCoin._address
            ], {from: accounts[2]});

            expect(result).toHaveOracleFailure('UNAUTHORIZED', 'UPDATE_DATA');
        });

        it('update stable coin, invalid address for coin', async () => {
            await expect(
                send(uniswapPriceOracle, '_updateStableCoin', [
                    '0',
                    constants.ZERO_ADDRESS
                ]),
            ).rejects.toRevert('revert Oracle: invalid address for stable coin');
        });

        it("update stable coin, but stable coin exist", async () => {
            let result = await send(uniswapPriceOracle, '_updateStableCoin', [
                '0',
                stableCoin._address
            ]);

            expect(result).toHaveOracleFailure('POOL_OR_COIN_EXIST', 'UPDATE_DATA');

            let stableCoin2 = await makeToken();

            result = await send(uniswapPriceOracle, '_updateStableCoin', [
                '0',
                stableCoin2._address
            ]);

            expect(result).toSucceed();

            result = await send(uniswapPriceOracle, '_updateStableCoin', [
                '0',
                stableCoin2._address
            ]);

            expect(result).toHaveOracleFailure('POOL_OR_COIN_EXIST', 'UPDATE_DATA');
        });

        it("update stable coin, check data", async () => {
            let stableCoin2 = await makeToken();

            let result = await send(uniswapPriceOracle, '_addStableCoin', [
                stableCoin2._address
            ]);

            expect(result).toSucceed();

            let stableCoin3 = await makeToken();

            result = await send(uniswapPriceOracle, '_addStableCoin', [
                stableCoin3._address
            ]);

            expect(result).toSucceed();

            let stableCoins = await call(uniswapPriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin2._address, stableCoin3._address]);

            let stableCoin4 = await makeToken();

            let tx3 = await send(uniswapPriceOracle, '_updateStableCoin', [
                '0',
                stableCoin4._address
            ]);

            let stableCoin5 = await makeToken();

            let tx4 = await send(uniswapPriceOracle, '_updateStableCoin', [
                '1',
                stableCoin5._address
            ]);

            let stableCoin6 = await makeToken();

            let tx5 = await send(uniswapPriceOracle, '_updateStableCoin', [
                '2',
                stableCoin6._address
            ]);

            stableCoins = await call(uniswapPriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin4._address, stableCoin5._address, stableCoin6._address]);
        });

        it('update pool, check event', async () => {
            let stableCoin2 = await makeToken();

            let result = await send(uniswapPriceOracle, '_updateStableCoin', [
                '0',
                stableCoin2._address
            ]);

            expect(result).toHaveLog('StableCoinUpdated', {
                id: '0',
                coin: stableCoin2._address
            });
        });
    });

    describe("check isPeriodElapsed function", () => {
        it("check data", async () => {
            let pair1 = await call(mockUniswapFactory, "getPair", [WETHToken._address, asset._address]);
            expect(pair1).toEqual(mockUniswapPool._address);

            let period = await call(uniswapPriceOracle, "period");
            let blockTimeStampLast = await call(mockUniswapPool, "blockTimeStampLast");

            await send(mockUniswapPool, 'setBlockTimeStampLast', [+blockTimeStampLast+(+period)+1]);

            let isNewAsset = await call(uniswapPriceOracle, "isNewAsset", [asset._address]);
            expect(isNewAsset).toEqual(false);

            let isPeriodElapsed = await call(uniswapPriceOracle, "isPeriodElapsed", [asset._address]);
            expect(isPeriodElapsed).toEqual(true);

            period = '1200';
            let tx11 = await send(uniswapPriceOracle, '_setPeriod', [period]);

            isPeriodElapsed = await call(uniswapPriceOracle, "isPeriodElapsed", [asset._address]);
            expect(isPeriodElapsed).toEqual(false);

            await send(mockUniswapPool, 'setBlockTimeStampLast', [+blockTimeStampLast+(+period)+1]);

            isPeriodElapsed = await call(uniswapPriceOracle, "isPeriodElapsed", [asset._address]);
            expect(isPeriodElapsed).toEqual(true);

            period = '100';
            let tx12 = await send(uniswapPriceOracle, '_setPeriod', [period]);

            isPeriodElapsed = await call(uniswapPriceOracle, "isPeriodElapsed", [asset._address]);
            expect(isPeriodElapsed).toEqual(true);

            await send(mockUniswapPool, 'setBlockTimeStampLast', [+blockTimeStampLast+(+period)+2]);

            isPeriodElapsed = await call(uniswapPriceOracle, "isPeriodElapsed", [asset._address]);
            expect(isPeriodElapsed).toEqual(true);
        });
    });

    describe("check eth course function function and internal data", () => {
        let usdc, usdt, dai, newAsset;
        let newMockUniswapPool1, newMockUniswapPool2, newMockUniswapPool3;
        let newMockUniswapFactory1, newMockUniswapFactory2, newMockUniswapFactory3;
        let newMockUniswapPoolDAI, newMockUniswapPoolUSDT, newMockUniswapPoolUSDC;

        beforeEach(async () => {
            usdc = await makeToken({decimals: '6', name: 'erc20 usdc', symbol: 'usdc'});
            usdt = await makeToken({decimals: '6', name: 'erc20 usdt', symbol: 'usdt'});
            dai = await makeToken({decimals: '18', name: 'erc20 dai', symbol: 'dai'});
            newAsset = await makeToken();

            let decimals = await call(usdc, "decimals");
            expect(decimals).toEqual('6');
            decimals = await call(usdt, "decimals");
            expect(decimals).toEqual('6');
            decimals = await call(dai, "decimals");
            expect(decimals).toEqual('18');
            decimals = await call(newAsset, "decimals");
            expect(decimals).toEqual('18');

            newMockUniswapFactory1 = await deploy('MockUniswapFactoryV2');
            newMockUniswapPoolDAI = await deploy('MockUniswapPool');
            newMockUniswapPoolUSDT = await deploy('MockUniswapPool');
            newMockUniswapPoolUSDC = await deploy('MockUniswapPool');

            // real data (blockTimeStamp 1617976989)
            await send(newMockUniswapPoolUSDT, 'setData', [
                WETHToken._address,
                usdt._address,
                '69300414106281610056486',
                '144136978589498',
                '108440522331595154328745452759693',
                '328889143286590183358706488927451804772319811247343'
            ]);

            // real data (blockTimeStamp 1617977088)
            await send(newMockUniswapPoolDAI, 'setData', [
                WETHToken._address,
                dai._address,
                '29081378201996628687365',
                '60423815286154060995479625',
                '108504765323811843166591297400758083311906011',
                '343245678014664626911483647466477553703'
            ]);

            // real data (blockTimeStamp 1617977100)
            await send(newMockUniswapPoolUSDC, 'setData', [
                WETHToken._address,
                usdc._address,
                '67750901312389818218470',
                '140711590148267',
                '109613359197447592748722255800848',
                '359749687769618128771704981052957704836749272276592'
            ]);

            let txDai = await send(newMockUniswapFactory1, 'addPair', [WETHToken._address, dai._address, newMockUniswapPoolDAI._address]);
            let txUSDT = await send(newMockUniswapFactory1, 'addPair', [WETHToken._address, usdt._address, newMockUniswapPoolUSDT._address]);
            let txUSDC = await send(newMockUniswapFactory1, 'addPair', [WETHToken._address, usdc._address, newMockUniswapPoolUSDC._address]);

            let result = await send(uniswapPriceOracle, '_updatePool', [
                '0',
                newMockUniswapFactory1._address
            ]);

            let priceAverage = await call(uniswapPriceOracle, "getCourseInETH", [usdt._address]);
            expect(priceAverage).toEqual('0');

            priceAverage = await call(uniswapPriceOracle, "getCourseInETH", [dai._address]);
            expect(priceAverage).toEqual('0');

            priceAverage = await call(uniswapPriceOracle, "getCourseInETH", [usdc._address]);
            expect(priceAverage).toEqual('0');

            expect(
                await send(uniswapPriceOracle, 'update', [usdt._address])
            ).toHaveLog("PriceUpdated", {
                asset: usdt._address,
                price: "480795523705607", // Price in ETH with 18 decimals of precision
            });

            expect(
                await send(uniswapPriceOracle, 'update', [dai._address])
            ).toHaveLog("PriceUpdated", {
                asset: dai._address,
                price: "481290002365351", // Price in ETH with 18 decimals of precision
            });

            expect(
                await send(uniswapPriceOracle, 'update', [usdc._address])
            ).toHaveLog("PriceUpdated", {
                asset: usdc._address,
                price: "481487710010249", // Price in ETH with 18 decimals of precision
            });

            newMockUniswapFactory2 = await deploy('MockUniswapFactoryV2');
            newMockUniswapPool1 = await deploy('MockUniswapPool');
            newMockUniswapPool2 = await deploy('MockUniswapPool');

            await send(newMockUniswapPool1, 'setData', [
                newAsset._address,
                usdt._address,
                '1',
                '1',
                '0',
                '0'
            ]);

            await send(newMockUniswapPool2, 'setData', [
                newAsset._address,
                dai._address,
                '1',
                '1',
                '0',
                '0'
            ]);

            let tx3 = await send(newMockUniswapFactory2, 'addPair', [newAsset._address, usdt._address, newMockUniswapPool1._address]);
            let tx4 = await send(newMockUniswapFactory2, 'addPair', [newAsset._address, dai._address, newMockUniswapPool2._address]);

            newMockUniswapFactory3 = await deploy('MockUniswapFactoryV2');
            newMockUniswapPool3 = await deploy('MockUniswapPool');

            await send(newMockUniswapPool3, 'setData', [
                newAsset._address,
                usdc._address,
                '1',
                '1',
                '0',
                '0'
            ]);

            let tx5 = await send(newMockUniswapFactory3, 'addPair', [newAsset._address, usdc._address, newMockUniswapPool3._address]);

            await send(uniswapPriceOracle, '_addPool', [newMockUniswapFactory2._address]);
            await send(uniswapPriceOracle, '_addPool', [newMockUniswapFactory3._address]);

            await send(uniswapPriceOracle, '_addStableCoin', [usdt._address]);
            await send(uniswapPriceOracle, '_addStableCoin', [dai._address]);
            await send(uniswapPriceOracle, '_addStableCoin', [usdc._address]);
        });

        it("check init data", async () => {
            let priceAverage = await call(uniswapPriceOracle, "getCourseInETH", [usdt._address]);
            let calcPriceAverage = await call(uniswapPriceOracle, "calcCourseInETH", [usdt._address]);
            expect(priceAverage).toEqual('480795523705607'); // 1 eth = 2079,88 usdt
            expect(calcPriceAverage).toEqual('480795523705607');

            priceAverage = await call(uniswapPriceOracle, "getCourseInETH", [dai._address]);
            calcPriceAverage = await call(uniswapPriceOracle, "calcCourseInETH", [dai._address]);
            expect(priceAverage).toEqual('481290002365351'); // 1 eth = 2077,75 dai
            expect(calcPriceAverage).toEqual('481290002365351');

            priceAverage = await call(uniswapPriceOracle, "getCourseInETH", [usdc._address]);
            calcPriceAverage = await call(uniswapPriceOracle, "calcCourseInETH", [usdc._address]);
            expect(priceAverage).toEqual('481487710010249'); // 1 eth = 2076,90 usdc
            expect(calcPriceAverage).toEqual('481487710010249');

            let poolFactories = await call(uniswapPriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([newMockUniswapFactory1._address, newMockUniswapFactory2._address, newMockUniswapFactory3._address]);

            let pairs = await call(newMockUniswapFactory1, "getAllPairs");
            expect(pairs).toEqual([newMockUniswapPoolDAI._address, newMockUniswapPoolUSDT._address, newMockUniswapPoolUSDC._address]);

            pairs = await call(newMockUniswapFactory2, "getAllPairs");
            expect(pairs).toEqual([newMockUniswapPool1._address, newMockUniswapPool2._address]);

            pairs = await call(newMockUniswapFactory3, "getAllPairs");
            expect(pairs).toEqual([newMockUniswapPool3._address]);

            let pairNEWUSDT = await call(newMockUniswapFactory2, 'getPair', [newAsset._address, usdt._address]);
            let pairNEWDAI = await call(newMockUniswapFactory2, 'getPair', [newAsset._address, dai._address]);
            let pairNEWUSDC = await call(newMockUniswapFactory3, 'getPair', [newAsset._address, usdc._address]);
            expect(pairNEWUSDT).toEqual(newMockUniswapPool1._address);
            expect(pairNEWDAI).toEqual(newMockUniswapPool2._address);
            expect(pairNEWUSDC).toEqual(newMockUniswapPool3._address);

            let stableCoins = await call(uniswapPriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([usdt._address, dai._address, usdc._address]);

            let searchPairUSDC = await call(uniswapPriceOracle, "searchPair", [usdc._address]);
            expect(searchPairUSDC[0]).toEqual(newMockUniswapPoolUSDC._address);
            expect(searchPairUSDC[1]).toEqual('67750901312389818218470');
            let searchPairNew = await call(uniswapPriceOracle, "searchPair", [newAsset._address]);
            expect(searchPairNew[0]).toEqual(newMockUniswapPool3._address);
            expect(searchPairNew[1]).toEqual('481487710');

            let getPoolPairWithStableCoin1 = await call(uniswapPriceOracle, "getPoolPairWithStableCoin", [newAsset._address, '0', '0']);
            expect(getPoolPairWithStableCoin1).toEqual(constants.ZERO_ADDRESS);
            let getPoolPairWithStableCoin2 = await call(uniswapPriceOracle, "getPoolPairWithStableCoin", [newAsset._address, '0', '1']);
            expect(getPoolPairWithStableCoin2).toEqual(constants.ZERO_ADDRESS);
            let getPoolPairWithStableCoin3 = await call(uniswapPriceOracle, "getPoolPairWithStableCoin", [newAsset._address, '0', '2']);
            expect(getPoolPairWithStableCoin3).toEqual(constants.ZERO_ADDRESS);
            getPoolPairWithStableCoin1 = await call(uniswapPriceOracle, "getPoolPairWithStableCoin", [newAsset._address, '1', '0']);
            expect(getPoolPairWithStableCoin1).toEqual(newMockUniswapPool1._address);
            getPoolPairWithStableCoin2 = await call(uniswapPriceOracle, "getPoolPairWithStableCoin", [newAsset._address, '1', '1']);
            expect(getPoolPairWithStableCoin2).toEqual(newMockUniswapPool2._address);
            getPoolPairWithStableCoin3 = await call(uniswapPriceOracle, "getPoolPairWithStableCoin", [newAsset._address, '1', '2']);
            expect(getPoolPairWithStableCoin3).toEqual(constants.ZERO_ADDRESS);
            getPoolPairWithStableCoin1 = await call(uniswapPriceOracle, "getPoolPairWithStableCoin", [newAsset._address, '2', '0']);
            expect(getPoolPairWithStableCoin1).toEqual(constants.ZERO_ADDRESS);
            getPoolPairWithStableCoin2 = await call(uniswapPriceOracle, "getPoolPairWithStableCoin", [newAsset._address, '2', '1']);
            expect(getPoolPairWithStableCoin2).toEqual(constants.ZERO_ADDRESS);
            getPoolPairWithStableCoin3 = await call(uniswapPriceOracle, "getPoolPairWithStableCoin", [newAsset._address, '2', '2']);
            expect(getPoolPairWithStableCoin3).toEqual(newMockUniswapPool3._address);

            expect(
                await send(uniswapPriceOracle, 'update', [newAsset._address])
            ).toHaveLog("PriceUpdated", {
                asset: newAsset._address,
                price: "481487710010249000000000000", // Get USDC pool, because reserve is max
            });

            priceAverage = await call(uniswapPriceOracle, "getCourseInETH", [newAsset._address]);
            calcPriceAverage = await call(uniswapPriceOracle, "calcCourseInETH", [newAsset._address]);
            expect(priceAverage).toEqual('481487710010249000000000000'); // 1 eth = 10e-12 asset
            expect(calcPriceAverage).toEqual('481487710010249000000000000');
        });

        it("check set max reserve to other pool #1", async () => {
            await send(newMockUniswapPool1, 'setData', [
                newAsset._address,
                usdt._address,
                '10',
                '10',
                '0',
                '0'
            ]);

            let pair = await call(uniswapPriceOracle, "searchPair", [newAsset._address]);

            expect(
                await send(uniswapPriceOracle, 'update', [newAsset._address])
            ).toHaveLog("PriceUpdated", {
                asset: newAsset._address,
                price: "480795523705607000000000000", // Get USDT pool
            });

            let assetPair = await call(uniswapPriceOracle, "assetPair", [newAsset._address]);
            expect(pair[0]).toEqual(assetPair);

            let priceAverage = await call(uniswapPriceOracle, "getCourseInETH", [newAsset._address]);
            let calcPriceAverage = await call(uniswapPriceOracle, "calcCourseInETH", [newAsset._address]);
            expect(priceAverage).toEqual('480795523705607000000000000');
            expect(calcPriceAverage).toEqual('480795523705607000000000000');
        });

        it("check set max reserve to other pool #2", async () => {
            await send(newMockUniswapPool2, 'setData', [
                newAsset._address,
                dai._address,
                '12000000000000000000',
                '12000000000000000000',
                '0',
                '0'
            ]);

            let pair = await call(uniswapPriceOracle, "searchPair", [newAsset._address]);

            expect(
                await send(uniswapPriceOracle, 'update', [newAsset._address])
            ).toHaveLog("PriceUpdated", {
                asset: newAsset._address,
                price: "481290002365351", // Get DAI pool, because 1 DAI = 1 Asset
            });

            let assetPair = await call(uniswapPriceOracle, "assetPair", [newAsset._address]);
            expect(pair[0]).toEqual(assetPair);

            let priceAverage = await call(uniswapPriceOracle, "getCourseInETH", [newAsset._address]);
            let calcPriceAverage = await call(uniswapPriceOracle, "calcCourseInETH", [newAsset._address]);
            expect(priceAverage).toEqual('481290002365351');
            expect(calcPriceAverage).toEqual('481290002365351');
        });

        it("check update asset pair function", async () => {
            await send(newMockUniswapPool2, 'setData', [
                newAsset._address,
                dai._address,
                '1000000000000000000',
                '1000000000000000000',
                '0',
                '0'
            ]);

            expect(
                await send(uniswapPriceOracle, 'update', [newAsset._address])
            ).toHaveLog("PriceUpdated", {
                asset: newAsset._address,
                price: "481290002365351", // Get DAI pool, because reserve is max and 1 DAI = 1 Asset
            });

            let priceAverage = await call(uniswapPriceOracle, "getCourseInETH", [newAsset._address]);
            let calcPriceAverage = await call(uniswapPriceOracle, "calcCourseInETH", [newAsset._address]);
            expect(priceAverage).toEqual('481290002365351');
            expect(calcPriceAverage).toEqual('481290002365351');

            let assetPairAddress = await call(uniswapPriceOracle, "assetPair", [newAsset._address]);
            expect(assetPairAddress).toEqual(newMockUniswapPool2._address);

            expect(
                await send(uniswapPriceOracle, '_updateAssetPair', [newAsset._address, newMockUniswapPool1._address])
            ).toHaveLog("PriceUpdated", {
                asset: newAsset._address,
                price: "480795523705607000000000000",
            });

            priceAverage = await call(uniswapPriceOracle, "getCourseInETH", [newAsset._address]);
            calcPriceAverage = await call(uniswapPriceOracle, "calcCourseInETH", [newAsset._address]);
            expect(priceAverage).toEqual('480795523705607000000000000');
            expect(calcPriceAverage).toEqual('480795523705607000000000000');

            assetPairAddress = await call(uniswapPriceOracle, "assetPair", [newAsset._address]);
            expect(assetPairAddress).toEqual(newMockUniswapPool1._address);

            expect(
                await send(uniswapPriceOracle, '_updateAssetPair', [newAsset._address, newMockUniswapPool2._address])
            ).toHaveLog("PriceUpdated", {
                asset: newAsset._address,
                price: "481290002365351",
            });

            priceAverage = await call(uniswapPriceOracle, "getCourseInETH", [newAsset._address]);
            calcPriceAverage = await call(uniswapPriceOracle, "calcCourseInETH", [newAsset._address]);
            expect(priceAverage).toEqual('481290002365351');
            expect(calcPriceAverage).toEqual('481290002365351');
        });
    });

    describe("check update asset pair and update functions", () => {
        it("Scenario #1", async () => {
            let uniswapFactory1, uniswapFactory2;
            let token, pair, stableCoin, stableCoinPair, tokenPairWithStableCoin;
            let newStableCoin, newStableCoinPair, tokenPairWithNewStableCoin;
            let result;

            // update pool factory #1
            uniswapFactory1 = await deploy('MockUniswapFactoryV2');
            await send(uniswapPriceOracle, '_updatePool', ['0', uniswapFactory1._address]);

            token = await makeToken();
            pair = await deploy('MockUniswapPool');

            // set data for pair token/weth blockNum = 1620830269
            await send(pair, 'setData', [
                token._address,
                WETHToken._address,
                '3200453951518500377201',
                '5986968320714262762',
                '97189642073183344603898702060815562147',
                '158411678190145581733560284253272069369726219'
            ]);

            let block = await saddle.web3.eth.getBlock("latest");
            await send(pair, 'setBlockTimeStampLast', [block.timestamp]);

            // add pair token/weth to factory1
            result = await send(uniswapFactory1, 'addPair', [token._address, WETHToken._address, pair._address]);
            expect(result).toSucceed();

            // update token price
            expect(
                await send(uniswapPriceOracle, 'update', [token._address])
            ).toHaveLog("PriceUpdated", {
                asset: token._address,
                price: "1870662228360967",
            });

            // update token price - fail (period is not elapsed)
            expect(
                await send(uniswapPriceOracle, 'update', [token._address])
            ).toHaveLog("Failure", {
                error : '3',
                info : '3',
                detail: '0'
            });

            // update data after exchange, blockNum = 1620831035
            await send(pair, 'setData', [
                token._address,
                WETHToken._address,
                '3296296414681264764946',
                '5814520211535737519',
                '97197419496654674100341896958877166305',
                '158413714095432065007168765185449667023533369'
            ]);

            await send(pair, 'setBlockTimeStampLast', [+block.timestamp + +766]);

            // update token price
            expect(
                await send(uniswapPriceOracle, 'update', [token._address])
            ).toHaveLog("PriceUpdated", {
                asset: token._address,
                price: "1955453362090548",
            });

            // create factory #2
            uniswapFactory2 = await deploy('MockUniswapFactoryV2');
            await send(uniswapPriceOracle, '_addPool', [uniswapFactory2._address]);

            stableCoin = await makeToken({decimals: 6});

            result = await send(uniswapPriceOracle, '_addStableCoin', [stableCoin._address]);
            expect(result).toSucceed();

            stableCoinPair = await deploy('MockUniswapPool');

            // blockNum = 1620831787
            await send(stableCoinPair, 'setData', [
                stableCoin._address,
                WETHToken._address,
                '1389172342',
                '985709589405201852',
                '86959949381263362941375513048211795991834430311284',
                '42318694728760009819363145376735'
            ]);

            await send(stableCoinPair, 'setBlockTimeStampLast', [+block.timestamp + +1518]);

            result = await send(uniswapFactory2, 'addPair', [stableCoin._address, WETHToken._address, stableCoinPair._address]);
            expect(result).toSucceed();

            // update stableCoin
            expect(
                await send(uniswapPriceOracle, 'update', [stableCoin._address])
            ).toHaveLog("PriceUpdated", {
                asset: stableCoin._address,
                price: "709566091696059",
            });

            tokenPairWithStableCoin = await deploy('MockUniswapPool');

            //1620832537
            await send(tokenPairWithStableCoin, 'setData', [
                stableCoin._address,
                token._address,
                '19990040975',
                '20010000000000000000000',
                '10367200244938039158304616014833899303094536316425158',
                '10369120116204375423463754816'
            ]);

            await send(tokenPairWithStableCoin, 'setBlockTimeStampLast', [+block.timestamp + +2268]);

            result = await send(uniswapFactory2, 'addPair', [stableCoin._address, token._address, tokenPairWithStableCoin._address]);
            expect(result).toSucceed();

            expect(
                await send(uniswapPriceOracle, '_updateAssetPair', [token._address, tokenPairWithStableCoin._address])
            ).toHaveLog("PriceUpdated", {
                asset: token._address,
                price: "708857944736546",
            });

            // 1620833317
            await send(tokenPairWithStableCoin, 'setData', [
                stableCoin._address,
                token._address,
                '19979128823',
                '20021028069471583719021',
                '10371253672607546489265318475226459474703645781754488',
                '10373166675047543831677033226'
            ]);

            await send(tokenPairWithStableCoin, 'setBlockTimeStampLast', [+block.timestamp + +3048]);

            // update token price
            expect(
                await send(uniswapPriceOracle, 'update', [token._address])
            ).toHaveLog("PriceUpdated", {
                asset: token._address,
                price: "708964379650300",
            });

            // 1620834909
            await send(tokenPairWithStableCoin, 'setData', [
                stableCoin._address,
                token._address,
                '19988128823',
                '20012040290565467654552',
                '10379532855873706742292129643566836214345765762692262',
                '10381419786671187797902410820'
            ]);

            await send(tokenPairWithStableCoin, 'setBlockTimeStampLast', [+block.timestamp + +4640]);

            // update token price
            expect(
                await send(uniswapPriceOracle, 'update', [token._address])
            ).toHaveLog("PriceUpdated", {
                asset: token._address,
                price: "708447815535546",
            });

            // stable coin with decimals 18, for example dai
            newStableCoin = await makeToken();

            result = await send(uniswapPriceOracle, '_addStableCoin', [newStableCoin._address]);
            expect(result).toSucceed();

            newStableCoinPair = await deploy('MockUniswapPool');

            // 1620844261
            await send(newStableCoinPair, 'setData', [
                newStableCoin._address,
                WETHToken._address,
                '395654223362380896939322',
                '390042396780364563108',
                '576325748080507366658034172093174217251',
                '3173288101183762920766198415356744113749177801'
            ]);

            block = await saddle.web3.eth.getBlock("latest");
            await send(newStableCoinPair, 'setBlockTimeStampLast', [block.timestamp]);

            result = await send(uniswapFactory2, 'addPair', [newStableCoin._address, WETHToken._address, newStableCoinPair._address]);
            expect(result).toSucceed();

            // update stableCoin
            expect(
                await send(uniswapPriceOracle, 'update', [newStableCoin._address])
            ).toHaveLog("PriceUpdated", {
                asset: newStableCoin._address,
                price: "985816335955356",
            });

            tokenPairWithNewStableCoin = await deploy('MockUniswapPool');

            // 1620845011
            await send(tokenPairWithNewStableCoin, 'setData', [
                newStableCoin._address,
                token._address,
                '1001000000000000000000',
                '499501996509480048392',
                '739902302341212937065595726913863680',
                '2959609209364851748262382907655454720'
            ]);

            block = await saddle.web3.eth.getBlock("latest");
            await send(tokenPairWithNewStableCoin, 'setBlockTimeStampLast', [block.timestamp]);

            result = await send(uniswapFactory2, 'addPair', [newStableCoin._address, token._address, tokenPairWithNewStableCoin._address]);
            expect(result).toSucceed();

            expect(
                await send(uniswapPriceOracle, '_updateAssetPair', [token._address, tokenPairWithNewStableCoin._address])
            ).toHaveLog("PriceUpdated", {
                asset: token._address,
                price: "1975571988074291",
            });

            // 1620848689
            await send(tokenPairWithNewStableCoin, 'setData', [
                newStableCoin._address,
                token._address,
                '1005000000000000000000',
                '497519878257971676049',
                '10216880918550970409764581981790046991',
                '41443006793624622872994391134794575218'
            ]);

            await send(tokenPairWithNewStableCoin, 'setBlockTimeStampLast', [+block.timestamp + +3678]);

            // update token price
            expect(
                await send(uniswapPriceOracle, 'update', [token._address])
            ).toHaveLog("PriceUpdated", {
                asset: token._address,
                price: "1986543955301333",
            });

            // 1620849335
            await send(tokenPairWithNewStableCoin, 'setData', [
                newStableCoin._address,
                token._address,
                '334560607003819573085',
                '1497519878257971676049',
                '11877371467810296340580462455670417763',
                '48218605190355725276567529175325988594'
            ]);

            await send(tokenPairWithNewStableCoin, 'setBlockTimeStampLast', [+block.timestamp + +4324]);

            // update token price
            expect(
                await send(uniswapPriceOracle, 'update', [token._address])
            ).toHaveLog("PriceUpdated", {
                asset: token._address,
                price: "1991368507936111",
            });
        });
    });

    describe("update asset pair to new asset pair", () => {
        let usdc, usdt, dai, newAsset;
        let newMockUniswapPool1, newMockUniswapPool2, newMockUniswapPool3;
        let newMockUniswapFactory1, newMockUniswapFactory2;
        let newMockUniswapPoolDAI, newMockUniswapPoolUSDT, newMockUniswapPoolUSDC;

        beforeEach(async () => {
            usdc = await makeToken({decimals: '6', name: 'erc20 usdc', symbol: 'usdc'});
            usdt = await makeToken({decimals: '6', name: 'erc20 usdt', symbol: 'usdt'});
            dai = await makeToken({decimals: '18', name: 'erc20 dai', symbol: 'dai'});
            newAsset = await makeToken();

            let decimals = await call(usdc, "decimals");
            expect(decimals).toEqual('6');
            decimals = await call(usdt, "decimals");
            expect(decimals).toEqual('6');
            decimals = await call(dai, "decimals");
            expect(decimals).toEqual('18');
            decimals = await call(newAsset, "decimals");
            expect(decimals).toEqual('18');

            newMockUniswapFactory1 = await deploy('MockUniswapFactoryV2');
            newMockUniswapPoolDAI = await deploy('MockUniswapPool');
            newMockUniswapPoolUSDT = await deploy('MockUniswapPool');
            newMockUniswapPoolUSDC = await deploy('MockUniswapPool');

            // real data (blockTimeStamp 1617976989)
            await send(newMockUniswapPoolUSDT, 'setData', [
                WETHToken._address,
                usdt._address,
                '69300414106281610056486',
                '144136978589498',
                '108440522331595154328745452759693',
                '328889143286590183358706488927451804772319811247343'
            ]);

            // real data (blockTimeStamp 1617977088)
            await send(newMockUniswapPoolDAI, 'setData', [
                WETHToken._address,
                dai._address,
                '29081378201996628687365',
                '60423815286154060995479625',
                '108504765323811843166591297400758083311906011',
                '343245678014664626911483647466477553703'
            ]);

            // real data (blockTimeStamp 1617977100)
            await send(newMockUniswapPoolUSDC, 'setData', [
                WETHToken._address,
                usdc._address,
                '67750901312389818218470',
                '140711590148267',
                '109613359197447592748722255800848',
                '359749687769618128771704981052957704836749272276592'
            ]);

            let txDai = await send(newMockUniswapFactory1, 'addPair', [WETHToken._address, dai._address, newMockUniswapPoolDAI._address]);
            let txUSDT = await send(newMockUniswapFactory1, 'addPair', [WETHToken._address, usdt._address, newMockUniswapPoolUSDT._address]);
            let txUSDC = await send(newMockUniswapFactory1, 'addPair', [WETHToken._address, usdc._address, newMockUniswapPoolUSDC._address]);

            let result = await send(uniswapPriceOracle, '_updatePool', [
                '0',
                newMockUniswapFactory1._address
            ]);

            expect(
                await send(uniswapPriceOracle, 'update', [usdt._address])
            ).toHaveLog("PriceUpdated", {
                asset: usdt._address,
                price: "480795523705607", // Price in ETH with 18 decimals of precision
            });

            expect(
                await send(uniswapPriceOracle, 'update', [dai._address])
            ).toHaveLog("PriceUpdated", {
                asset: dai._address,
                price: "481290002365351", // Price in ETH with 18 decimals of precision
            });

            expect(
                await send(uniswapPriceOracle, 'update', [usdc._address])
            ).toHaveLog("PriceUpdated", {
                asset: usdc._address,
                price: "481487710010249", // Price in ETH with 18 decimals of precision
            });

            newMockUniswapFactory2 = await deploy('MockUniswapFactoryV2');
            newMockUniswapPool1 = await deploy('MockUniswapPool');
            newMockUniswapPool2 = await deploy('MockUniswapPool');
            newMockUniswapPool3 = await deploy('MockUniswapPool');

            await send(newMockUniswapPool1, 'setData', [
                newAsset._address,
                usdt._address,
                '1000000000000000000',
                '1000000',
                '0',
                '0'
            ]);

            await send(newMockUniswapPool2, 'setData', [
                newAsset._address,
                dai._address,
                '1000000000000000000',
                '1000000000000000000',
                '0',
                '0'
            ]);

            await send(newMockUniswapPool3, 'setData', [
                newAsset._address,
                usdc._address,
                '1000000000000000000',
                '1000000',
                '0',
                '0'
            ]);

            let tx3 = await send(newMockUniswapFactory2, 'addPair', [newAsset._address, usdt._address, newMockUniswapPool1._address]);
            let tx4 = await send(newMockUniswapFactory2, 'addPair', [newAsset._address, dai._address, newMockUniswapPool2._address]);
            let tx5 = await send(newMockUniswapFactory2, 'addPair', [newAsset._address, usdc._address, newMockUniswapPool3._address]);

            await send(uniswapPriceOracle, '_addPool', [newMockUniswapFactory2._address]);

            await send(uniswapPriceOracle, '_addStableCoin', [usdt._address]);
            await send(uniswapPriceOracle, '_addStableCoin', [dai._address]);
            await send(uniswapPriceOracle, '_addStableCoin', [usdc._address]);

            let tx = await send(uniswapPriceOracle, '_setMinReserveLiquidity', [
                '1',
            ]);
        });

        it("remove liquidity for pair", async () => {
            // update asset (set #1 pair)
            expect(
                await send(uniswapPriceOracle, 'update', [newAsset._address])
            ).toHaveLog("PriceUpdated", {
                asset: newAsset._address,
                price: "481487228522538", // Get USDC pool, because reserve is max
            });

            // remove liquidity from pair usdc/new asset
            await send(newMockUniswapPool3, 'setData', [
                newAsset._address,
                usdc._address,
                '0',
                '0',
                '0',
                '0'
            ]);

            // update asset (search new pair and set pair dai/new asset)
            expect(
                await send(uniswapPriceOracle, 'update', [newAsset._address])
            ).toHaveLog("PriceUpdated", {
                asset: newAsset._address,
                price: "481290002365351", // Get DAI pool, because reserve is max
            });

            // remove liquidity from #2 pair
            await send(newMockUniswapPool2, 'setData', [
                newAsset._address,
                dai._address,
                '0',
                '0',
                '0',
                '0'
            ]);

            // update asset (search new pair and set pair usdt/new asset)
            expect(
                await send(uniswapPriceOracle, 'update', [newAsset._address])
            ).toHaveLog("PriceUpdated", {
                asset: newAsset._address,
                price: "480795042910083", // Get USDT pool, because reserve is max
            });

            // add liquidity to #1 and #2 pair
            await send(newMockUniswapPool2, 'setData', [
                newAsset._address,
                dai._address,
                '1000000000000000000',
                '1000000000000000000',
                '0',
                '0'
            ]);

            await send(newMockUniswapPool3, 'setData', [
                newAsset._address,
                usdc._address,
                '1000000000000000000',
                '1000000',
                '0',
                '0'
            ]);

            // update asset, check pair - fail (period is not elapsed)
            expect(
                await send(uniswapPriceOracle, 'update', [newAsset._address])
            ).toHaveLog("Failure", {
                error : '3',
                info : '3',
                detail: '0'
            });

        });
    });
});