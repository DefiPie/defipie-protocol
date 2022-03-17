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

describe('UniswapV2PriceOracle', () => {
    let root, admin, accounts;
    let uniswapV2PriceOracle, mockPriceFeed, registryProxy;
    let mockUniswapV2Factory, mockUniswapV2Pool, WETHToken, asset;
    let priceETH = '400';

    beforeEach(async () => {
        [root, admin, ...accounts] = saddle.accounts;

        registryProxy = await makeRegistryProxy();

        mockPriceFeed = await deploy('MockPriceFeed');
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

        let tx3 = await send(uniswapV2PriceOracle, '_setRegistry', [registryProxy._address]);

        await send(mockUniswapV2Pool, 'setData', [
            asset._address,
            WETHToken._address,
            '185850109323804242560637514',
            '517682812260927681611929',
            '222207120848530231902067171756422825567',
            '18388112711916799881959720317173237214852815'
        ]);

        let cumulativePrice = await call(uniswapV2PriceOracle, "cumulativePrices", [mockUniswapV2Factory._address, asset._address]);
        expect('0').toEqual(cumulativePrice.priceCumulativePrevious);
        expect('0').toEqual(cumulativePrice.blockTimeStampPrevious);
        expect('0').toEqual(cumulativePrice.priceAverage[0]);

        let block = await saddle.web3.eth.getBlock("latest");
        await send(mockUniswapV2Pool, 'setBlockTimeStampLast', [block.timestamp]);

        expect(
            await send(uniswapV2PriceOracle, 'update', [asset._address])
        ).toHaveLog("PriceUpdated", {
            asset: asset._address,
            price: "2785485648324132", // Price in ETH with 18 decimals of precision
        });

        let assetInUSD = new BigNumber('1114194259329652800'); // 1,11$ with 18 decimals of precision
        let assetPriceInETH = await call(uniswapV2PriceOracle, "getCourseInETH", [asset._address]);
        let assetPriceInUSD = (new BigNumber(priceETH)).multipliedBy(assetPriceInETH);
        expect(assetPriceInUSD).toEqual(assetInUSD);
    });

    describe("check update function", () => {
        it("Check update function", async () => {
            let pairAddress = await call(uniswapV2PriceOracle, "assetPair", [asset._address]);
            let data = await call(uniswapV2PriceOracle, "cumulativePrices", [pairAddress, asset._address]);
            let period = await call(uniswapV2PriceOracle, "period");
            let timestamp = +data.blockTimeStampPrevious + +period +1;

            mine(timestamp);

            await send(mockUniswapV2Pool, 'setData', [
                asset._address,
                WETHToken._address,
                '185833232609097660547126583',
                '518393146531750468783635',
                '222215615064106418572107375213052053317',
                '18389206346193927773189674665585517662154410'
            ]);

            await send(mockUniswapV2Pool, 'setBlockTimeStampLast', [timestamp]);

            expect(
                await send(uniswapV2PriceOracle, 'update', [asset._address])
            ).toHaveLog("PriceUpdated", {
                asset: asset._address,
                price: "2722007343137834", // Price in ETH with 18 decimals of precision
            });

            let assetInUSD = new BigNumber('1088802937255133600'); // 1,08$ with 18 decimals of precision
            let assetPriceInETH = await call(uniswapV2PriceOracle, "getCourseInETH", [asset._address]);
            let assetPriceInUSD = (new BigNumber(priceETH)).multipliedBy(assetPriceInETH);
            expect(assetPriceInUSD).toEqual(assetInUSD);
        });

        it("Call update function two times", async () => {
            let block = await saddle.web3.eth.getBlock("latest");
            let period = await call(uniswapV2PriceOracle, "period");

            let timestamp = +block.timestamp + +period;
            mine(timestamp);

            await send(uniswapV2PriceOracle, 'update', [asset._address]);

            let result = await send(uniswapV2PriceOracle, 'update', [asset._address]);
            expect(result).toHaveOracleFailure('UPDATE_PRICE', 'PERIOD_NOT_ELAPSED');
        });

        it("New pool", async () => {
            let newAsset = await makeToken();

            let newMockUniswapV2Factory = await deploy('MockUniswapV2Factory');
            let newMockUniswapV2Pool = await deploy('MockUniswapV2Pool');
            let tx1 = await send(newMockUniswapV2Factory, 'setPair', [newMockUniswapV2Pool._address]);
            let tx2 = await send(newMockUniswapV2Factory, 'setPairExist', [true]);

            uniswapV2PriceOracle = await deploy('UniswapV2PriceOracleHarness', [
                newMockUniswapV2Factory._address,
                WETHToken._address
            ]);

            let tx3 = await send(uniswapV2PriceOracle, '_setRegistry', [registryProxy._address]);

            await send(newMockUniswapV2Pool, 'setData', [
                newAsset._address,
                WETHToken._address,
                '5050000000000000000000000000000000',
                '101000000000000000',
                '0',
                '0'
            ]);

            let block = await saddle.web3.eth.getBlock("latest");
            await send(newMockUniswapV2Pool, 'setBlockTimeStampLast', [block.timestamp]);

            let cumulativePrice = await call(uniswapV2PriceOracle, "cumulativePrices", [newMockUniswapV2Factory._address, newAsset._address]);
            expect('0').toEqual(cumulativePrice.priceCumulativePrevious);
            expect('0').toEqual(cumulativePrice.blockTimeStampPrevious);
            expect('0').toEqual(cumulativePrice.priceAverage[0]);

            await send(uniswapV2PriceOracle, 'update', [newAsset._address]);

            let newTimestamp = +block.timestamp+10;
            mine(newTimestamp);

            await send(newMockUniswapV2Pool, 'setData', [
                newAsset._address,
                WETHToken._address,
                '5050000000000000000000000000000000',
                '101000000000000000',
                '20353803685456524192',
                '50884509213641310759598864026356940800000000000000000'
            ]);

            await send(newMockUniswapV2Pool, 'setBlockTimeStampLast', [newTimestamp]);

            let otherInEth = new BigNumber('19'); // 1 eth = 5х10**16
            await send(uniswapV2PriceOracle, 'update', [newAsset._address]);

            let otherPriceInEth = await call(uniswapV2PriceOracle, "getCourseInETH", [newAsset._address]);
            expect(otherPriceInEth).toEqual(otherInEth.valueOf());
        });
    });

    describe("constructor", () => {
        it("gets address of registry", async () => {
            let registryProxyAddress = await call(uniswapV2PriceOracle, "registry");
            expect(registryProxyAddress).toEqual(registryProxy._address);
        });

        it("gets address of first pool factory", async () => {
            let uniswapFactory = await call(uniswapV2PriceOracle, "poolFactories", [0]);
            expect(uniswapFactory).toEqual(mockUniswapV2Factory._address);
        });

        it("gets address of WETH Token", async () => {
            let WETHToken_ = await call(uniswapV2PriceOracle, "WETHToken");
            expect(WETHToken_).toEqual(WETHToken._address);
        });
    });

    describe("check getCourseToETH function", () => {
        it("Returns course to ETH for ETH", async () => {
            let pEth = await makePToken({
                kind: "pether",
                controllerOpts: {kind: "bool"},
                supportMarket: true,
                registryProxy: registryProxy,
                mockPriceFeed: mockPriceFeed,
                mockUniswapV2Factory: mockUniswapV2Factory,
                mockUniswapV2Pool: mockUniswapV2Pool,
                WETHToken: WETHToken
            });

            let ethInEth = new BigNumber(1e18); // 1 eth = 1 eth
            let ethPriceInEth = await call(uniswapV2PriceOracle, "getCourseInETH", [pEth._address]);

            expect(ethPriceInEth).toEqual(ethInEth.valueOf());
        });

        it("Returns course to ETH for Other", async () => {
            let otherInEth = new BigNumber('2785485648324132'); // 1 eth = 359,003824199 other

            let otherPriceInEth = await call(uniswapV2PriceOracle, "getCourseInETH", [asset._address]);
            expect(otherPriceInEth).toEqual(otherInEth.valueOf());
        });
    });

    describe("check init function", () => {
        it("Check initialized once", async () => {
            let testOracle = await deploy('UniswapV2PriceOracle');
            await send(testOracle, 'initialize', [
                mockUniswapV2Factory._address,
                WETHToken._address
            ]);

            await expect(
                send(testOracle, 'initialize', [
                    mockUniswapV2Factory._address,
                    WETHToken._address
                ])
            ).rejects.toRevert('revert Oracle: may only be initialized once');
        });

        it('Invalid addresses for factory', async () => {
            let testOracle = await deploy('UniswapV2PriceOracle');

            await expect(
                send(testOracle, 'initialize', [
                    constants.ZERO_ADDRESS,
                    WETHToken._address
                ]),
            ).rejects.toRevert('revert Oracle: invalid address for factory');
        });

        it('Check event', async () => {
            let testOracle = await deploy('UniswapV2PriceOracle');

            let result = await send(testOracle, 'initialize', [
                mockUniswapV2Factory._address,
                WETHToken._address
            ]);

            expect(result).toHaveLog('PoolAdded', {
                id: '0',
                poolFactory: mockUniswapV2Factory._address
            });
        });

        it('Check init data ', async () => {
            let testOracle = await deploy('UniswapV2PriceOracleHarness', [
                mockUniswapV2Factory._address,
                WETHToken._address
            ]);

            let factory = await call(testOracle, "poolFactories", [0]);
            expect(factory).toEqual(mockUniswapV2Factory._address);

            let seconds = '600';

            let period = await call(testOracle, "period");
            expect(period).toEqual(seconds);
        });
    });

    describe("check _setNewWETHAddress function", () => {
        it("Check set new addresses", async () => {
            let tx = await send(uniswapV2PriceOracle, '_setNewWETHAddress', [
                mockUniswapV2Factory._address
            ]);

            let WETHToken = await call(uniswapV2PriceOracle, "WETHToken");
            expect(WETHToken).toEqual(mockUniswapV2Factory._address);
        });

        it("set new addresses values, not UNAUTHORIZED", async () => {
            let result = await send(uniswapV2PriceOracle, '_setNewWETHAddress', [
                mockUniswapV2Factory._address,
            ], {from: accounts[2]});

            expect(result).toHaveOracleFailure('UNAUTHORIZED', 'UPDATE_DATA');
        });
    });

    describe("check _setNewRegistry function", () => {
        it("Check set new registry address", async () => {
            let tx = await send(uniswapV2PriceOracle, '_setNewRegistry', [
                accounts[2],
            ]);

            let registry = await call(uniswapV2PriceOracle, "registry");
            expect(registry).toEqual(accounts[2]);
        });

        it("set new registry address, not UNAUTHORIZED", async () => {
            let result = await send(uniswapV2PriceOracle, '_setNewRegistry', [
                accounts[2],
            ], {from: accounts[2]});

            expect(result).toHaveOracleFailure('UNAUTHORIZED', 'UPDATE_DATA');
        });
    });

    describe("check add pool function", () => {
        it("add pool, not UNAUTHORIZED", async () => {
            let result = await send(uniswapV2PriceOracle, '_addPool', [
                mockUniswapV2Factory._address
            ], {from: accounts[2]});

            expect(result).toHaveOracleFailure('UNAUTHORIZED', 'ADD_POOL_OR_COIN');
        });

        it('add pool, invalid address for factory', async () => {
            await expect(
                send(uniswapV2PriceOracle, '_addPool', [
                    constants.ZERO_ADDRESS
                ]),
            ).rejects.toRevert('revert Oracle: invalid address for factory');
        });

        it("add pool, but pool exist", async () => {
            let result = await send(uniswapV2PriceOracle, '_addPool', [
                mockUniswapV2Factory._address
            ]);

            expect(result).toHaveOracleFailure('POOL_OR_COIN_EXIST', 'ADD_POOL_OR_COIN');
        });

        it("add pool twice", async () => {
            let newMockUniswapV2Factory = await deploy('MockUniswapV2Factory');

            let result = await send(uniswapV2PriceOracle, '_addPool', [
                newMockUniswapV2Factory._address
            ]);

            expect(result).toSucceed();

            result = await send(uniswapV2PriceOracle, '_addPool', [
                newMockUniswapV2Factory._address
            ]);

            expect(result).toHaveOracleFailure('POOL_OR_COIN_EXIST', 'ADD_POOL_OR_COIN');
        });

        it("add pool, check data", async () => {
            let poolFactories = await call(uniswapV2PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapV2Factory._address]);

            let newFactory1 = await deploy('MockUniswapV2Factory');

            let tx1 = await send(uniswapV2PriceOracle, '_addPool', [
                newFactory1._address
            ]);

            poolFactories = await call(uniswapV2PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapV2Factory._address, newFactory1._address]);

            let newFactory2 = await deploy('MockUniswapV2Factory');

            let tx2 = await send(uniswapV2PriceOracle, '_addPool', [
                newFactory2._address
            ]);

            poolFactories = await call(uniswapV2PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapV2Factory._address, newFactory1._address, newFactory2._address]);
        });

        it('add pool, check event', async () => {
            let newMockUniswapV2Factory = await deploy('MockUniswapV2Factory');

            let result = await send(uniswapV2PriceOracle, '_addPool', [
                newMockUniswapV2Factory._address
            ]);

            expect(result).toHaveLog('PoolAdded', {
                id: '1',
                poolFactory: newMockUniswapV2Factory._address
            });
        });
    });

    describe("check getPoolPair function", () => {
        it("check data", async () => {
            let newMockUniswapV2Factory1 = await deploy('MockUniswapV2Factory');
            let newMockUniswapV2Pool1 = await deploy('MockUniswapV2Pool');

            let tx1 = await send(newMockUniswapV2Factory1, 'setPair', [newMockUniswapV2Pool1._address]);
            let tx2 = await send(newMockUniswapV2Factory1, 'setPairExist', [true]);

            let newMockUniswapV2Factory2 = await deploy('MockUniswapV2Factory');
            let newMockUniswapV2Pool2 = await deploy('MockUniswapV2Pool');

            let tx3 = await send(newMockUniswapV2Factory2, 'setPair', [newMockUniswapV2Pool2._address]);
            let tx4 = await send(newMockUniswapV2Factory2, 'setPairExist', [true]);

            let pair1 = await call(mockUniswapV2Factory, "getPair", [WETHToken._address, asset._address]);
            expect(pair1).toEqual(mockUniswapV2Pool._address);
            let pair2 = await call(newMockUniswapV2Factory1, "getPair", [WETHToken._address, asset._address]);
            expect(pair2).toEqual(newMockUniswapV2Pool1._address);
            let pair3 = await call(newMockUniswapV2Factory2, "getPair", [WETHToken._address, asset._address]);
            expect(pair3).toEqual(newMockUniswapV2Pool2._address);

            let tx5 = await send(mockUniswapV2Factory, 'setPairExist', [false]);

            pair1 = await call(uniswapV2PriceOracle, "getPoolPair", [asset._address, '0']);
            expect(pair1).toEqual(constants.ZERO_ADDRESS);

            let tx51 = await send(uniswapV2PriceOracle, '_addPool', [newMockUniswapV2Factory1._address]);
            let tx52 = await send(uniswapV2PriceOracle, '_addPool', [newMockUniswapV2Factory2._address]);

            pair1 = await call(uniswapV2PriceOracle, "getPoolPair", [asset._address, '0']);
            expect(pair1).toEqual(constants.ZERO_ADDRESS);
            pair2 = await call(uniswapV2PriceOracle, "getPoolPair", [asset._address, '1']);
            expect(pair2).toEqual(newMockUniswapV2Pool1._address);
            pair3 = await call(uniswapV2PriceOracle, "getPoolPair", [asset._address, '2']);
            expect(pair3).toEqual(newMockUniswapV2Pool2._address);

            let tx6 = await send(newMockUniswapV2Factory2, 'setPairExist', [false]);

            pair1 = await call(uniswapV2PriceOracle, "getPoolPair", [asset._address, '0']);
            expect(pair1).toEqual(constants.ZERO_ADDRESS);
            pair2 = await call(uniswapV2PriceOracle, "getPoolPair", [asset._address, '1']);
            expect(pair2).toEqual(newMockUniswapV2Pool1._address);
            pair3 = await call(uniswapV2PriceOracle, "getPoolPair", [asset._address, '2']);
            expect(pair3).toEqual(constants.ZERO_ADDRESS);

            let tx7 = await send(newMockUniswapV2Factory1, 'setPairExist', [false]);

            pair1 = await call(uniswapV2PriceOracle, "getPoolPair", [asset._address, '0']);
            expect(pair1).toEqual(constants.ZERO_ADDRESS);
            pair2 = await call(uniswapV2PriceOracle, "getPoolPair", [asset._address, '1']);
            expect(pair2).toEqual(constants.ZERO_ADDRESS);
            pair3 = await call(uniswapV2PriceOracle, "getPoolPair", [asset._address, '2']);
            expect(pair3).toEqual(constants.ZERO_ADDRESS);

            let tx8 = await send(newMockUniswapV2Factory1, 'setPairExist', [true]);

            pair1 = await call(uniswapV2PriceOracle, "getPoolPair", [asset._address, '0']);
            expect(pair1).toEqual(constants.ZERO_ADDRESS);
            pair2 = await call(uniswapV2PriceOracle, "getPoolPair", [asset._address, '1']);
            expect(pair2).toEqual(newMockUniswapV2Pool1._address);
            pair3 = await call(uniswapV2PriceOracle, "getPoolPair", [asset._address, '2']);
            expect(pair3).toEqual(constants.ZERO_ADDRESS);
        });
    });

    describe("check update pool function", () => {
        it("update pool, not UNAUTHORIZED", async () => {
            let result = await send(uniswapV2PriceOracle, '_updatePool', [
                '0',
                mockUniswapV2Factory._address
            ], {from: accounts[2]});

            expect(result).toHaveOracleFailure('UNAUTHORIZED', 'UPDATE_DATA');
        });

        it('update pool, invalid address for factory', async () => {
            await expect(
                send(uniswapV2PriceOracle, '_updatePool', [
                    '0',
                    constants.ZERO_ADDRESS
                ]),
            ).rejects.toRevert('revert Oracle: invalid address for factory');
        });

        it("update pool, but pool exist", async () => {
            let result = await send(uniswapV2PriceOracle, '_updatePool', [
                '0',
                mockUniswapV2Factory._address
            ]);

            expect(result).toHaveOracleFailure('POOL_OR_COIN_EXIST', 'UPDATE_DATA');

            let newMockUniswapV2Factory = await deploy('MockUniswapV2Factory');

            let tx = await send(uniswapV2PriceOracle, '_addPool', [
                newMockUniswapV2Factory._address
            ]);

            result = await send(uniswapV2PriceOracle, '_updatePool', [
                '0',
                newMockUniswapV2Factory._address
            ]);

            expect(result).toHaveOracleFailure('POOL_OR_COIN_EXIST', 'UPDATE_DATA');
        });

        it("update pool, check data", async () => {
            let newFactory1 = await deploy('MockUniswapV2Factory');

            let tx1 = await send(uniswapV2PriceOracle, '_addPool', [
                newFactory1._address
            ]);

            let newFactory2 = await deploy('MockUniswapV2Factory');

            let tx2 = await send(uniswapV2PriceOracle, '_addPool', [
                newFactory2._address
            ]);

            let poolFactories = await call(uniswapV2PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapV2Factory._address, newFactory1._address, newFactory2._address]);

            let newFactory3 = await deploy('MockUniswapV2Factory');

            let tx3 = await send(uniswapV2PriceOracle, '_updatePool', [
                '0',
                newFactory3._address
            ]);

            let newFactory4 = await deploy('MockUniswapV2Factory');

            let tx4 = await send(uniswapV2PriceOracle, '_updatePool', [
                '1',
                newFactory4._address
            ]);

            let newFactory5 = await deploy('MockUniswapV2Factory');

            let tx5 = await send(uniswapV2PriceOracle, '_updatePool', [
                '2',
                newFactory5._address
            ]);

            poolFactories = await call(uniswapV2PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([newFactory3._address, newFactory4._address, newFactory5._address]);
        });

        it('update pool, check event', async () => {
            let newMockUniswapV2Factory = await deploy('MockUniswapV2Factory');

            let result = await send(uniswapV2PriceOracle, '_updatePool', [
                '0',
                newMockUniswapV2Factory._address
            ]);

            expect(result).toHaveLog('PoolUpdated', {
                id: '0',
                poolFactory: newMockUniswapV2Factory._address
            });
        });
    });

    describe("check remove pool function", () => {
        it("remove pool, not UNAUTHORIZED", async () => {
            let result = await send(uniswapV2PriceOracle, '_removePool', [
                '0'
            ], {from: accounts[2]});

            expect(result).toHaveOracleFailure('UNAUTHORIZED', 'UPDATE_DATA');
        });

        it('remove pool, remove single pool', async () => {
            await expect(
                send(uniswapV2PriceOracle, '_removePool', [
                    '0'
                ]),
            ).rejects.toRevert('revert Oracle: must have one pool');
        });

        it("remove last pool, check data", async () => {
            let newMockUniswapV2Factory = await deploy('MockUniswapV2Factory');

            let result = await send(uniswapV2PriceOracle, '_addPool', [
                newMockUniswapV2Factory._address
            ]);

            expect(result).toSucceed();

            let poolFactories = await call(uniswapV2PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapV2Factory._address, newMockUniswapV2Factory._address]);

            result = await send(uniswapV2PriceOracle, '_removePool', [
                '1'
            ]);

            expect(result).toHaveLog('PoolRemoved', {
                id: '1',
                poolFactory: newMockUniswapV2Factory._address
            });

            poolFactories = await call(uniswapV2PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapV2Factory._address]);
        });

        it("remove pool, check data", async () => {
            let poolFactories = await call(uniswapV2PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapV2Factory._address]);

            let newFactory1 = await deploy('MockUniswapV2Factory');

            let tx1 = await send(uniswapV2PriceOracle, '_addPool', [
                newFactory1._address
            ]);

            poolFactories = await call(uniswapV2PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapV2Factory._address, newFactory1._address]);

            let newFactory2 = await deploy('MockUniswapV2Factory');

            let tx2 = await send(uniswapV2PriceOracle, '_addPool', [
                newFactory2._address
            ]);

            poolFactories = await call(uniswapV2PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapV2Factory._address, newFactory1._address, newFactory2._address]);

            let tx21 = await send(uniswapV2PriceOracle, '_removePool', [
                '1'
            ]);

            poolFactories = await call(uniswapV2PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapV2Factory._address, newFactory2._address]);

            let newFactory3 = await deploy('MockUniswapV2Factory');

            let tx3 = await send(uniswapV2PriceOracle, '_addPool', [
                newFactory3._address
            ]);

            poolFactories = await call(uniswapV2PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapV2Factory._address, newFactory2._address, newFactory3._address]);

            let tx4 = await send(uniswapV2PriceOracle, '_removePool', [
                '2'
            ]);

            poolFactories = await call(uniswapV2PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapV2Factory._address, newFactory2._address]);

            let tx5 = await send(uniswapV2PriceOracle, '_addPool', [
                newFactory3._address
            ]);

            poolFactories = await call(uniswapV2PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapV2Factory._address, newFactory2._address, newFactory3._address]);

            let tx6 = await send(uniswapV2PriceOracle, '_removePool', [
                '1'
            ]);

            poolFactories = await call(uniswapV2PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapV2Factory._address, newFactory3._address]);
        });

        it('remove pool, check event', async () => {
            let newFactory1 = await deploy('MockUniswapV2Factory');

            let tx1 = await send(uniswapV2PriceOracle, '_addPool', [
                newFactory1._address
            ]);

            let newFactory2 = await deploy('MockUniswapV2Factory');

            let tx2 = await send(uniswapV2PriceOracle, '_addPool', [
                newFactory2._address
            ]);

            let poolFactories = await call(uniswapV2PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapV2Factory._address, newFactory1._address, newFactory2._address]);

            let result = await send(uniswapV2PriceOracle, '_removePool', [
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
            let isNewAsset = await call(uniswapV2PriceOracle, "isNewAsset", [asset._address]);
            expect(isNewAsset).toEqual(false);

            await send(uniswapV2PriceOracle, 'setPreviousTimeStampForAsset', [asset._address, '0']);

            isNewAsset = await call(uniswapV2PriceOracle, "isNewAsset", [asset._address]);
            expect(isNewAsset).toEqual(true);

            await send(uniswapV2PriceOracle, 'setPreviousTimeStampForAsset', [asset._address, '100']);

            isNewAsset = await call(uniswapV2PriceOracle, "isNewAsset", [asset._address]);
            expect(isNewAsset).toEqual(false);
        });
    });

    describe("check _setMinReserveLiquidity function", () => {
        it("Check set min reserve liquidity", async () => {
            let liquidity = '100';
            let tx = await send(uniswapV2PriceOracle, '_setMinReserveLiquidity', [
                liquidity,
            ]);

            let liquidity_ = await call(uniswapV2PriceOracle, "minReserveLiquidity");
            expect(liquidity_).toEqual(liquidity);
        });

        it("set new min reserve liquidity, not UNAUTHORIZED", async () => {
            let liquidity = '100';
            let result = await send(uniswapV2PriceOracle, '_setMinReserveLiquidity', [
                liquidity,
            ], {from: accounts[2]});

            expect(result).toHaveOracleFailure('UNAUTHORIZED', 'UPDATE_DATA');
        });
    });

    describe("check _setPeriod function", () => {
        it("Check set period", async () => {
            let period = '100';
            let tx = await send(uniswapV2PriceOracle, '_setPeriod', [
                period,
            ]);

            let period_ = await call(uniswapV2PriceOracle, "period");
            expect(period_).toEqual(period);
        });

        it("set period, not UNAUTHORIZED", async () => {
            let period = '100';
            let result = await send(uniswapV2PriceOracle, '_setPeriod', [
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
            let result = await send(uniswapV2PriceOracle, '_addStableCoin', [
                stableCoin._address
            ], {from: accounts[2]});

            expect(result).toHaveOracleFailure('UNAUTHORIZED', 'ADD_POOL_OR_COIN');
        });

        it('add stable coin, invalid address for stable coin', async () => {
            await expect(
                send(uniswapV2PriceOracle, '_addStableCoin', [
                    constants.ZERO_ADDRESS
                ]),
            ).rejects.toRevert('revert Oracle: invalid address for stable coin');
        });

        it("add stable coin twice", async () => {
            let result = await send(uniswapV2PriceOracle, '_addStableCoin', [
                stableCoin._address
            ]);

            expect(result).toSucceed();

            result = await send(uniswapV2PriceOracle, '_addStableCoin', [
                stableCoin._address
            ]);

            expect(result).toHaveOracleFailure('POOL_OR_COIN_EXIST', 'ADD_POOL_OR_COIN');
        });

        it("add stable coin, check data", async () => {
            let stableCoins = await call(uniswapV2PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([]);

            let tx1 = await send(uniswapV2PriceOracle, '_addStableCoin', [
                stableCoin._address
            ]);

            stableCoins = await call(uniswapV2PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address]);

            let stableCoin2 = await makeToken();

            let tx2 = await send(uniswapV2PriceOracle, '_addStableCoin', [
                stableCoin2._address
            ]);

            stableCoins = await call(uniswapV2PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin2._address]);
        });

        it('add stable coin, check event', async () => {
            let result = await send(uniswapV2PriceOracle, '_addStableCoin', [
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

            let result = await send(uniswapV2PriceOracle, '_addStableCoin', [
                stableCoin._address
            ]);

            expect(result).toSucceed();
        });

        it("remove stable coin, not UNAUTHORIZED", async () => {
            let result = await send(uniswapV2PriceOracle, '_removeStableCoin', [
                '0'
            ], {from: accounts[2]});

            expect(result).toHaveOracleFailure('UNAUTHORIZED', 'UPDATE_DATA');
        });

        it('remove stable coin', async () => {
            let result = await send(uniswapV2PriceOracle, '_removeStableCoin', [
                '0'
            ]);

            expect(result).toSucceed();

            await expect(
                send(uniswapV2PriceOracle, '_removeStableCoin', [
                    '0'
                ]),
            ).rejects.toRevert('revert Oracle: stable coins are empty');
        });

        it("remove last stable coin, check data", async () => {
            let stableCoin2 = await makeToken();

            let result = await send(uniswapV2PriceOracle, '_addStableCoin', [
                stableCoin2._address
            ]);

            expect(result).toSucceed();

            let stableCoins = await call(uniswapV2PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin2._address]);

            result = await send(uniswapV2PriceOracle, '_removeStableCoin', [
                '1'
            ]);

            expect(result).toHaveLog('StableCoinRemoved', {
                id: '1',
                coin: stableCoin2._address
            });

            stableCoins = await call(uniswapV2PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address]);
        });

        it("remove stable coin, check data", async () => {
            let stableCoins = await call(uniswapV2PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address]);

            let stableCoin2 = await makeToken();

            let result = await send(uniswapV2PriceOracle, '_addStableCoin', [
                stableCoin2._address
            ]);

            expect(result).toSucceed();

            stableCoins = await call(uniswapV2PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin2._address]);

            let stableCoin3 = await makeToken();

            result = await send(uniswapV2PriceOracle, '_addStableCoin', [
                stableCoin3._address
            ]);

            expect(result).toSucceed();

            stableCoins = await call(uniswapV2PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin2._address, stableCoin3._address]);

            let tx21 = await send(uniswapV2PriceOracle, '_removeStableCoin', [
                '1'
            ]);

            stableCoins = await call(uniswapV2PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin3._address]);

            let stableCoin4 = await makeToken();

            result = await send(uniswapV2PriceOracle, '_addStableCoin', [
                stableCoin4._address
            ]);

            expect(result).toSucceed();

            stableCoins = await call(uniswapV2PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin3._address, stableCoin4._address]);

            let tx4 = await send(uniswapV2PriceOracle, '_removeStableCoin', [
                '2'
            ]);

            stableCoins = await call(uniswapV2PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin3._address]);

            let tx5 = await send(uniswapV2PriceOracle, '_addStableCoin', [
                stableCoin4._address
            ]);

            stableCoins = await call(uniswapV2PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin3._address, stableCoin4._address]);

            let tx6 = await send(uniswapV2PriceOracle, '_removeStableCoin', [
                '1'
            ]);

            stableCoins = await call(uniswapV2PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin4._address]);
        });

        it('remove pool, check event', async () => {
            let stableCoin2 = await makeToken();

            let result = await send(uniswapV2PriceOracle, '_addStableCoin', [
                stableCoin2._address
            ]);

            let stableCoin3 = await makeToken();

            result = await send(uniswapV2PriceOracle, '_addStableCoin', [
                stableCoin3._address
            ]);

            expect(result).toSucceed();

            let stableCoins = await call(uniswapV2PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin2._address, stableCoin3._address]);

            result = await send(uniswapV2PriceOracle, '_removeStableCoin', [
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

            let result = await send(uniswapV2PriceOracle, '_addStableCoin', [
                stableCoin._address
            ]);

            expect(result).toSucceed();
        });

        it("update stable coin, not UNAUTHORIZED", async () => {
            let result = await send(uniswapV2PriceOracle, '_updateStableCoin', [
                '0',
                stableCoin._address
            ], {from: accounts[2]});

            expect(result).toHaveOracleFailure('UNAUTHORIZED', 'UPDATE_DATA');
        });

        it('update stable coin, invalid address for coin', async () => {
            await expect(
                send(uniswapV2PriceOracle, '_updateStableCoin', [
                    '0',
                    constants.ZERO_ADDRESS
                ]),
            ).rejects.toRevert('revert Oracle: invalid address for stable coin');
        });

        it("update stable coin, but stable coin exist", async () => {
            let result = await send(uniswapV2PriceOracle, '_updateStableCoin', [
                '0',
                stableCoin._address
            ]);

            expect(result).toHaveOracleFailure('POOL_OR_COIN_EXIST', 'UPDATE_DATA');

            let stableCoin2 = await makeToken();

            result = await send(uniswapV2PriceOracle, '_updateStableCoin', [
                '0',
                stableCoin2._address
            ]);

            expect(result).toSucceed();

            result = await send(uniswapV2PriceOracle, '_updateStableCoin', [
                '0',
                stableCoin2._address
            ]);

            expect(result).toHaveOracleFailure('POOL_OR_COIN_EXIST', 'UPDATE_DATA');
        });

        it("update stable coin, check data", async () => {
            let stableCoin2 = await makeToken();

            let result = await send(uniswapV2PriceOracle, '_addStableCoin', [
                stableCoin2._address
            ]);

            expect(result).toSucceed();

            let stableCoin3 = await makeToken();

            result = await send(uniswapV2PriceOracle, '_addStableCoin', [
                stableCoin3._address
            ]);

            expect(result).toSucceed();

            let stableCoins = await call(uniswapV2PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin2._address, stableCoin3._address]);

            let stableCoin4 = await makeToken();

            let tx3 = await send(uniswapV2PriceOracle, '_updateStableCoin', [
                '0',
                stableCoin4._address
            ]);

            let stableCoin5 = await makeToken();

            let tx4 = await send(uniswapV2PriceOracle, '_updateStableCoin', [
                '1',
                stableCoin5._address
            ]);

            let stableCoin6 = await makeToken();

            let tx5 = await send(uniswapV2PriceOracle, '_updateStableCoin', [
                '2',
                stableCoin6._address
            ]);

            stableCoins = await call(uniswapV2PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin4._address, stableCoin5._address, stableCoin6._address]);
        });

        it('update pool, check event', async () => {
            let stableCoin2 = await makeToken();

            let result = await send(uniswapV2PriceOracle, '_updateStableCoin', [
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
            let pair1 = await call(mockUniswapV2Factory, "getPair", [WETHToken._address, asset._address]);
            expect(pair1).toEqual(mockUniswapV2Pool._address);

            let period = await call(uniswapV2PriceOracle, "period");
            let blockTimeStampLast = await call(mockUniswapV2Pool, "blockTimeStampLast");

            await send(mockUniswapV2Pool, 'setBlockTimeStampLast', [+blockTimeStampLast+(+period)+1]);

            let isNewAsset = await call(uniswapV2PriceOracle, "isNewAsset", [asset._address]);
            expect(isNewAsset).toEqual(false);

            let isPeriodElapsed = await call(uniswapV2PriceOracle, "isPeriodElapsed", [asset._address]);
            expect(isPeriodElapsed).toEqual(true);

            period = '1200';
            let tx11 = await send(uniswapV2PriceOracle, '_setPeriod', [period]);

            isPeriodElapsed = await call(uniswapV2PriceOracle, "isPeriodElapsed", [asset._address]);
            expect(isPeriodElapsed).toEqual(false);

            await send(mockUniswapV2Pool, 'setBlockTimeStampLast', [+blockTimeStampLast+(+period)+1]);

            isPeriodElapsed = await call(uniswapV2PriceOracle, "isPeriodElapsed", [asset._address]);
            expect(isPeriodElapsed).toEqual(true);

            period = '100';
            let tx12 = await send(uniswapV2PriceOracle, '_setPeriod', [period]);

            isPeriodElapsed = await call(uniswapV2PriceOracle, "isPeriodElapsed", [asset._address]);
            expect(isPeriodElapsed).toEqual(true);

            await send(mockUniswapV2Pool, 'setBlockTimeStampLast', [+blockTimeStampLast+(+period)+2]);

            isPeriodElapsed = await call(uniswapV2PriceOracle, "isPeriodElapsed", [asset._address]);
            expect(isPeriodElapsed).toEqual(true);
        });
    });

    describe("check eth course function function and internal data", () => {
        let usdc, usdt, dai, newAsset;
        let newMockUniswapV2Pool1, newMockUniswapV2Pool2, newMockUniswapV2Pool3;
        let newMockUniswapV2Factory1, newMockUniswapV2Factory2, newMockUniswapV2Factory3;
        let newMockUniswapV2PoolDAI, newMockUniswapV2PoolUSDT, newMockUniswapV2PoolUSDC;

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

            newMockUniswapV2Factory1 = await deploy('MockUniswapV2FactoryV2');
            newMockUniswapV2PoolDAI = await deploy('MockUniswapV2Pool');
            newMockUniswapV2PoolUSDT = await deploy('MockUniswapV2Pool');
            newMockUniswapV2PoolUSDC = await deploy('MockUniswapV2Pool');

            // real data (blockTimeStamp 1617976989)
            await send(newMockUniswapV2PoolUSDT, 'setData', [
                WETHToken._address,
                usdt._address,
                '69300414106281610056486',
                '144136978589498',
                '108440522331595154328745452759693',
                '328889143286590183358706488927451804772319811247343'
            ]);

            // real data (blockTimeStamp 1617977088)
            await send(newMockUniswapV2PoolDAI, 'setData', [
                WETHToken._address,
                dai._address,
                '29081378201996628687365',
                '60423815286154060995479625',
                '108504765323811843166591297400758083311906011',
                '343245678014664626911483647466477553703'
            ]);

            // real data (blockTimeStamp 1617977100)
            await send(newMockUniswapV2PoolUSDC, 'setData', [
                WETHToken._address,
                usdc._address,
                '67750901312389818218470',
                '140711590148267',
                '109613359197447592748722255800848',
                '359749687769618128771704981052957704836749272276592'
            ]);

            let txDai = await send(newMockUniswapV2Factory1, 'addPair', [WETHToken._address, dai._address, newMockUniswapV2PoolDAI._address]);
            let txUSDT = await send(newMockUniswapV2Factory1, 'addPair', [WETHToken._address, usdt._address, newMockUniswapV2PoolUSDT._address]);
            let txUSDC = await send(newMockUniswapV2Factory1, 'addPair', [WETHToken._address, usdc._address, newMockUniswapV2PoolUSDC._address]);

            let result = await send(uniswapV2PriceOracle, '_updatePool', [
                '0',
                newMockUniswapV2Factory1._address
            ]);

            let priceAverage = await call(uniswapV2PriceOracle, "getCourseInETH", [usdt._address]);
            expect(priceAverage).toEqual('0');

            priceAverage = await call(uniswapV2PriceOracle, "getCourseInETH", [dai._address]);
            expect(priceAverage).toEqual('0');

            priceAverage = await call(uniswapV2PriceOracle, "getCourseInETH", [usdc._address]);
            expect(priceAverage).toEqual('0');

            expect(
                await send(uniswapV2PriceOracle, 'update', [usdt._address])
            ).toHaveLog("PriceUpdated", {
                asset: usdt._address,
                price: "480795523705607", // Price in ETH with 18 decimals of precision
            });

            expect(
                await send(uniswapV2PriceOracle, 'update', [dai._address])
            ).toHaveLog("PriceUpdated", {
                asset: dai._address,
                price: "481290002365351", // Price in ETH with 18 decimals of precision
            });

            expect(
                await send(uniswapV2PriceOracle, 'update', [usdc._address])
            ).toHaveLog("PriceUpdated", {
                asset: usdc._address,
                price: "481487710010249", // Price in ETH with 18 decimals of precision
            });

            newMockUniswapV2Factory2 = await deploy('MockUniswapV2FactoryV2');
            newMockUniswapV2Pool1 = await deploy('MockUniswapV2Pool');
            newMockUniswapV2Pool2 = await deploy('MockUniswapV2Pool');

            await send(newMockUniswapV2Pool1, 'setData', [
                newAsset._address,
                usdt._address,
                '1',
                '1',
                '0',
                '0'
            ]);

            await send(newMockUniswapV2Pool2, 'setData', [
                newAsset._address,
                dai._address,
                '1',
                '1',
                '0',
                '0'
            ]);

            let tx3 = await send(newMockUniswapV2Factory2, 'addPair', [newAsset._address, usdt._address, newMockUniswapV2Pool1._address]);
            let tx4 = await send(newMockUniswapV2Factory2, 'addPair', [newAsset._address, dai._address, newMockUniswapV2Pool2._address]);

            newMockUniswapV2Factory3 = await deploy('MockUniswapV2FactoryV2');
            newMockUniswapV2Pool3 = await deploy('MockUniswapV2Pool');

            await send(newMockUniswapV2Pool3, 'setData', [
                newAsset._address,
                usdc._address,
                '1',
                '1',
                '0',
                '0'
            ]);

            let tx5 = await send(newMockUniswapV2Factory3, 'addPair', [newAsset._address, usdc._address, newMockUniswapV2Pool3._address]);

            await send(uniswapV2PriceOracle, '_addPool', [newMockUniswapV2Factory2._address]);
            await send(uniswapV2PriceOracle, '_addPool', [newMockUniswapV2Factory3._address]);

            await send(uniswapV2PriceOracle, '_addStableCoin', [usdt._address]);
            await send(uniswapV2PriceOracle, '_addStableCoin', [dai._address]);
            await send(uniswapV2PriceOracle, '_addStableCoin', [usdc._address]);
        });

        it("check init data", async () => {
            let priceAverage = await call(uniswapV2PriceOracle, "getCourseInETH", [usdt._address]);
            let calcPriceAverage = await call(uniswapV2PriceOracle, "calcCourseInETH", [usdt._address]);
            expect(priceAverage).toEqual('480795523705607'); // 1 eth = 2079,88 usdt
            expect(calcPriceAverage).toEqual('480795523705607');

            priceAverage = await call(uniswapV2PriceOracle, "getCourseInETH", [dai._address]);
            calcPriceAverage = await call(uniswapV2PriceOracle, "calcCourseInETH", [dai._address]);
            expect(priceAverage).toEqual('481290002365351'); // 1 eth = 2077,75 dai
            expect(calcPriceAverage).toEqual('481290002365351');

            priceAverage = await call(uniswapV2PriceOracle, "getCourseInETH", [usdc._address]);
            calcPriceAverage = await call(uniswapV2PriceOracle, "calcCourseInETH", [usdc._address]);
            expect(priceAverage).toEqual('481487710010249'); // 1 eth = 2076,90 usdc
            expect(calcPriceAverage).toEqual('481487710010249');

            let poolFactories = await call(uniswapV2PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([newMockUniswapV2Factory1._address, newMockUniswapV2Factory2._address, newMockUniswapV2Factory3._address]);

            let pairs = await call(newMockUniswapV2Factory1, "getAllPairs");
            expect(pairs).toEqual([newMockUniswapV2PoolDAI._address, newMockUniswapV2PoolUSDT._address, newMockUniswapV2PoolUSDC._address]);

            pairs = await call(newMockUniswapV2Factory2, "getAllPairs");
            expect(pairs).toEqual([newMockUniswapV2Pool1._address, newMockUniswapV2Pool2._address]);

            pairs = await call(newMockUniswapV2Factory3, "getAllPairs");
            expect(pairs).toEqual([newMockUniswapV2Pool3._address]);

            let pairNEWUSDT = await call(newMockUniswapV2Factory2, 'getPair', [newAsset._address, usdt._address]);
            let pairNEWDAI = await call(newMockUniswapV2Factory2, 'getPair', [newAsset._address, dai._address]);
            let pairNEWUSDC = await call(newMockUniswapV2Factory3, 'getPair', [newAsset._address, usdc._address]);
            expect(pairNEWUSDT).toEqual(newMockUniswapV2Pool1._address);
            expect(pairNEWDAI).toEqual(newMockUniswapV2Pool2._address);
            expect(pairNEWUSDC).toEqual(newMockUniswapV2Pool3._address);

            let stableCoins = await call(uniswapV2PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([usdt._address, dai._address, usdc._address]);

            let searchPairUSDC = await call(uniswapV2PriceOracle, "searchPair", [usdc._address]);
            expect(searchPairUSDC[0]).toEqual(newMockUniswapV2PoolUSDC._address);
            expect(searchPairUSDC[1]).toEqual('67750901312389818218470');
            let searchPairNew = await call(uniswapV2PriceOracle, "searchPair", [newAsset._address]);
            expect(searchPairNew[0]).toEqual(newMockUniswapV2Pool3._address);
            expect(searchPairNew[1]).toEqual('481487710');

            let getPoolPairWithStableCoin1 = await call(uniswapV2PriceOracle, "getPoolPairWithStableCoin", [newAsset._address, '0', '0']);
            expect(getPoolPairWithStableCoin1).toEqual(constants.ZERO_ADDRESS);
            let getPoolPairWithStableCoin2 = await call(uniswapV2PriceOracle, "getPoolPairWithStableCoin", [newAsset._address, '0', '1']);
            expect(getPoolPairWithStableCoin2).toEqual(constants.ZERO_ADDRESS);
            let getPoolPairWithStableCoin3 = await call(uniswapV2PriceOracle, "getPoolPairWithStableCoin", [newAsset._address, '0', '2']);
            expect(getPoolPairWithStableCoin3).toEqual(constants.ZERO_ADDRESS);
            getPoolPairWithStableCoin1 = await call(uniswapV2PriceOracle, "getPoolPairWithStableCoin", [newAsset._address, '1', '0']);
            expect(getPoolPairWithStableCoin1).toEqual(newMockUniswapV2Pool1._address);
            getPoolPairWithStableCoin2 = await call(uniswapV2PriceOracle, "getPoolPairWithStableCoin", [newAsset._address, '1', '1']);
            expect(getPoolPairWithStableCoin2).toEqual(newMockUniswapV2Pool2._address);
            getPoolPairWithStableCoin3 = await call(uniswapV2PriceOracle, "getPoolPairWithStableCoin", [newAsset._address, '1', '2']);
            expect(getPoolPairWithStableCoin3).toEqual(constants.ZERO_ADDRESS);
            getPoolPairWithStableCoin1 = await call(uniswapV2PriceOracle, "getPoolPairWithStableCoin", [newAsset._address, '2', '0']);
            expect(getPoolPairWithStableCoin1).toEqual(constants.ZERO_ADDRESS);
            getPoolPairWithStableCoin2 = await call(uniswapV2PriceOracle, "getPoolPairWithStableCoin", [newAsset._address, '2', '1']);
            expect(getPoolPairWithStableCoin2).toEqual(constants.ZERO_ADDRESS);
            getPoolPairWithStableCoin3 = await call(uniswapV2PriceOracle, "getPoolPairWithStableCoin", [newAsset._address, '2', '2']);
            expect(getPoolPairWithStableCoin3).toEqual(newMockUniswapV2Pool3._address);

            expect(
                await send(uniswapV2PriceOracle, 'update', [newAsset._address])
            ).toHaveLog("PriceUpdated", {
                asset: newAsset._address,
                price: "481487710010249000000000000", // Get USDC pool, because reserve is max
            });

            priceAverage = await call(uniswapV2PriceOracle, "getCourseInETH", [newAsset._address]);
            calcPriceAverage = await call(uniswapV2PriceOracle, "calcCourseInETH", [newAsset._address]);
            expect(priceAverage).toEqual('481487710010249000000000000'); // 1 eth = 10e-12 asset
            expect(calcPriceAverage).toEqual('481487710010249000000000000');
        });

        it("check set max reserve to other pool #1", async () => {
            await send(newMockUniswapV2Pool1, 'setData', [
                newAsset._address,
                usdt._address,
                '10',
                '10',
                '0',
                '0'
            ]);

            let pair = await call(uniswapV2PriceOracle, "searchPair", [newAsset._address]);

            expect(
                await send(uniswapV2PriceOracle, 'update', [newAsset._address])
            ).toHaveLog("PriceUpdated", {
                asset: newAsset._address,
                price: "480795523705607000000000000", // Get USDT pool
            });

            let assetPair = await call(uniswapV2PriceOracle, "assetPair", [newAsset._address]);
            expect(pair[0]).toEqual(assetPair);

            let priceAverage = await call(uniswapV2PriceOracle, "getCourseInETH", [newAsset._address]);
            let calcPriceAverage = await call(uniswapV2PriceOracle, "calcCourseInETH", [newAsset._address]);
            expect(priceAverage).toEqual('480795523705607000000000000');
            expect(calcPriceAverage).toEqual('480795523705607000000000000');
        });

        it("check set max reserve to other pool #2", async () => {
            await send(newMockUniswapV2Pool2, 'setData', [
                newAsset._address,
                dai._address,
                '12000000000000000000',
                '12000000000000000000',
                '0',
                '0'
            ]);

            let pair = await call(uniswapV2PriceOracle, "searchPair", [newAsset._address]);

            expect(
                await send(uniswapV2PriceOracle, 'update', [newAsset._address])
            ).toHaveLog("PriceUpdated", {
                asset: newAsset._address,
                price: "481290002365351", // Get DAI pool, because 1 DAI = 1 Asset
            });

            let assetPair = await call(uniswapV2PriceOracle, "assetPair", [newAsset._address]);
            expect(pair[0]).toEqual(assetPair);

            let priceAverage = await call(uniswapV2PriceOracle, "getCourseInETH", [newAsset._address]);
            let calcPriceAverage = await call(uniswapV2PriceOracle, "calcCourseInETH", [newAsset._address]);
            expect(priceAverage).toEqual('481290002365351');
            expect(calcPriceAverage).toEqual('481290002365351');
        });

        it("check update asset pair function", async () => {
            await send(newMockUniswapV2Pool2, 'setData', [
                newAsset._address,
                dai._address,
                '1000000000000000000',
                '1000000000000000000',
                '0',
                '0'
            ]);

            expect(
                await send(uniswapV2PriceOracle, 'update', [newAsset._address])
            ).toHaveLog("PriceUpdated", {
                asset: newAsset._address,
                price: "481290002365351", // Get DAI pool, because reserve is max and 1 DAI = 1 Asset
            });

            let priceAverage = await call(uniswapV2PriceOracle, "getCourseInETH", [newAsset._address]);
            let calcPriceAverage = await call(uniswapV2PriceOracle, "calcCourseInETH", [newAsset._address]);
            expect(priceAverage).toEqual('481290002365351');
            expect(calcPriceAverage).toEqual('481290002365351');

            let assetPairAddress = await call(uniswapV2PriceOracle, "assetPair", [newAsset._address]);
            expect(assetPairAddress).toEqual(newMockUniswapV2Pool2._address);

            expect(
                await send(uniswapV2PriceOracle, '_updateAssetPair', [newAsset._address, newMockUniswapV2Pool1._address])
            ).toHaveLog("PriceUpdated", {
                asset: newAsset._address,
                price: "480795523705607000000000000",
            });

            priceAverage = await call(uniswapV2PriceOracle, "getCourseInETH", [newAsset._address]);
            calcPriceAverage = await call(uniswapV2PriceOracle, "calcCourseInETH", [newAsset._address]);
            expect(priceAverage).toEqual('480795523705607000000000000');
            expect(calcPriceAverage).toEqual('480795523705607000000000000');

            assetPairAddress = await call(uniswapV2PriceOracle, "assetPair", [newAsset._address]);
            expect(assetPairAddress).toEqual(newMockUniswapV2Pool1._address);

            expect(
                await send(uniswapV2PriceOracle, '_updateAssetPair', [newAsset._address, newMockUniswapV2Pool2._address])
            ).toHaveLog("PriceUpdated", {
                asset: newAsset._address,
                price: "481290002365351",
            });

            priceAverage = await call(uniswapV2PriceOracle, "getCourseInETH", [newAsset._address]);
            calcPriceAverage = await call(uniswapV2PriceOracle, "calcCourseInETH", [newAsset._address]);
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
            uniswapFactory1 = await deploy('MockUniswapV2FactoryV2');
            await send(uniswapV2PriceOracle, '_updatePool', ['0', uniswapFactory1._address]);

            token = await makeToken();
            pair = await deploy('MockUniswapV2Pool');

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
                await send(uniswapV2PriceOracle, 'update', [token._address])
            ).toHaveLog("PriceUpdated", {
                asset: token._address,
                price: "1870662228360967",
            });

            // update token price - fail (period is not elapsed)
            expect(
                await send(uniswapV2PriceOracle, 'update', [token._address])
            ).toHaveLog("Failure", {
                error : '4',
                info : '4',
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
                await send(uniswapV2PriceOracle, 'update', [token._address])
            ).toHaveLog("PriceUpdated", {
                asset: token._address,
                price: "1955453362090548",
            });

            // create factory #2
            uniswapFactory2 = await deploy('MockUniswapV2FactoryV2');
            await send(uniswapV2PriceOracle, '_addPool', [uniswapFactory2._address]);

            stableCoin = await makeToken({decimals: 6});

            result = await send(uniswapV2PriceOracle, '_addStableCoin', [stableCoin._address]);
            expect(result).toSucceed();

            stableCoinPair = await deploy('MockUniswapV2Pool');

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
                await send(uniswapV2PriceOracle, 'update', [stableCoin._address])
            ).toHaveLog("PriceUpdated", {
                asset: stableCoin._address,
                price: "709566091696059",
            });

            tokenPairWithStableCoin = await deploy('MockUniswapV2Pool');

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
                await send(uniswapV2PriceOracle, '_updateAssetPair', [token._address, tokenPairWithStableCoin._address])
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
                await send(uniswapV2PriceOracle, 'update', [token._address])
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
                await send(uniswapV2PriceOracle, 'update', [token._address])
            ).toHaveLog("PriceUpdated", {
                asset: token._address,
                price: "708447815535546",
            });

            // stable coin with decimals 18, for example dai
            newStableCoin = await makeToken();

            result = await send(uniswapV2PriceOracle, '_addStableCoin', [newStableCoin._address]);
            expect(result).toSucceed();

            newStableCoinPair = await deploy('MockUniswapV2Pool');

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
                await send(uniswapV2PriceOracle, 'update', [newStableCoin._address])
            ).toHaveLog("PriceUpdated", {
                asset: newStableCoin._address,
                price: "985816335955356",
            });

            tokenPairWithNewStableCoin = await deploy('MockUniswapV2Pool');

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
                await send(uniswapV2PriceOracle, '_updateAssetPair', [token._address, tokenPairWithNewStableCoin._address])
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
                await send(uniswapV2PriceOracle, 'update', [token._address])
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
                await send(uniswapV2PriceOracle, 'update', [token._address])
            ).toHaveLog("PriceUpdated", {
                asset: token._address,
                price: "1991368507936111",
            });
        });
    });

    describe("update asset pair to new asset pair", () => {
        let usdc, usdt, dai, newAsset;
        let newMockUniswapV2Pool1, newMockUniswapV2Pool2, newMockUniswapV2Pool3;
        let newMockUniswapV2Factory1, newMockUniswapV2Factory2;
        let newMockUniswapV2PoolDAI, newMockUniswapV2PoolUSDT, newMockUniswapV2PoolUSDC;

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

            newMockUniswapV2Factory1 = await deploy('MockUniswapV2FactoryV2');
            newMockUniswapV2PoolDAI = await deploy('MockUniswapV2Pool');
            newMockUniswapV2PoolUSDT = await deploy('MockUniswapV2Pool');
            newMockUniswapV2PoolUSDC = await deploy('MockUniswapV2Pool');

            // real data (blockTimeStamp 1617976989)
            await send(newMockUniswapV2PoolUSDT, 'setData', [
                WETHToken._address,
                usdt._address,
                '69300414106281610056486',
                '144136978589498',
                '108440522331595154328745452759693',
                '328889143286590183358706488927451804772319811247343'
            ]);

            // real data (blockTimeStamp 1617977088)
            await send(newMockUniswapV2PoolDAI, 'setData', [
                WETHToken._address,
                dai._address,
                '29081378201996628687365',
                '60423815286154060995479625',
                '108504765323811843166591297400758083311906011',
                '343245678014664626911483647466477553703'
            ]);

            // real data (blockTimeStamp 1617977100)
            await send(newMockUniswapV2PoolUSDC, 'setData', [
                WETHToken._address,
                usdc._address,
                '67750901312389818218470',
                '140711590148267',
                '109613359197447592748722255800848',
                '359749687769618128771704981052957704836749272276592'
            ]);

            let txDai = await send(newMockUniswapV2Factory1, 'addPair', [WETHToken._address, dai._address, newMockUniswapV2PoolDAI._address]);
            let txUSDT = await send(newMockUniswapV2Factory1, 'addPair', [WETHToken._address, usdt._address, newMockUniswapV2PoolUSDT._address]);
            let txUSDC = await send(newMockUniswapV2Factory1, 'addPair', [WETHToken._address, usdc._address, newMockUniswapV2PoolUSDC._address]);

            let result = await send(uniswapV2PriceOracle, '_updatePool', [
                '0',
                newMockUniswapV2Factory1._address
            ]);

            expect(
                await send(uniswapV2PriceOracle, 'update', [usdt._address])
            ).toHaveLog("PriceUpdated", {
                asset: usdt._address,
                price: "480795523705607", // Price in ETH with 18 decimals of precision
            });

            expect(
                await send(uniswapV2PriceOracle, 'update', [dai._address])
            ).toHaveLog("PriceUpdated", {
                asset: dai._address,
                price: "481290002365351", // Price in ETH with 18 decimals of precision
            });

            expect(
                await send(uniswapV2PriceOracle, 'update', [usdc._address])
            ).toHaveLog("PriceUpdated", {
                asset: usdc._address,
                price: "481487710010249", // Price in ETH with 18 decimals of precision
            });

            newMockUniswapV2Factory2 = await deploy('MockUniswapV2FactoryV2');
            newMockUniswapV2Pool1 = await deploy('MockUniswapV2Pool');
            newMockUniswapV2Pool2 = await deploy('MockUniswapV2Pool');
            newMockUniswapV2Pool3 = await deploy('MockUniswapV2Pool');

            await send(newMockUniswapV2Pool1, 'setData', [
                newAsset._address,
                usdt._address,
                '1000000000000000000',
                '1000000',
                '0',
                '0'
            ]);

            await send(newMockUniswapV2Pool2, 'setData', [
                newAsset._address,
                dai._address,
                '1000000000000000000',
                '1000000000000000000',
                '0',
                '0'
            ]);

            await send(newMockUniswapV2Pool3, 'setData', [
                newAsset._address,
                usdc._address,
                '1000000000000000000',
                '1000000',
                '0',
                '0'
            ]);

            let tx3 = await send(newMockUniswapV2Factory2, 'addPair', [newAsset._address, usdt._address, newMockUniswapV2Pool1._address]);
            let tx4 = await send(newMockUniswapV2Factory2, 'addPair', [newAsset._address, dai._address, newMockUniswapV2Pool2._address]);
            let tx5 = await send(newMockUniswapV2Factory2, 'addPair', [newAsset._address, usdc._address, newMockUniswapV2Pool3._address]);

            await send(uniswapV2PriceOracle, '_addPool', [newMockUniswapV2Factory2._address]);

            await send(uniswapV2PriceOracle, '_addStableCoin', [usdt._address]);
            await send(uniswapV2PriceOracle, '_addStableCoin', [dai._address]);
            await send(uniswapV2PriceOracle, '_addStableCoin', [usdc._address]);

            let tx = await send(uniswapV2PriceOracle, '_setMinReserveLiquidity', [
                '1',
            ]);
        });

        it("remove liquidity for pair", async () => {
            // update asset (set #1 pair)
            expect(
                await send(uniswapV2PriceOracle, 'update', [newAsset._address])
            ).toHaveLog("PriceUpdated", {
                asset: newAsset._address,
                price: "481487228522538", // Get USDC pool, because reserve is max
            });

            // remove liquidity from pair usdc/new asset
            await send(newMockUniswapV2Pool3, 'setData', [
                newAsset._address,
                usdc._address,
                '0',
                '0',
                '0',
                '0'
            ]);

            // update asset (search new pair and set pair dai/new asset)
            expect(
                await send(uniswapV2PriceOracle, 'update', [newAsset._address])
            ).toHaveLog("PriceUpdated", {
                asset: newAsset._address,
                price: "481290002365351", // Get DAI pool, because reserve is max
            });

            // remove liquidity from #2 pair
            await send(newMockUniswapV2Pool2, 'setData', [
                newAsset._address,
                dai._address,
                '0',
                '0',
                '0',
                '0'
            ]);

            // update asset (search new pair and set pair usdt/new asset)
            expect(
                await send(uniswapV2PriceOracle, 'update', [newAsset._address])
            ).toHaveLog("PriceUpdated", {
                asset: newAsset._address,
                price: "480795042910083", // Get USDT pool, because reserve is max
            });

            // add liquidity to #1 and #2 pair
            await send(newMockUniswapV2Pool2, 'setData', [
                newAsset._address,
                dai._address,
                '1000000000000000000',
                '1000000000000000000',
                '0',
                '0'
            ]);

            await send(newMockUniswapV2Pool3, 'setData', [
                newAsset._address,
                usdc._address,
                '1000000000000000000',
                '1000000',
                '0',
                '0'
            ]);

            // update asset, check pair - fail (period is not elapsed)
            expect(
                await send(uniswapV2PriceOracle, 'update', [newAsset._address])
            ).toHaveLog("Failure", {
                error : '4',
                info : '4',
                detail: '0'
            });

        });
    });
});