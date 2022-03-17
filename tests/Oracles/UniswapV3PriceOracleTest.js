const BigNumber = require('bignumber.js');

const {
    makeToken,
    makeRegistryProxy,
} = require('../Utils/DeFiPie');

const {
    constants,    // Common constants, like the zero address and largest integers
} = require('@openzeppelin/test-helpers');

describe('UniswapV3PriceOracle', () => {
    let root, admin, accounts;
    let uniswapV3PriceOracle, mockPriceFeed, registryProxy;
    let mockUniswapV3Factory, mockUniswapV3Pool, WETHToken, asset;

    let usdc, usdt, wbtc, uni, dai, matic;

    // real addresses
    // uni = 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984
    // wbtc = 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599
    // dai = 0x6B175474E89094C44Da98b954EedeAC495271d0F
    // matic = 0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0
    // usdc = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
    // weth = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
    // usdt = 0xdAC17F958D2ee523a2206206994597C13D831ec7

    // sort by addresses: uni(18), wbtc(8), dai(18), matic(18), usdc(6), weth(18), usdt(6)
    beforeAll(async () => {
        dai = await makeToken({decimals: 18});
        while (dai._address.toLowerCase() < '0x3000000000000000000000000000000000000000'
            || dai._address.toLowerCase() > '0x4000000000000000000000000000000000000000'
        ) {
            dai = await makeToken({decimals: 18});
        }

        matic = await makeToken({decimals: 18});
        while (matic._address.toLowerCase() < '0x4000000000000000000000000000000000000000'
            || matic._address.toLowerCase() > '0x5000000000000000000000000000000000000000'
        ) {
            matic = await makeToken({decimals: 18});
        }

        wbtc = await makeToken({decimals: 8});
        while (wbtc._address.toLowerCase() < '0x2000000000000000000000000000000000000000'
            || wbtc._address.toLowerCase() > '0x3000000000000000000000000000000000000000'
        ) {
            wbtc = await makeToken({decimals: 8});
        }

        uni = await makeToken({decimals: 18});
        while (uni._address.toLowerCase() < '0x0000000000000000000000000000000000000000'
            || uni._address.toLowerCase() > '0x2000000000000000000000000000000000000000'
        ) {
            uni = await makeToken({decimals: 18});
        }

        usdc = await makeToken({decimals: 6});
        while (usdc._address.toLowerCase() < '0x5000000000000000000000000000000000000000'
            || usdc._address.toLowerCase() > '0x7000000000000000000000000000000000000000'
        ) {
            usdc = await makeToken({decimals: 6});
        }

        WETHToken = await makeToken();
        while (WETHToken._address.toLowerCase() < '0x7000000000000000000000000000000000000000'
            || WETHToken._address.toLowerCase() > '0x8000000000000000000000000000000000000000'
        ) {
            WETHToken = await makeToken({decimals: 18});
        }

        usdt = await makeToken({decimals: 6});
        while (usdt._address.toLowerCase() < '0x8000000000000000000000000000000000000000'
            || usdt._address.toLowerCase() > '0x9900000000000000000000000000000000000000'
        ) {
            usdt = await makeToken({decimals: 6});
        }
    });

    beforeEach(async () => {
        [root, admin, ...accounts] = saddle.accounts;

        registryProxy = await makeRegistryProxy();
        mockPriceFeed = await deploy('MockPriceFeed');
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
            let registryProxyAddress = await call(uniswapV3PriceOracle, "registry");
            expect(registryProxyAddress).toEqual(registryProxy._address);
        });

        it("gets address of first pool factory", async () => {
            let uniswapFactory = await call(uniswapV3PriceOracle, "poolFactories", [0]);
            expect(uniswapFactory).toEqual(mockUniswapV3Factory._address);
        });

        it("gets address of WETH Token", async () => {
            let WETHToken_ = await call(uniswapV3PriceOracle, "WETHToken");
            expect(WETHToken_).toEqual(WETHToken._address);
        });
    });

    describe("check get price function for weth pools", () => {
        it("Returns price in ETH for usdt asset", async () => {
            let fee = '3000';

            let mockUniswapPool = await deploy('MockUniswapV3Pool', [WETHToken._address, usdt._address, fee]);

            let result = await send(mockUniswapPool, 'setObserves', [
                [
                    '3600',
                    '600',
                    '1',
                    '0'
                ], [
                    web3.utils.toBN(-4713079654392),
                    web3.utils.toBN(-4713667298864),
                    web3.utils.toBN(-4713784681899),
                    web3.utils.toBN(-4713784877864)
                ], [
                    '1880315400234902443874547292',
                    '1880451637210268857479165737',
                    '1880475273554861707172858711',
                    '1880475313015719488364094603'
                ]
            ]);
            expect(result).toSucceed();

            result = await send(mockUniswapV3Factory, 'setPair', [mockUniswapPool._address]);
            expect(result).toSucceed();

            let pair = await call(mockUniswapV3Factory, "getPool", [WETHToken._address, usdt._address, fee]);
            expect(pair).toEqual(mockUniswapPool._address);

            result = await send(uniswapV3PriceOracle, 'update', [usdt._address]);
            expect(result).toSucceed();

            result = await call(uniswapV3PriceOracle, 'assetPair', [usdt._address]);
            expect(result).toEqual(mockUniswapPool._address);

            let assetInETH = new BigNumber('323762325183023'); // $1 = 0.00032 eth
            let ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [usdt._address]);
            expect(ethPrice).toEqual(assetInETH.toString());

            let period = '1';
            await send(uniswapV3PriceOracle, '_setPeriod', [period]);

            assetInETH = new BigNumber('323762325183023'); // $1 = 0.00032 eth
            ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [usdt._address]);
            expect(ethPrice).toEqual(assetInETH.toString());

            period = '3600';
            await send(uniswapV3PriceOracle, '_setPeriod', [period]);

            assetInETH = new BigNumber('321536165528037'); // $1 = 0.00032 eth
            ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [usdt._address]);
            expect(ethPrice).toEqual(assetInETH.toString());
        });

        it("Returns price in ETH for usdc asset (fee 500)", async () => {
            let fee = '500';

            let mockUniswapPool = await deploy('MockUniswapV3Pool', [usdc._address, WETHToken._address, fee]);

            let result = await send(mockUniswapPool, 'setObserves', [
                [
                    '3600',
                    '600',
                    '1',
                    '0'
                ], [
                    web3.utils.toBN(4709926762642),
                    web3.utils.toBN(4710514560766),
                    web3.utils.toBN(4710631927568),
                    web3.utils.toBN(4710632123536)
                ], [
                    '150949542305261774386621307383',
                    '150949585193668763673097401887',
                    '150949593747372829980115714555',
                    '150949593761625866348150411283'
                ]
            ]);
            expect(result).toSucceed();

            result = await send(mockUniswapV3Factory, 'setPair', [mockUniswapPool._address]);
            expect(result).toSucceed();

            let pair = await call(mockUniswapV3Factory, "getPool", [WETHToken._address, usdc._address, fee]);
            expect(pair).toEqual(mockUniswapPool._address);

            result = await send(uniswapV3PriceOracle, 'update', [usdc._address]);
            expect(result).toSucceed();

            result = await call(uniswapV3PriceOracle, 'assetPair', [usdc._address]);
            expect(result).toEqual(mockUniswapPool._address);

            let assetInETH = new BigNumber('322857103834094'); // $1 = 0.00032 eth
            let ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [usdc._address]);
            expect(ethPrice).toEqual(assetInETH.toString());

            let period = '1';
            await send(uniswapV3PriceOracle, '_setPeriod', [period]);

            assetInETH = new BigNumber('323859463593771'); // $1 = 0.00032 eth
            ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [usdc._address]);
            expect(ethPrice).toEqual(assetInETH.toString());

            period = '3600';
            await send(uniswapV3PriceOracle, '_setPeriod', [period]);

            assetInETH = new BigNumber('322727993271814'); // $1 = 0.00032 eth
            ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [usdc._address]);
            expect(ethPrice).toEqual(assetInETH.toString());
        });

        it("Returns price in ETH for usdc asset (fee 3000)", async () => {
            let fee = '3000';

            let mockUniswapPool = await deploy('MockUniswapV3Pool', [usdc._address, WETHToken._address, fee]);

            let result = await send(mockUniswapPool, 'setObserves', [
                [
                    '3600',
                    '600',
                    '1',
                    '0'
                ], [
                    web3.utils.toBN(4726002400170),
                    web3.utils.toBN(4726590207241),
                    web3.utils.toBN(4726707580009),
                    web3.utils.toBN(4726707775944)
                ], [
                    '198044337547992245805786425257689550241713',
                    '198044337547992245880174482145497387217162',
                    '198044337547992245895021526795060448056237',
                    '198044337547992245895046313180118149326419'
                ]
            ]);
            expect(result).toSucceed();

            result = await send(mockUniswapV3Factory, 'setPair', [mockUniswapPool._address]);
            expect(result).toSucceed();

            let pair = await call(mockUniswapV3Factory, "getPool", [WETHToken._address, usdc._address, fee]);
            expect(pair).toEqual(mockUniswapPool._address);

            result = await send(uniswapV3PriceOracle, 'update', [usdc._address]);
            expect(result).toSucceed();

            result = await call(uniswapV3PriceOracle, 'assetPair', [usdc._address]);
            expect(result).toEqual(mockUniswapPool._address);

            let assetInETH = new BigNumber('323180106262374'); // $1 = 0.00032 eth
            let ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [usdc._address]);
            expect(ethPrice).toEqual(assetInETH.toString());

            let period = '1';
            await send(uniswapV3PriceOracle, '_setPeriod', [period]);

            assetInETH = new BigNumber('322792542097749'); // $1 = 0.00032 eth
            ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [usdc._address]);
            expect(ethPrice).toEqual(assetInETH.toString());

            period = '3600';
            await send(uniswapV3PriceOracle, '_setPeriod', [period]);

            assetInETH = new BigNumber('322857103834094'); // $1 = 0.00032 eth
            ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [usdc._address]);
            expect(ethPrice).toEqual(assetInETH.toString());
        });

        it("Returns price in ETH for wbtc asset (fee 500)", async () => {
            let fee = '500';

            let mockUniswapPool = await deploy('MockUniswapV3Pool', [wbtc._address, WETHToken._address, fee]);

            let result = await send(mockUniswapPool, 'setObserves', [
                [
                    '3600',
                    '600',
                    '1',
                    '0'
                ], [
                    web3.utils.toBN(6183390253311),
                    web3.utils.toBN(6184160461991),
                    web3.utils.toBN(6184314255382),
                    web3.utils.toBN(6184314512139)
                ], [
                    '242804620088105001184162672329900',
                    '242804627366262303323831633944119',
                    '242804628819422344638530325746888',
                    '242804628821848321335215966300815'
                ]
            ]);
            expect(result).toSucceed();

            result = await send(mockUniswapV3Factory, 'setPair', [mockUniswapPool._address]);
            expect(result).toSucceed();

            let pair = await call(mockUniswapV3Factory, "getPool", [WETHToken._address, wbtc._address, fee]);
            expect(pair).toEqual(mockUniswapPool._address);

            result = await send(uniswapV3PriceOracle, 'update', [wbtc._address]);
            expect(result).toSucceed();

            result = await call(uniswapV3PriceOracle, 'assetPair', [wbtc._address]);
            expect(result).toEqual(mockUniswapPool._address);

            let assetInETH = new BigNumber('14123857737719640012'); // 1 btc = 14.1238 eth
            let ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [wbtc._address]);
            expect(ethPrice).toEqual(assetInETH.toString());

            let period = '1';
            await send(uniswapV3PriceOracle, '_setPeriod', [period]);

            assetInETH = new BigNumber('14133747404640553138'); // 1 btc = 14.1337 eth
            ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [wbtc._address]);
            expect(ethPrice).toEqual(assetInETH.toString());

            period = '3600';
            await send(uniswapV3PriceOracle, '_setPeriod', [period]);

            assetInETH = new BigNumber('14106920119904254938'); // 1 btc = 14.1069 eth
            ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [wbtc._address]);
            expect(ethPrice).toEqual(assetInETH.toString());
        });

        it("Returns price in ETH for wbtc asset (fee 3000)", async () => {
            let fee = '3000';

            let mockUniswapPool = await deploy('MockUniswapV3Pool', [wbtc._address, WETHToken._address, fee]);

            let result = await send(mockUniswapPool, 'setObserves', [
                [
                    '3600',
                    '600',
                    '1',
                    '0'
                ], [
                    web3.utils.toBN(6205665229584),
                    web3.utils.toBN(6206435470874),
                    web3.utils.toBN(6206589262327),
                    web3.utils.toBN(6206589519074)
                ], [
                    '717868617570253375592091816069',
                    '717869708740865252617621212199',
                    '717869926611264090730385248293',
                    '717869926974987628022727091425'
                ]
            ]);
            expect(result).toSucceed();

            result = await send(mockUniswapV3Factory, 'setPair', [mockUniswapPool._address]);
            expect(result).toSucceed();

            let pair = await call(mockUniswapV3Factory, "getPool", [WETHToken._address, wbtc._address, fee]);
            expect(pair).toEqual(mockUniswapPool._address);

            result = await send(uniswapV3PriceOracle, 'update', [wbtc._address]);
            expect(result).toSucceed();

            result = await call(uniswapV3PriceOracle, 'assetPair', [wbtc._address]);
            expect(result).toEqual(mockUniswapPool._address);

            let assetInETH = new BigNumber('14119621427688570988'); // 1 btc = 14.1196 eth
            let ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [wbtc._address]);
            expect(ethPrice).toEqual(assetInETH.toString());

            let period = '1';
            await send(uniswapV3PriceOracle, '_setPeriod', [period]);

            assetInETH = new BigNumber('14119621427688570988'); // 1 btc = 14.1196 eth
            ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [wbtc._address]);
            expect(ethPrice).toEqual(assetInETH.toString());

            period = '3600';
            await send(uniswapV3PriceOracle, '_setPeriod', [period]);

            assetInETH = new BigNumber('14119621427688570988'); // 1 btc = 14.1196 eth
            ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [wbtc._address]);
            expect(ethPrice).toEqual(assetInETH.toString());
        });

        it("Returns price in ETH for uni asset", async () => {
            let fee = '3000';

            let mockUniswapPool = await deploy('MockUniswapV3Pool', [uni._address, WETHToken._address, fee]);

            let result = await send(mockUniswapPool, 'setObserves', [
                [
                    '3600',
                    '600',
                    '1',
                    '0'
                ], [
                    web3.utils.toBN(-1207132508260),
                    web3.utils.toBN(-1207299372499),
                    web3.utils.toBN(-1207332690676),
                    web3.utils.toBN(-1207332746299)
                ], [
                    '12179122625966998763865751',
                    '12179136292395567325236443',
                    '12179139086978614507590695',
                    '12179139091644028609731520'
                ]
            ]);
            expect(result).toSucceed();

            result = await send(mockUniswapV3Factory, 'setPair', [mockUniswapPool._address]);
            expect(result).toSucceed();

            let pair = await call(mockUniswapV3Factory, "getPool", [WETHToken._address, uni._address, fee]);
            expect(pair).toEqual(mockUniswapPool._address);

            result = await send(uniswapV3PriceOracle, 'update', [uni._address]);
            expect(result).toSucceed();

            result = await call(uniswapV3PriceOracle, 'assetPair', [uni._address]);
            expect(result).toEqual(mockUniswapPool._address);

            let assetInETH = new BigNumber('3841002404769269'); // $1 = 0.00384 eth
            let ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [uni._address]);
            expect(ethPrice).toEqual(assetInETH.toString());

            let period = '1';
            await send(uniswapV3PriceOracle, '_setPeriod', [period]);

            assetInETH = new BigNumber('3841002404769269'); // $1 = 0.00384 eth
            ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [uni._address]);
            expect(ethPrice).toEqual(assetInETH.toString());

            period = '3600';
            await send(uniswapV3PriceOracle, '_setPeriod', [period]);

            assetInETH = new BigNumber('3841386505009745'); // $1 = 0.00384 eth
            ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [uni._address]);
            expect(ethPrice).toEqual(assetInETH.toString());
        });

        it("Returns price in ETH for dai asset", async () => {
            let fee = '3000';

            let mockUniswapPool = await deploy('MockUniswapV3Pool', [dai._address, WETHToken._address, fee]);

            let result = await send(mockUniswapPool, 'setObserves', [
                [
                    '3600',
                    '600',
                    '1',
                    '0'
                ], [
                    web3.utils.toBN(-1947161186220),
                    web3.utils.toBN(-1947402217145),
                    web3.utils.toBN(-1947450359374),
                    web3.utils.toBN(-1947450439745)
                ], [
                    '56812959069466239959650',
                    '56813151072841514361130',
                    '56813189385645426368230',
                    '56813189449606701680429'
                ]
            ]);
            expect(result).toSucceed();

            result = await send(mockUniswapV3Factory, 'setPair', [mockUniswapPool._address]);
            expect(result).toSucceed();

            let pair = await call(mockUniswapV3Factory, "getPool", [WETHToken._address, dai._address, fee]);
            expect(pair).toEqual(mockUniswapPool._address);

            result = await send(uniswapV3PriceOracle, 'update', [dai._address]);
            expect(result).toSucceed();

            result = await call(uniswapV3PriceOracle, 'assetPair', [dai._address]);
            expect(result).toEqual(mockUniswapPool._address);

            let assetInETH = new BigNumber('323374917755968'); // $1 = 0.00032 eth
            let ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [dai._address]);
            expect(ethPrice).toEqual(assetInETH.toString());

            let period = '1';
            await send(uniswapV3PriceOracle, '_setPeriod', [period]);

            assetInETH = new BigNumber('323374917755968'); // $1 = 0.00032 eth
            ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [dai._address]);
            expect(ethPrice).toEqual(assetInETH.toString());

            period = '3600';
            await send(uniswapV3PriceOracle, '_setPeriod', [period]);

            assetInETH = new BigNumber('324087090069325'); // $1 = 0.00032 eth
            ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [dai._address]);
            expect(ethPrice).toEqual(assetInETH.toString());
        });

        it("Returns price in ETH for matic asset", async () => {
            let fee = '3000';

            let mockUniswapPool = await deploy('MockUniswapV3Pool', [matic._address, WETHToken._address, fee]);

            let result = await send(mockUniswapPool, 'setObserves', [
                [
                    '3600',
                    '600',
                    '1',
                    '0'
                ], [
                    web3.utils.toBN(-1966012862906),
                    web3.utils.toBN(-1966238537967),
                    web3.utils.toBN(-1966283548416),
                    web3.utils.toBN(-1966283623557)
                ], [
                    '25700462348478365346627',
                    '25701612284649637113871',
                    '25701844133700936420868',
                    '25701844515134857862913'
                ]
            ]);
            expect(result).toSucceed();

            result = await send(mockUniswapV3Factory, 'setPair', [mockUniswapPool._address]);
            expect(result).toSucceed();

            let pair = await call(mockUniswapV3Factory, "getPool", [WETHToken._address, matic._address, fee]);
            expect(pair).toEqual(mockUniswapPool._address);

            result = await send(uniswapV3PriceOracle, 'update', [matic._address]);
            expect(result).toSucceed();

            result = await call(uniswapV3PriceOracle, 'assetPair', [matic._address]);
            expect(result).toEqual(mockUniswapPool._address);

            let assetInETH = new BigNumber('545436421668377'); // $1 = 0.000545436 eth
            let ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [matic._address]);
            expect(ethPrice).toEqual(assetInETH.toString());

            let period = '1';
            await send(uniswapV3PriceOracle, '_setPeriod', [period]);

            assetInETH = new BigNumber('545545514407075'); // $1 = 0.000545545 eth
            ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [matic._address]);
            expect(ethPrice).toEqual(assetInETH.toString());

            period = '3600';
            await send(uniswapV3PriceOracle, '_setPeriod', [period]);

            assetInETH = new BigNumber('541686051530062'); // $1 = 0.000541686 eth
            ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [matic._address]);
            expect(ethPrice).toEqual(assetInETH.toString());
        });
    });

    describe("check get price function for stable pools", () => {
        it("Returns price in ETH for usdt asset throw dai", async () => {
            let fee = '3000';

            let mockUniswapPoolWETH = await deploy('MockUniswapV3Pool', [dai._address, WETHToken._address, fee]);

            let result = await send(mockUniswapPoolWETH, 'setObserves', [
                [
                    '3600',
                    '600',
                    '1',
                    '0'
                ], [
                    web3.utils.toBN(-1947161186220),
                    web3.utils.toBN(-1947402217145),
                    web3.utils.toBN(-1947450359374),
                    web3.utils.toBN(-1947450439745)
                ], [
                    '56812959069466239959650',
                    '56813151072841514361130',
                    '56813189385645426368230',
                    '56813189449606701680429'
                ]
            ]);
            expect(result).toSucceed();

            result = await send(mockUniswapV3Factory, 'setPair', [mockUniswapPoolWETH._address]);
            expect(result).toSucceed();

            let pairWETH = await call(mockUniswapV3Factory, "getPool", [WETHToken._address, dai._address, fee]);
            expect(pairWETH).toEqual(mockUniswapPoolWETH._address);

            result = await send(uniswapV3PriceOracle, 'update', [dai._address]);
            expect(result).toSucceed();

            result = await call(uniswapV3PriceOracle, 'assetPair', [dai._address]);
            expect(result).toEqual(mockUniswapPoolWETH._address);

            result = await send(uniswapV3PriceOracle, '_addStableCoin', [dai._address]);
            expect(result).toSucceed();

            fee = '100';

            let mockUniswapPoolStable = await deploy('MockUniswapV3Pool', [dai._address, usdt._address, fee]);

            result = await send(mockUniswapPoolStable, 'setObserves', [
                [
                    '3600',
                    '600',
                    '1',
                    '0'
                ], [
                    web3.utils.toBN(-2568082233455),
                    web3.utils.toBN(-2568911208455),
                    web3.utils.toBN(-2569076727130),
                    web3.utils.toBN(-2569077003455)
                ], [
                    '946384164589661584961824',
                    '946384733949839345752555',
                    '946384847622632353750980',
                    '946384847812403293664166'
                ]
            ]);
            expect(result).toSucceed();

            result = await send(mockUniswapV3Factory, 'setPair', [mockUniswapPoolStable._address]);
            expect(result).toSucceed();

            let pairStable = await call(mockUniswapV3Factory, "getPool", [dai._address, usdt._address, fee]);
            expect(pairStable).toEqual(mockUniswapPoolStable._address);

            result = await send(uniswapV3PriceOracle, 'update', [usdt._address]);
            expect(result).toSucceed();

            result = await call(uniswapV3PriceOracle, 'assetPair', [usdt._address]);
            expect(result).toEqual(mockUniswapPoolStable._address);

            let assetInETH = new BigNumber('323406400215893'); // $1 = 0.00032 eth
            let ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [usdt._address]);
            expect(ethPrice).toEqual(assetInETH.toString());

            let period = '1';
            await send(uniswapV3PriceOracle, '_setPeriod', [period]);

            assetInETH = new BigNumber('323406400215893'); // $1 = 0.00032 eth
            ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [usdt._address]);
            expect(ethPrice).toEqual(assetInETH.toString());

            period = '3600';
            await send(uniswapV3PriceOracle, '_setPeriod', [period]);

            assetInETH = new BigNumber('324118641863434'); // $1 = 0.00032 eth
            ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [usdt._address]);
            expect(ethPrice).toEqual(assetInETH.toString());
        });

        it("Returns price in ETH for dai asset throw usdt", async () => {
            let fee = '3000';

            let mockUniswapPool = await deploy('MockUniswapV3Pool', [WETHToken._address, usdt._address, fee]);

            let result = await send(mockUniswapPool, 'setObserves', [
                [
                    '3600',
                    '600',
                    '1',
                    '0'
                ], [
                    web3.utils.toBN(-4713079654392),
                    web3.utils.toBN(-4713667298864),
                    web3.utils.toBN(-4713784681899),
                    web3.utils.toBN(-4713784877864)
                ], [
                    '1880315400234902443874547292',
                    '1880451637210268857479165737',
                    '1880475273554861707172858711',
                    '1880475313015719488364094603'
                ]
            ]);
            expect(result).toSucceed();

            result = await send(mockUniswapV3Factory, 'setPair', [mockUniswapPool._address]);
            expect(result).toSucceed();

            let pair = await call(mockUniswapV3Factory, "getPool", [WETHToken._address, usdt._address, fee]);
            expect(pair).toEqual(mockUniswapPool._address);

            result = await send(uniswapV3PriceOracle, 'update', [usdt._address]);
            expect(result).toSucceed();

            result = await call(uniswapV3PriceOracle, 'assetPair', [usdt._address]);
            expect(result).toEqual(mockUniswapPool._address);

            result = await send(uniswapV3PriceOracle, '_addStableCoin', [usdt._address]);
            expect(result).toSucceed();

            fee = '100';

            let mockUniswapPoolStable = await deploy('MockUniswapV3Pool', [dai._address, usdt._address, fee]);

            result = await send(mockUniswapPoolStable, 'setObserves', [
                [
                    '3600',
                    '600',
                    '1',
                    '0'
                ], [
                    web3.utils.toBN(-2568082233455),
                    web3.utils.toBN(-2568911208455),
                    web3.utils.toBN(-2569076727130),
                    web3.utils.toBN(-2569077003455)
                ], [
                    '946384164589661584961824',
                    '946384733949839345752555',
                    '946384847622632353750980',
                    '946384847812403293664166'
                ]
            ]);
            expect(result).toSucceed();

            result = await send(mockUniswapV3Factory, 'setPair', [mockUniswapPoolStable._address]);
            expect(result).toSucceed();

            let pairStable = await call(mockUniswapV3Factory, "getPool", [dai._address, usdt._address, fee]);
            expect(pairStable).toEqual(mockUniswapPoolStable._address);

            result = await send(uniswapV3PriceOracle, 'update', [dai._address]);
            expect(result).toSucceed();

            result = await call(uniswapV3PriceOracle, 'assetPair', [dai._address]);
            expect(result).toEqual(mockUniswapPoolStable._address);

            let assetInETH = new BigNumber('323730806920666'); // $1 = 0.00032 eth
            let ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [dai._address]);
            expect(ethPrice).toEqual(assetInETH.toString());

            let period = '1';
            await send(uniswapV3PriceOracle, '_setPeriod', [period]);

            assetInETH = new BigNumber('323730806920666'); // $1 = 0.00032 eth
            ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [dai._address]);
            expect(ethPrice).toEqual(assetInETH.toString());

            period = '3600';
            await send(uniswapV3PriceOracle, '_setPeriod', [period]);

            assetInETH = new BigNumber('321504863982322'); // $1 = 0.00032 eth
            ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [dai._address]);
            expect(ethPrice).toEqual(assetInETH.toString());
        });

        it("Returns price for wbtc asset (fee 3000) throw usdc", async () => {
            let fee = '500';

            let mockUniswapPoolUSDC = await deploy('MockUniswapV3Pool', [usdc._address, WETHToken._address, fee]);

            let result = await send(mockUniswapPoolUSDC, 'setObserves', [
                [
                    '3600',
                    '600',
                    '1',
                    '0'
                ], [
                    web3.utils.toBN(4709926762642),
                    web3.utils.toBN(4710514560766),
                    web3.utils.toBN(4710631927568),
                    web3.utils.toBN(4710632123536)
                ], [
                    '150949542305261774386621307383',
                    '150949585193668763673097401887',
                    '150949593747372829980115714555',
                    '150949593761625866348150411283'
                ]
            ]);
            expect(result).toSucceed();

            result = await send(mockUniswapV3Factory, 'setPair', [mockUniswapPoolUSDC._address]);
            expect(result).toSucceed();

            let pairUSDC = await call(mockUniswapV3Factory, "getPool", [WETHToken._address, usdc._address, fee]);
            expect(pairUSDC).toEqual(mockUniswapPoolUSDC._address);

            result = await send(uniswapV3PriceOracle, 'update', [usdc._address]);
            expect(result).toSucceed();

            result = await call(uniswapV3PriceOracle, 'assetPair', [usdc._address]);
            expect(result).toEqual(mockUniswapPoolUSDC._address);

            result = await send(uniswapV3PriceOracle, '_addStableCoin', [usdc._address]);
            expect(result).toSucceed();

            fee = '3000';

            let mockUniswapPoolWBTC = await deploy('MockUniswapV3Pool', [wbtc._address, usdc._address, fee]);

            result = await send(mockUniswapPoolWBTC, 'setObserves', [
                [
                    '3600',
                    '600',
                    '1',
                    '0'
                ], [
                    web3.utils.toBN(1579903099690),
                    web3.utils.toBN(1580085343381),
                    web3.utils.toBN(1580121736225),
                    web3.utils.toBN(1580121796981)
                ], [
                    '6413623460856546250864317890010535',
                    '6413692163294450587812958273073041',
                    '6413705880881218820423703469557855',
                    '6413705903782031455202686349685542'
                ]
            ]);
            expect(result).toSucceed();

            result = await send(mockUniswapV3Factory, 'setPair', [mockUniswapPoolWBTC._address]);
            expect(result).toSucceed();

            let pair = await call(mockUniswapV3Factory, "getPool", [usdc._address, wbtc._address, fee]);
            expect(pair).toEqual(mockUniswapPoolWBTC._address);

            result = await send(uniswapV3PriceOracle, 'update', [wbtc._address]);
            expect(result).toSucceed();

            result = await call(uniswapV3PriceOracle, 'assetPair', [wbtc._address]);
            expect(result).toEqual(mockUniswapPoolWBTC._address);

            let assetInETH = new BigNumber('14043584757515749831'); // 1 btc = 43,430 usdc = 14.04 eth
            let ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [wbtc._address]);
            expect(ethPrice).toEqual(assetInETH.toString());

            let period = '1';
            await send(uniswapV3PriceOracle, '_setPeriod', [period]);

            assetInETH = new BigNumber('14087185236103269616'); // 1 btc = 14.087 eth
            ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [wbtc._address]);
            expect(ethPrice).toEqual(assetInETH.toString());

            period = '3600';
            await send(uniswapV3PriceOracle, '_setPeriod', [period]);

            assetInETH = new BigNumber('14028146079035285487'); // 1 btc = 14.028 eth
            ethPrice = await call(uniswapV3PriceOracle, "getCourseInETH", [wbtc._address]);
            expect(ethPrice).toEqual(assetInETH.toString());
        });
    });

    describe("check init function", () => {
        it("Check initialized once", async () => {
            let testOracle = await deploy('UniswapV3PriceOracle');
            await send(testOracle, 'initialize', [
                mockUniswapV3Factory._address,
                WETHToken._address
            ]);

            await expect(
                send(testOracle, 'initialize', [
                    mockUniswapV3Factory._address,
                    WETHToken._address
                ])
            ).rejects.toRevert('revert Oracle: may only be initialized once');
        });

        it('Invalid addresses for factory', async () => {
            let testOracle = await deploy('UniswapV3PriceOracle');

            await expect(
                send(testOracle, 'initialize', [
                    constants.ZERO_ADDRESS,
                    WETHToken._address
                ]),
            ).rejects.toRevert('revert Oracle: invalid address for factory');
        });

        it('Check event', async () => {
            let testOracle = await deploy('UniswapV3PriceOracle');

            let result = await send(testOracle, 'initialize', [
                mockUniswapV3Factory._address,
                WETHToken._address
            ]);

            expect(result).toHaveLog('PoolAdded', {
                id: '0',
                poolFactory: mockUniswapV3Factory._address
            });
        });

        it('Check init data ', async () => {
            let testOracle = await deploy('UniswapV3PriceOracleHarness', [
                mockUniswapV3Factory._address,
                WETHToken._address
            ]);

            let factory = await call(testOracle, "poolFactories", [0]);
            expect(factory).toEqual(mockUniswapV3Factory._address);

            let seconds = '600';

            let period = await call(testOracle, "period");
            expect(period).toEqual(seconds);

            let fee0 = '100';
            let fee1 = '500';
            let fee2 = '3000';
            let fee3 = '10000';

            let fee = await call(testOracle, "feeArray", [0]);
            expect(fee).toEqual(fee0);

            fee = await call(testOracle, "feeArray", [1]);
            expect(fee).toEqual(fee1);

            fee = await call(testOracle, "feeArray", [2]);
            expect(fee).toEqual(fee2);

            fee = await call(testOracle, "feeArray", [3]);
            expect(fee).toEqual(fee3);
        });
    });

    describe("check _setNewWETHAddress function", () => {
        it("Check set new addresses", async () => {
            let tx = await send(uniswapV3PriceOracle, '_setNewWETHAddress', [
                mockUniswapV3Factory._address
            ]);

            let WETHToken = await call(uniswapV3PriceOracle, "WETHToken");
            expect(WETHToken).toEqual(mockUniswapV3Factory._address);
        });

        it("set new addresses values, not UNAUTHORIZED", async () => {
            let result = await send(uniswapV3PriceOracle, '_setNewWETHAddress', [
                mockUniswapV3Factory._address,
            ], {from: accounts[2]});

            expect(result).toHaveOracleFailure('UNAUTHORIZED', 'UPDATE_DATA');
        });
    });

    describe("check _setNewRegistry function", () => {
        it("Check set new registry address", async () => {
            let tx = await send(uniswapV3PriceOracle, '_setNewRegistry', [
                accounts[2],
            ]);

            let registry = await call(uniswapV3PriceOracle, "registry");
            expect(registry).toEqual(accounts[2]);
        });

        it("set new registry address, not UNAUTHORIZED", async () => {
            let result = await send(uniswapV3PriceOracle, '_setNewRegistry', [
                accounts[2],
            ], {from: accounts[2]});

            expect(result).toHaveOracleFailure('UNAUTHORIZED', 'UPDATE_DATA');
        });
    });

    describe("check add pool function", () => {
        it("add pool, not UNAUTHORIZED", async () => {
            let result = await send(uniswapV3PriceOracle, '_addPool', [
                mockUniswapV3Factory._address
            ], {from: accounts[2]});

            expect(result).toHaveOracleFailure('UNAUTHORIZED', 'ADD_POOL_OR_COIN');
        });

        it('add pool, invalid address for factory', async () => {
            await expect(
                send(uniswapV3PriceOracle, '_addPool', [
                    constants.ZERO_ADDRESS
                ]),
            ).rejects.toRevert('revert Oracle: invalid address for factory');
        });

        it("add pool, but pool exist", async () => {
            let result = await send(uniswapV3PriceOracle, '_addPool', [
                mockUniswapV3Factory._address
            ]);

            expect(result).toHaveOracleFailure('POOL_OR_COIN_EXIST', 'ADD_POOL_OR_COIN');
        });

        it("add pool twice", async () => {
            let newMockUniswapV3Factory = await deploy('MockUniswapV3Factory');

            let result = await send(uniswapV3PriceOracle, '_addPool', [
                newMockUniswapV3Factory._address
            ]);

            expect(result).toSucceed();

            result = await send(uniswapV3PriceOracle, '_addPool', [
                newMockUniswapV3Factory._address
            ]);

            expect(result).toHaveOracleFailure('POOL_OR_COIN_EXIST', 'ADD_POOL_OR_COIN');
        });

        it("add pool, check data", async () => {
            let poolFactories = await call(uniswapV3PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapV3Factory._address]);

            let newFactory1 = await deploy('MockUniswapV3Factory');

            let tx1 = await send(uniswapV3PriceOracle, '_addPool', [
                newFactory1._address
            ]);

            poolFactories = await call(uniswapV3PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapV3Factory._address, newFactory1._address]);

            let newFactory2 = await deploy('MockUniswapV3Factory');

            let tx2 = await send(uniswapV3PriceOracle, '_addPool', [
                newFactory2._address
            ]);

            poolFactories = await call(uniswapV3PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapV3Factory._address, newFactory1._address, newFactory2._address]);
        });

        it('add pool, check event', async () => {
            let newMockUniswapV3Factory = await deploy('MockUniswapV3Factory');

            let result = await send(uniswapV3PriceOracle, '_addPool', [
                newMockUniswapV3Factory._address
            ]);

            expect(result).toHaveLog('PoolAdded', {
                id: '1',
                poolFactory: newMockUniswapV3Factory._address
            });
        });
    });

    describe("check update pool function", () => {
        it("update pool, not UNAUTHORIZED", async () => {
            let result = await send(uniswapV3PriceOracle, '_updatePool', [
                '0',
                mockUniswapV3Factory._address
            ], {from: accounts[2]});

            expect(result).toHaveOracleFailure('UNAUTHORIZED', 'UPDATE_DATA');
        });

        it('update pool, invalid address for factory', async () => {
            await expect(
                send(uniswapV3PriceOracle, '_updatePool', [
                    '0',
                    constants.ZERO_ADDRESS
                ]),
            ).rejects.toRevert('revert Oracle: invalid address for factory');
        });

        it("update pool, but pool exist", async () => {
            let result = await send(uniswapV3PriceOracle, '_updatePool', [
                '0',
                mockUniswapV3Factory._address
            ]);

            expect(result).toHaveOracleFailure('POOL_OR_COIN_EXIST', 'UPDATE_DATA');

            let newMockUniswapV3Factory = await deploy('MockUniswapV3Factory');

            let tx = await send(uniswapV3PriceOracle, '_addPool', [
                newMockUniswapV3Factory._address
            ]);

            result = await send(uniswapV3PriceOracle, '_updatePool', [
                '0',
                newMockUniswapV3Factory._address
            ]);

            expect(result).toHaveOracleFailure('POOL_OR_COIN_EXIST', 'UPDATE_DATA');
        });

        it("update pool, check data", async () => {
            let newFactory1 = await deploy('MockUniswapV3Factory');

            let tx1 = await send(uniswapV3PriceOracle, '_addPool', [
                newFactory1._address
            ]);

            let newFactory2 = await deploy('MockUniswapV3Factory');

            let tx2 = await send(uniswapV3PriceOracle, '_addPool', [
                newFactory2._address
            ]);

            let poolFactories = await call(uniswapV3PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapV3Factory._address, newFactory1._address, newFactory2._address]);

            let newFactory3 = await deploy('MockUniswapV3Factory');

            let tx3 = await send(uniswapV3PriceOracle, '_updatePool', [
                '0',
                newFactory3._address
            ]);

            let newFactory4 = await deploy('MockUniswapV3Factory');

            let tx4 = await send(uniswapV3PriceOracle, '_updatePool', [
                '1',
                newFactory4._address
            ]);

            let newFactory5 = await deploy('MockUniswapV3Factory');

            let tx5 = await send(uniswapV3PriceOracle, '_updatePool', [
                '2',
                newFactory5._address
            ]);

            poolFactories = await call(uniswapV3PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([newFactory3._address, newFactory4._address, newFactory5._address]);
        });

        it('update pool, check event', async () => {
            let newMockUniswapV3Factory = await deploy('MockUniswapV3Factory');

            let result = await send(uniswapV3PriceOracle, '_updatePool', [
                '0',
                newMockUniswapV3Factory._address
            ]);

            expect(result).toHaveLog('PoolUpdated', {
                id: '0',
                poolFactory: newMockUniswapV3Factory._address
            });
        });
    });

    describe("check remove pool function", () => {
        it("remove pool, not UNAUTHORIZED", async () => {
            let result = await send(uniswapV3PriceOracle, '_removePool', [
                '0'
            ], {from: accounts[2]});

            expect(result).toHaveOracleFailure('UNAUTHORIZED', 'UPDATE_DATA');
        });

        it('remove pool, remove single pool', async () => {
            await expect(
                send(uniswapV3PriceOracle, '_removePool', [
                    '0'
                ]),
            ).rejects.toRevert('revert Oracle: must have one pool');
        });

        it("remove last pool, check data", async () => {
            let newMockUniswapV3Factory = await deploy('MockUniswapV3Factory');

            let result = await send(uniswapV3PriceOracle, '_addPool', [
                newMockUniswapV3Factory._address
            ]);

            expect(result).toSucceed();

            let poolFactories = await call(uniswapV3PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapV3Factory._address, newMockUniswapV3Factory._address]);

            result = await send(uniswapV3PriceOracle, '_removePool', [
                '1'
            ]);

            expect(result).toHaveLog('PoolRemoved', {
                id: '1',
                poolFactory: newMockUniswapV3Factory._address
            });

            poolFactories = await call(uniswapV3PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapV3Factory._address]);
        });

        it("remove pool, check data", async () => {
            let poolFactories = await call(uniswapV3PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapV3Factory._address]);

            let newFactory1 = await deploy('MockUniswapV3Factory');

            let tx1 = await send(uniswapV3PriceOracle, '_addPool', [
                newFactory1._address
            ]);

            poolFactories = await call(uniswapV3PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapV3Factory._address, newFactory1._address]);

            let newFactory2 = await deploy('MockUniswapV3Factory');

            let tx2 = await send(uniswapV3PriceOracle, '_addPool', [
                newFactory2._address
            ]);

            poolFactories = await call(uniswapV3PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapV3Factory._address, newFactory1._address, newFactory2._address]);

            let tx21 = await send(uniswapV3PriceOracle, '_removePool', [
                '1'
            ]);

            poolFactories = await call(uniswapV3PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapV3Factory._address, newFactory2._address]);

            let newFactory3 = await deploy('MockUniswapV3Factory');

            let tx3 = await send(uniswapV3PriceOracle, '_addPool', [
                newFactory3._address
            ]);

            poolFactories = await call(uniswapV3PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapV3Factory._address, newFactory2._address, newFactory3._address]);

            let tx4 = await send(uniswapV3PriceOracle, '_removePool', [
                '2'
            ]);

            poolFactories = await call(uniswapV3PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapV3Factory._address, newFactory2._address]);

            let tx5 = await send(uniswapV3PriceOracle, '_addPool', [
                newFactory3._address
            ]);

            poolFactories = await call(uniswapV3PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapV3Factory._address, newFactory2._address, newFactory3._address]);

            let tx6 = await send(uniswapV3PriceOracle, '_removePool', [
                '1'
            ]);

            poolFactories = await call(uniswapV3PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapV3Factory._address, newFactory3._address]);
        });

        it('remove pool, check event', async () => {
            let newFactory1 = await deploy('MockUniswapV3Factory');

            let tx1 = await send(uniswapV3PriceOracle, '_addPool', [
                newFactory1._address
            ]);

            let newFactory2 = await deploy('MockUniswapV3Factory');

            let tx2 = await send(uniswapV3PriceOracle, '_addPool', [
                newFactory2._address
            ]);

            let poolFactories = await call(uniswapV3PriceOracle, "getAllPoolFactories");
            expect(poolFactories).toEqual([mockUniswapV3Factory._address, newFactory1._address, newFactory2._address]);

            let result = await send(uniswapV3PriceOracle, '_removePool', [
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

    describe("check _setMinReserveLiquidity function", () => {
        it("Check set min reserve liquidity", async () => {
            let liquidity = '100';
            let tx = await send(uniswapV3PriceOracle, '_setMinReserveLiquidity', [
                liquidity,
            ]);

            let liquidity_ = await call(uniswapV3PriceOracle, "minReserveLiquidity");
            expect(liquidity_).toEqual(liquidity);
        });

        it("set new min reserve liquidity, not UNAUTHORIZED", async () => {
            let liquidity = '100';
            let result = await send(uniswapV3PriceOracle, '_setMinReserveLiquidity', [
                liquidity,
            ], {from: accounts[2]});

            expect(result).toHaveOracleFailure('UNAUTHORIZED', 'UPDATE_DATA');
        });
    });

    describe("check _setPeriod function", () => {
        it("Check set period", async () => {
            let period = '100';
            let tx = await send(uniswapV3PriceOracle, '_setPeriod', [
                period,
            ]);

            let period_ = await call(uniswapV3PriceOracle, "period");
            expect(period_).toEqual(period);
        });

        it("set period, not UNAUTHORIZED", async () => {
            let period = '100';
            let result = await send(uniswapV3PriceOracle, '_setPeriod', [
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
            let result = await send(uniswapV3PriceOracle, '_addStableCoin', [
                stableCoin._address
            ], {from: accounts[2]});

            expect(result).toHaveOracleFailure('UNAUTHORIZED', 'ADD_POOL_OR_COIN');
        });

        it('add stable coin, invalid address for stable coin', async () => {
            await expect(
                send(uniswapV3PriceOracle, '_addStableCoin', [
                    constants.ZERO_ADDRESS
                ]),
            ).rejects.toRevert('revert Oracle: invalid address for stable coin');
        });

        it("add stable coin twice", async () => {
            let result = await send(uniswapV3PriceOracle, '_addStableCoin', [
                stableCoin._address
            ]);

            expect(result).toSucceed();

            result = await send(uniswapV3PriceOracle, '_addStableCoin', [
                stableCoin._address
            ]);

            expect(result).toHaveOracleFailure('POOL_OR_COIN_EXIST', 'ADD_POOL_OR_COIN');
        });

        it("add stable coin, check data", async () => {
            let stableCoins = await call(uniswapV3PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([]);

            let tx1 = await send(uniswapV3PriceOracle, '_addStableCoin', [
                stableCoin._address
            ]);

            stableCoins = await call(uniswapV3PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address]);

            let stableCoin2 = await makeToken();

            let tx2 = await send(uniswapV3PriceOracle, '_addStableCoin', [
                stableCoin2._address
            ]);

            stableCoins = await call(uniswapV3PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin2._address]);
        });

        it('add stable coin, check event', async () => {
            let result = await send(uniswapV3PriceOracle, '_addStableCoin', [
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

            let result = await send(uniswapV3PriceOracle, '_addStableCoin', [
                stableCoin._address
            ]);

            expect(result).toSucceed();
        });

        it("remove stable coin, not UNAUTHORIZED", async () => {
            let result = await send(uniswapV3PriceOracle, '_removeStableCoin', [
                '0'
            ], {from: accounts[2]});

            expect(result).toHaveOracleFailure('UNAUTHORIZED', 'UPDATE_DATA');
        });

        it('remove stable coin', async () => {
            let result = await send(uniswapV3PriceOracle, '_removeStableCoin', [
                '0'
            ]);

            expect(result).toSucceed();

            await expect(
                send(uniswapV3PriceOracle, '_removeStableCoin', [
                    '0'
                ]),
            ).rejects.toRevert('revert Oracle: stable coins are empty');
        });

        it("remove last stable coin, check data", async () => {
            let stableCoin2 = await makeToken();

            let result = await send(uniswapV3PriceOracle, '_addStableCoin', [
                stableCoin2._address
            ]);

            expect(result).toSucceed();

            let stableCoins = await call(uniswapV3PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin2._address]);

            result = await send(uniswapV3PriceOracle, '_removeStableCoin', [
                '1'
            ]);

            expect(result).toHaveLog('StableCoinRemoved', {
                id: '1',
                coin: stableCoin2._address
            });

            stableCoins = await call(uniswapV3PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address]);
        });

        it("remove stable coin, check data", async () => {
            let stableCoins = await call(uniswapV3PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address]);

            let stableCoin2 = await makeToken();

            let result = await send(uniswapV3PriceOracle, '_addStableCoin', [
                stableCoin2._address
            ]);

            expect(result).toSucceed();

            stableCoins = await call(uniswapV3PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin2._address]);

            let stableCoin3 = await makeToken();

            result = await send(uniswapV3PriceOracle, '_addStableCoin', [
                stableCoin3._address
            ]);

            expect(result).toSucceed();

            stableCoins = await call(uniswapV3PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin2._address, stableCoin3._address]);

            let tx21 = await send(uniswapV3PriceOracle, '_removeStableCoin', [
                '1'
            ]);

            stableCoins = await call(uniswapV3PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin3._address]);

            let stableCoin4 = await makeToken();

            result = await send(uniswapV3PriceOracle, '_addStableCoin', [
                stableCoin4._address
            ]);

            expect(result).toSucceed();

            stableCoins = await call(uniswapV3PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin3._address, stableCoin4._address]);

            let tx4 = await send(uniswapV3PriceOracle, '_removeStableCoin', [
                '2'
            ]);

            stableCoins = await call(uniswapV3PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin3._address]);

            let tx5 = await send(uniswapV3PriceOracle, '_addStableCoin', [
                stableCoin4._address
            ]);

            stableCoins = await call(uniswapV3PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin3._address, stableCoin4._address]);

            let tx6 = await send(uniswapV3PriceOracle, '_removeStableCoin', [
                '1'
            ]);

            stableCoins = await call(uniswapV3PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin4._address]);
        });

        it('remove pool, check event', async () => {
            let stableCoin2 = await makeToken();

            let result = await send(uniswapV3PriceOracle, '_addStableCoin', [
                stableCoin2._address
            ]);

            let stableCoin3 = await makeToken();

            result = await send(uniswapV3PriceOracle, '_addStableCoin', [
                stableCoin3._address
            ]);

            expect(result).toSucceed();

            let stableCoins = await call(uniswapV3PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin2._address, stableCoin3._address]);

            result = await send(uniswapV3PriceOracle, '_removeStableCoin', [
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

            let result = await send(uniswapV3PriceOracle, '_addStableCoin', [
                stableCoin._address
            ]);

            expect(result).toSucceed();
        });

        it("update stable coin, not UNAUTHORIZED", async () => {
            let result = await send(uniswapV3PriceOracle, '_updateStableCoin', [
                '0',
                stableCoin._address
            ], {from: accounts[2]});

            expect(result).toHaveOracleFailure('UNAUTHORIZED', 'UPDATE_DATA');
        });

        it('update stable coin, invalid address for coin', async () => {
            await expect(
                send(uniswapV3PriceOracle, '_updateStableCoin', [
                    '0',
                    constants.ZERO_ADDRESS
                ]),
            ).rejects.toRevert('revert Oracle: invalid address for stable coin');
        });

        it("update stable coin, but stable coin exist", async () => {
            let result = await send(uniswapV3PriceOracle, '_updateStableCoin', [
                '0',
                stableCoin._address
            ]);

            expect(result).toHaveOracleFailure('POOL_OR_COIN_EXIST', 'UPDATE_DATA');

            let stableCoin2 = await makeToken();

            result = await send(uniswapV3PriceOracle, '_updateStableCoin', [
                '0',
                stableCoin2._address
            ]);

            expect(result).toSucceed();

            result = await send(uniswapV3PriceOracle, '_updateStableCoin', [
                '0',
                stableCoin2._address
            ]);

            expect(result).toHaveOracleFailure('POOL_OR_COIN_EXIST', 'UPDATE_DATA');
        });

        it("update stable coin, check data", async () => {
            let stableCoin2 = await makeToken();

            let result = await send(uniswapV3PriceOracle, '_addStableCoin', [
                stableCoin2._address
            ]);

            expect(result).toSucceed();

            let stableCoin3 = await makeToken();

            result = await send(uniswapV3PriceOracle, '_addStableCoin', [
                stableCoin3._address
            ]);

            expect(result).toSucceed();

            let stableCoins = await call(uniswapV3PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin._address, stableCoin2._address, stableCoin3._address]);

            let stableCoin4 = await makeToken();

            let tx3 = await send(uniswapV3PriceOracle, '_updateStableCoin', [
                '0',
                stableCoin4._address
            ]);

            let stableCoin5 = await makeToken();

            let tx4 = await send(uniswapV3PriceOracle, '_updateStableCoin', [
                '1',
                stableCoin5._address
            ]);

            let stableCoin6 = await makeToken();

            let tx5 = await send(uniswapV3PriceOracle, '_updateStableCoin', [
                '2',
                stableCoin6._address
            ]);

            stableCoins = await call(uniswapV3PriceOracle, "getAllStableCoins");
            expect(stableCoins).toEqual([stableCoin4._address, stableCoin5._address, stableCoin6._address]);
        });

        it('update pool, check event', async () => {
            let stableCoin2 = await makeToken();

            let result = await send(uniswapV3PriceOracle, '_updateStableCoin', [
                '0',
                stableCoin2._address
            ]);

            expect(result).toHaveLog('StableCoinUpdated', {
                id: '0',
                coin: stableCoin2._address
            });
        });
    });

    describe("update asset pair function", () => {
        let mockUniswapPool1, mockUniswapPool2, fee, updateAsset;

        beforeEach(async () => {
            updateAsset = await makeToken();
            fee = '3000';
            mockUniswapPool1 = await deploy('MockUniswapV3Pool', [WETHToken._address, updateAsset._address, fee]);

            let result = await send(mockUniswapPool1, 'setObserves', [
                [
                    '3600',
                    '600',
                    '1',
                    '0'
                ], [
                    web3.utils.toBN(-4713079654392),
                    web3.utils.toBN(-4713667298864),
                    web3.utils.toBN(-4713784681899),
                    web3.utils.toBN(-4713784877864)
                ], [
                    '1880315400234902443874547292',
                    '1880451637210268857479165737',
                    '1880475273554861707172858711',
                    '1880475313015719488364094603'
                ]
            ]);
            expect(result).toSucceed();

            result = await send(mockUniswapV3Factory, 'setPair', [mockUniswapPool1._address]);
            expect(result).toSucceed();

            result = await send(uniswapV3PriceOracle, 'update', [updateAsset._address]);
            expect(result).toSucceed();

            fee = '100';
            mockUniswapPool2 = await deploy('MockUniswapV3Pool', [WETHToken._address, updateAsset._address, fee]);

            result = await send(mockUniswapPool2, 'setObserves', [
                [
                    '3600',
                    '600',
                    '1',
                    '0'
                ], [
                    web3.utils.toBN(-4713079654392),
                    web3.utils.toBN(-4713667298864),
                    web3.utils.toBN(-4713784681899),
                    web3.utils.toBN(-4713784877864)
                ], [
                    '1880315400234902443874547292',
                    '1880451637210268857479165737',
                    '1880475273554861707172858711',
                    '1880475313015719488364094603'
                ]
            ]);
            expect(result).toSucceed();

            result = await send(mockUniswapV3Factory, 'setPair', [mockUniswapPool2._address]);
            expect(result).toSucceed();
        });

        it("update stable coin, not UNAUTHORIZED", async () => {
            let result = await send(uniswapV3PriceOracle, '_updateAssetPair', [
                updateAsset._address,
                mockUniswapPool2._address
            ], {from: accounts[2]});

            expect(result).toHaveOracleFailure('UNAUTHORIZED', 'UPDATE_DATA');
        });

        it('update asset, invalid address pair for asset', async () => {
            await expect(
                send(uniswapV3PriceOracle, '_updateAssetPair', [
                    updateAsset._address,
                    constants.ZERO_ADDRESS
                ]),
            ).rejects.toRevert('revert Oracle: invalid address or asset for pair');
        });

        it('update asset, invalid address asset for pair', async () => {
            await expect(
                send(uniswapV3PriceOracle, '_updateAssetPair', [
                    constants.ZERO_ADDRESS,
                    mockUniswapPool2._address
                ]),
            ).rejects.toRevert('revert Oracle: invalid address or asset for pair');
        });

        it("update asset pair, check data and event", async () => {
            let result = await send(uniswapV3PriceOracle, '_updateAssetPair', [
                updateAsset._address,
                mockUniswapPool2._address
            ]);

            expect(result).toSucceed();

            let pool = await call(uniswapV3PriceOracle, "assetPair", [updateAsset._address]);
            expect(pool).toEqual(mockUniswapPool2._address);

            expect(result).toHaveLog('AssetPairUpdated', {
                asset: updateAsset._address,
                pair: mockUniswapPool2._address
            });
        });
    });

    // todo
    // check update function with errors
    // check search pair with errors
});