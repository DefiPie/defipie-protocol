const BigNumber = require('bignumber.js');

const {
    makeToken,
    makePToken,
    makeRegistryProxy,
} = require('../Utils/DeFiPie');

const {
    constants,    // Common constants, like the zero address and largest integers
} = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');

describe('PriceOracle', () => {
    let root, admin, accounts;
    let priceOracle, mockPriceFeed, registryProxy;
    let mockUniswapV2Factory, mockUniswapV2Pool, WETHToken, asset, uniswapV2PriceOracle, asset2;
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

        uniswapV2PriceOracle = await deploy('UniswapV2PriceOracleHarness', [
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
            controllerOpts: {kind: "bool"},
            supportMarket: true,
            registryProxy: registryProxy,
            mockPriceFeed: mockPriceFeed,
            mockUniswapV2Factory: mockUniswapV2Factory,
            mockUniswapV2Pool: mockUniswapV2Pool,
            priceOracle: priceOracle,
            WETHToken: WETHToken,
            uniswapFactoryVersion: 2
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
            WETHToken: WETHToken,
            uniswapFactoryVersion: 2
        });

        pOther2 = await makePToken({
            controller: pEth.controller,
            supportMarket: true,
            registryProxy: registryProxy,
            mockPriceFeed: mockPriceFeed,
            mockUniswapV2Factory: mockUniswapV2Factory,
            mockUniswapV2Pool: mockUniswapV2Pool,
            priceOracle: priceOracle,
            underlying: asset2,
            WETHToken: WETHToken,
            uniswapFactoryVersion: 2
        });
    });

    describe("check pool liquidity", () => {
        it("getUnderlyingTypeAndLiquidity Invalid Token", async () => {
            const res = await call(priceOracle, 'getUnderlyingTypeAndLiquidity', [ZERO_ADDRESS]);
            expect(res[0]).toEqual('0');
        });

        it("getUnderlyingTypeAndLiquidity Bad Token", async () => {
            const badPool = await deploy('MockUniswapV2Pool', [ZERO_ADDRESS]); //pool never connected to any oracles
            const res = await call(priceOracle, 'getUnderlyingTypeAndLiquidity', [badPool._address]);
            expect(res[0]).toEqual('0');
        });

        it("getUnderlyingTypeAndLiquidity Reg Token", async () => {
            const res = await call(priceOracle, 'getUnderlyingTypeAndLiquidity', [asset._address]);
            expect(res[0]).toEqual('1');
        });

        it("getUnderlyingTypeAndLiquidity LP Token", async () => {
            await call(priceOracle, 'update', [asset._address]);
            await call(priceOracle, 'update', [asset2._address]);

            const res = await call(priceOracle, 'getUnderlyingTypeAndLiquidity', [mockUniswapV2Pool3._address]);
            expect(res[0]).toEqual('2');
        });

        it("get price and liquidity in stable pool", async () => {
            usdc = await makeToken({decimals: '6', name: 'erc20 usdc', symbol: 'usdc'});
            usdt = await makeToken({decimals: '6', name: 'erc20 usdt', symbol: 'usdt'});

            newMockUniswapV2PoolUSDT = await deploy('MockUniswapV2Pool', [mockUniswapV2Factory._address]);
            newMockUniswapV2PoolUSDC = await deploy('MockUniswapV2Pool', [mockUniswapV2Factory._address]);
            newMockUniswapV2PoolStable = await deploy('MockUniswapV2Pool', [mockUniswapV2Factory._address]);

            // real data (blockTimeStamp 1617976989)
            await send(newMockUniswapV2PoolUSDT, 'setData', [
                WETHToken._address,
                usdt._address,
                '15000000000000000000000',
                '15000000000000000000',
                '108440522331595154328745452759693',
                '328889143286590183358706488927451804772319811247343'
            ]);

            // real data (blockTimeStamp 1617977100)
            await send(newMockUniswapV2PoolUSDC, 'setData', [
                WETHToken._address,
                usdc._address,
                '15000000000000000000000',
                '15000000000000000000',
                '109613359197447592748722255800848',
                '359749687769618128771704981052957704836749272276592'
            ]);

            await send(newMockUniswapV2PoolStable, 'setData', [
                usdt._address,
                usdc._address,
                '1000000000000000000000000',
                '1000000000000000000000000',
                '109613359197447592748722255800848',
                '359749687769618128771704981052957704836749272276592'
            ]);

            let txUSDT = await send(mockUniswapV2Factory, 'addPair', [WETHToken._address, usdt._address, newMockUniswapV2PoolUSDT._address]);
            let txUSDC = await send(mockUniswapV2Factory, 'addPair', [WETHToken._address, usdc._address, newMockUniswapV2PoolUSDC._address]);
            let txStbl = await send(mockUniswapV2Factory, 'addPair', [usdt._address, usdc._address, newMockUniswapV2PoolStable._address]);

            await send(uniswapV2PriceOracle, '_addStableCoin', [usdt._address]);
            await send(uniswapV2PriceOracle, '_addStableCoin', [usdc._address]);

            await send(priceOracle, 'update', [usdt._address]);
            await send(priceOracle, 'update', [usdc._address]);

            const res = await call(uniswapV2PriceOracle, 'getPoolLiquidityETH', [newMockUniswapV2PoolStable._address]);
            expect(res).toEqual('2000000000000000');

            const res2 = await call(uniswapV2PriceOracle, 'getLPTokenPrice', [newMockUniswapV2PoolStable._address]);
            expect(res2).toEqual('2000000000');
        });

        it("get price and liquidity in bad pool", async () => {
            badAsset = await makeToken({decimals: '6', name: 'erc20 poor', symbol: 'poor'});
            badAsset2 = await makeToken({decimals: '6', name: 'erc20 bad', symbol: 'bad'});

            newMockUniswapV2PoolBad = await deploy('MockUniswapV2Pool', [mockUniswapV2Factory._address]);

            await send(newMockUniswapV2PoolUSDC, 'setData', [
                badAsset._address,
                badAsset2._address,
                '1000000000000000000000000',
                '1000000000000000000000000',
                '109613359197447592748722255800848',
                '359749687769618128771704981052957704836749272276592'
            ]);

            let txStbl = await send(mockUniswapV2Factory, 'addPair', [badAsset._address, badAsset2._address, newMockUniswapV2PoolUSDC._address]);

            await send(priceOracle, 'update', [badAsset._address]);
            await send(priceOracle, 'update', [badAsset2._address]);

            const res = await call(uniswapV2PriceOracle, 'getPoolLiquidityETH', [newMockUniswapV2PoolBad._address]);
            expect(res).toEqual('0');

            const res2 = await call(uniswapV2PriceOracle, 'getLPTokenPrice', [newMockUniswapV2PoolBad._address]);
            expect(res2).toEqual('0');
        });

        it("get price and liquidity in pool token/stableCoin", async () => {
            token1 = await makeToken({decimals: '6', name: 'erc20 tkn', symbol: 'tkn'});
            usdt = await makeToken({decimals: '6', name: 'erc20 usdt', symbol: 'usdt'});
            usdc = await makeToken({decimals: '6', name: 'erc20 usdc', symbol: 'usdc'});

            newMockUniswapV2PoolUSDT = await deploy('MockUniswapV2Pool', [mockUniswapV2Factory._address]);
            newMockUniswapV2PoolStable = await deploy('MockUniswapV2Pool', [mockUniswapV2Factory._address]);
            newMockUniswapV2PoolNormal = await deploy('MockUniswapV2Pool', [mockUniswapV2Factory._address]);

            // real data (blockTimeStamp 1617976989)
            await send(newMockUniswapV2PoolUSDT, 'setData', [
                WETHToken._address,
                usdt._address,
                '15000000000000000000000',
                '15000000000000000000',
                '108440522331595154328745452759693',
                '328889143286590183358706488927451804772319811247343'
            ]);

            await send(newMockUniswapV2PoolStable, 'setData', [
                usdt._address,
                usdc._address,
                '1000000000000000000000000',
                '1000000000000000000000000',
                '109613359197447592748722255800848',
                '359749687769618128771704981052957704836749272276592'
            ]);

            await send(newMockUniswapV2PoolNormal, 'setData', [
                token1._address,
                usdt._address,
                '1000000000000000000000000',
                '1000000000000000000000000',
                '109613359197447592748722255800848',
                '359749687769618128771704981052957704836749272276592'
            ]);

            let txStbl = await send(mockUniswapV2Factory, 'addPair', [usdt._address, usdc._address, newMockUniswapV2PoolStable._address]);
            let txUSDT = await send(mockUniswapV2Factory, 'addPair', [WETHToken._address, usdt._address, newMockUniswapV2PoolUSDT._address]);
            let txNorm = await send(mockUniswapV2Factory, 'addPair', [token1._address, usdc._address, newMockUniswapV2PoolNormal._address]);
            
            await send(uniswapV2PriceOracle, '_addStableCoin', [usdt._address]);
            await send(uniswapV2PriceOracle, '_addStableCoin', [usdc._address]);

            await send(priceOracle, 'update', [usdt._address]);
            await send(priceOracle, 'update', [usdc._address]);
            await send(priceOracle, 'update', [token1._address]);

            const res = await call(uniswapV2PriceOracle, 'getLPTokenPrice', [newMockUniswapV2PoolNormal._address]);
            expect(res).toEqual('2000000000');

            const res2 = await call(uniswapV2PriceOracle, 'getPoolLiquidityETH', [newMockUniswapV2PoolNormal._address]);
            expect(res2).toEqual('2000000000000000');
        });
    });
});