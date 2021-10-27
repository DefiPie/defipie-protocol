const {
  address,
  etherMantissa
} = require('./Utils/Ethereum');

const {
  makePToken,
  makePriceOracle,
  makeController
} = require('./Utils/DeFiPie');

describe('PriceOracleProxy', () => {
  let root, accounts;
  let controller, oracle, backingOracle, pETH, pUsdc, pSai, pDai, pUsdt, pOther;
  let daiOracleKey = address(2);

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
    controller = await makeController();
    pETH = await makePToken({kind: "pether", controller: controller, uniswapOracle: controller.priceOracle, registryProxy: controller.registryProxy, supportMarket: true});
    pUsdc = await makePToken({controller: controller, uniswapOracle: controller.priceOracle, registryProxy: controller.registryProxy, pTokenFactory: pETH.pTokenFactory, supportMarket: true});
    pSai = await makePToken({controller: controller, uniswapOracle: controller.priceOracle, registryProxy: controller.registryProxy, pTokenFactory: pETH.pTokenFactory, supportMarket: true});
    pDai = await makePToken({controller: controller, uniswapOracle: controller.priceOracle, registryProxy: controller.registryProxy, pTokenFactory: pETH.pTokenFactory, supportMarket: true});
    pUsdt = await makePToken({controller: controller, uniswapOracle: controller.priceOracle, registryProxy: controller.registryProxy, pTokenFactory: pETH.pTokenFactory, supportMarket: true});
    pOther = await makePToken({controller: controller, uniswapOracle: controller.priceOracle, registryProxy: controller.registryProxy, pTokenFactory: pETH.pTokenFactory, supportMarket: true});

    backingOracle = await makePriceOracle();
    oracle = await deploy('PriceOracleProxy',
      [
        root,
        backingOracle._address,
        pETH._address,
        pUsdc._address,
        pSai._address,
        pDai._address,
        pUsdt._address
      ]
     );
  });

  describe("constructor", () => {
    it("sets address of guardian", async () => {
      let configuredGuardian = await call(oracle, "guardian");
      expect(configuredGuardian).toEqual(root);
    });

    it("sets address of v1 oracle", async () => {
      let configuredOracle = await call(oracle, "v1PriceOracle");
      expect(configuredOracle).toEqual(backingOracle._address);
    });

    it("sets address of pETH", async () => {
      let configuredPEther = await call(oracle, "pETHAddress");
      expect(configuredPEther).toEqual(pETH._address);
    });

    it("sets address of pUSDC", async () => {
      let configuredCUSD = await call(oracle, "pUsdcAddress");
      expect(configuredCUSD).toEqual(pUsdc._address);
    });

    it("sets address of pSAI", async () => {
      let configuredCSAI = await call(oracle, "pSaiAddress");
      expect(configuredCSAI).toEqual(pSai._address);
    });

    it("sets address of pDAI", async () => {
      let configuredCDAI = await call(oracle, "pDaiAddress");
      expect(configuredCDAI).toEqual(pDai._address);
    });

    it("sets address of pUSDT", async () => {
      let configuredCUSDT = await call(oracle, "pUsdtAddress");
      expect(configuredCUSDT).toEqual(pUsdt._address);
    });
  });

  describe("getUnderlyingPrice", () => {
    let setAndVerifyBackingPrice = async (pToken, price) => {
      await send(
        backingOracle,
        "setUnderlyingPrice",
        [pToken._address, etherMantissa(price)]);

      let backingOraclePrice = await call(
        backingOracle,
        "assetPrices",
        [pToken.underlying._address]);

      expect(Number(backingOraclePrice)).toEqual(price * 1e18);
    };

    let readAndVerifyProxyPrice = async (token, price) =>{
      let proxyPrice = await call(oracle, "getUnderlyingPrice", [token._address]);
      expect(Number(proxyPrice)).toEqual(price * 1e18);
    };

    it("always returns 1e18 for pETH", async () => {
      await readAndVerifyProxyPrice(pETH, 1);
    });

    it("uses address(1) for USDC and address(2) for cdai", async () => {
      await send(backingOracle, "setDirectPrice", [address(1), etherMantissa(5e12)]);
      await send(backingOracle, "setDirectPrice", [address(2), etherMantissa(8)]);
      await readAndVerifyProxyPrice(pDai, 8);
      await readAndVerifyProxyPrice(pUsdc, 5e12);
      await readAndVerifyProxyPrice(pUsdt, 5e12);
    });

    it("proxies for whitelisted tokens", async () => {
      await setAndVerifyBackingPrice(pOther, 11);
      await readAndVerifyProxyPrice(pOther, 11);

      await setAndVerifyBackingPrice(pOther, 37);
      await readAndVerifyProxyPrice(pOther, 37);
    });

    it("returns 0 for token without a price", async () => {
      let unlistedToken = await makePToken({controller: controller, uniswapOracle: controller.priceOracle, registryProxy: controller.registryProxy, pTokenFactory: pETH.pTokenFactory});

      await readAndVerifyProxyPrice(unlistedToken, 0);
    });

    it("correctly handle setting SAI price", async () => {
      await send(backingOracle, "setDirectPrice", [daiOracleKey, etherMantissa(0.01)]);

      await readAndVerifyProxyPrice(pDai, 0.01);
      await readAndVerifyProxyPrice(pSai, 0.01);

      await send(oracle, "setSaiPrice", [etherMantissa(0.05)]);

      await readAndVerifyProxyPrice(pDai, 0.01);
      await readAndVerifyProxyPrice(pSai, 0.05);

      await expect(send(oracle, "setSaiPrice", [1])).rejects.toRevert("revert SAI price may only be set once");
    });

    it("only guardian may set the sai price", async () => {
      await expect(send(oracle, "setSaiPrice", [1], {from: accounts[0]})).rejects.toRevert("revert only guardian may set the SAI price");
    });

    it("sai price must be bounded", async () => {
      await expect(send(oracle, "setSaiPrice", [etherMantissa(10)])).rejects.toRevert("revert SAI price must be < 0.1 ETH");
    });
  });
});
