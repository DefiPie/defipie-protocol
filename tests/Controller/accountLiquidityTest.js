const {
  makeController,
  makePriceOracle,
  makePToken,
  enterMarkets,
  quickMint
} = require('../Utils/DeFiPie');

describe('Controller', () => {
  let root, accounts;

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
  });

  describe('liquidity', () => {
    it("fails if a price has not been set", async () => {
      const pToken = await makePToken({ supportMarket: true });
      await enterMarkets([pToken], accounts[1]);
      let result = await call(pToken.controller, 'getAccountLiquidity', [accounts[1]]);
      expect(result).toHaveTrollError('PRICE_ERROR');
    });

    it("allows a borrow up to collateralFactor, but not more", async () => {
      const collateralFactor = 0.5, underlyingPrice = 1, user = accounts[1], amount = 1e6;
      const priceOracle = await makePriceOracle();
      const pToken = await makePToken({uniswapOracle: priceOracle, supportMarket: true, collateralFactor, underlyingPrice});

      let liquidity, shortfall;

      // not in market yet, hypothetical borrow should have no effect
      ({1: liquidity, 2: shortfall} = await call(pToken.controller, 'getHypotheticalAccountLiquidity', [user, pToken._address, 0, amount]));
      expect(liquidity).toEqualNumber(0);
      expect(shortfall).toEqualNumber(0);

      await enterMarkets([pToken], user);
      await quickMint(pToken, user, amount);

      // total account liquidity after supplying `amount`
      ({1: liquidity, 2: shortfall} = await call(pToken.controller, 'getAccountLiquidity', [user]));
      expect(liquidity).toEqualNumber(amount * collateralFactor);
      expect(shortfall).toEqualNumber(0);

      // hypothetically borrow `amount`, should shortfall over collateralFactor
      ({1: liquidity, 2: shortfall} = await call(pToken.controller, 'getHypotheticalAccountLiquidity', [user, pToken._address, 0, amount]));
      expect(liquidity).toEqualNumber(0);
      expect(shortfall).toEqualNumber(amount * (1 - collateralFactor));

      // hypothetically redeem `amount`, should be back to even
      ({1: liquidity, 2: shortfall} = await call(pToken.controller, 'getHypotheticalAccountLiquidity', [user, pToken._address, amount, 0]));
      expect(liquidity).toEqualNumber(0);
      expect(shortfall).toEqualNumber(0);
    }, 20000);

    it("allows entering 3 markets, supplying to 2 and borrowing up to collateralFactor in the 3rd", async () => {
      const amount1 = 1e6, amount2 = 1e3, user = accounts[1];
      const cf1 = 0.5, cf2 = 0.666, cf3 = 0, up1 = 3, up2 = 2.718, up3 = 1;
      const c1 = amount1 * cf1 * up1, c2 = amount2 * cf2 * up2, collateral = Math.floor(c1 + c2);
      const priceOracle = await makePriceOracle();
      const pToken1 = await makePToken({uniswapOracle: priceOracle, supportMarket: true, collateralFactor: cf1, underlyingPrice: up1});
      const pToken2 = await makePToken({uniswapOracle: priceOracle, supportMarket: true, controller: pToken1.controller, pTokenFactory: pToken1.pTokenFactory, collateralFactor: cf2, underlyingPrice: up2});
      const pToken3 = await makePToken({uniswapOracle: priceOracle, supportMarket: true, controller: pToken1.controller, pTokenFactory: pToken1.pTokenFactory, collateralFactor: cf3, underlyingPrice: up3});

      await enterMarkets([pToken1, pToken2, pToken3], user);
      await quickMint(pToken1, user, amount1);
      await quickMint(pToken2, user, amount2);

      let error, liquidity, shortfall;

      ({0: error, 1: liquidity, 2: shortfall} = await call(pToken3.controller, 'getAccountLiquidity', [user]));
      expect(error).toEqualNumber(0);
      expect(liquidity).toEqualNumber(collateral);
      expect(shortfall).toEqualNumber(0);

      ({1: liquidity, 2: shortfall} = await call(pToken3.controller, 'getHypotheticalAccountLiquidity', [user, pToken3._address, Math.floor(c2), 0]));
      expect(liquidity).toEqualNumber(collateral);
      expect(shortfall).toEqualNumber(0);

      ({1: liquidity, 2: shortfall} = await call(pToken3.controller, 'getHypotheticalAccountLiquidity', [user, pToken3._address, 0, Math.floor(c2)]));
      expect(liquidity).toEqualNumber(c1);
      expect(shortfall).toEqualNumber(0);

      ({1: liquidity, 2: shortfall} = await call(pToken3.controller, 'getHypotheticalAccountLiquidity', [user, pToken3._address, 0, collateral + c1]));
      expect(liquidity).toEqualNumber(0);
      expect(shortfall).toEqualNumber(c1);

      ({1: liquidity, 2: shortfall} = await call(pToken1.controller, 'getHypotheticalAccountLiquidity', [user, pToken1._address, amount1, 0]));
      expect(liquidity).toEqualNumber(Math.floor(c2));
      expect(shortfall).toEqualNumber(0);
    });
  }, 20000);

  describe("getAccountLiquidity", () => {
    it("returns 0 if not 'in' any markets", async () => {
      const controller = await makeController();
      const {0: error, 1: liquidity, 2: shortfall} = await call(controller, 'getAccountLiquidity', [accounts[0]]);
      expect(error).toEqualNumber(0);
      expect(liquidity).toEqualNumber(0);
      expect(shortfall).toEqualNumber(0);
    });
  });

  describe("getHypotheticalAccountLiquidity", () => {
    it("returns 0 if not 'in' any markets", async () => {
      const pToken = await makePToken();
      const {0: error, 1: liquidity, 2: shortfall} = await call(pToken.controller, 'getHypotheticalAccountLiquidity', [accounts[0], pToken._address, 0, 0]);
      expect(error).toEqualNumber(0);
      expect(liquidity).toEqualNumber(0);
      expect(shortfall).toEqualNumber(0);
    });

    it("returns collateral factor times dollar amount of tokens minted in a single market", async () => {
      const collateralFactor = 0.5, exchangeRate = 1, underlyingPrice = 1;
      const priceOracle = await makePriceOracle();
      const pToken = await makePToken({uniswapOracle: priceOracle, supportMarket: true, collateralFactor, underlyingPrice});
      const from = accounts[0], balance = 1e7, amount = 1e6;
      await enterMarkets([pToken], from);
      await send(pToken.underlying, 'harnessSetBalance', [from, balance], {from});
      await send(pToken.underlying, 'approve', [pToken._address, balance], {from});
      await send(pToken, 'mint', [amount], {from});
      const {0: error, 1: liquidity, 2: shortfall} = await call(pToken.controller, 'getHypotheticalAccountLiquidity', [from, pToken._address, 0, 0]);
      expect(error).toEqualNumber(0);
      expect(liquidity).toEqualNumber(amount * collateralFactor * exchangeRate * underlyingPrice);
      expect(shortfall).toEqualNumber(0);
    });
  });
});
