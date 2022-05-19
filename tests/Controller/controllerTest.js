const {
  etherMantissa,
  both
} = require('../Utils/Ethereum');

const {
  makeController,
  makePriceOracle,
  makePToken,
  makeToken
} = require('../Utils/DeFiPie');

describe('Controller', () => {
  let root, accounts;

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
  });

  describe('constructor', () => {
    it("on success it sets closeFactor and maxAssets as specified", async () => {
      const controller = await makeController();
      expect(await call(controller, 'closeFactorMantissa')).toEqualNumber(0.051e18);
      expect(await call(controller, 'maxAssets')).toEqualNumber(10);
    });

    it("allows small and large maxAssets", async () => {
      const controller = await makeController({maxAssets: 0});
      expect(await call(controller, 'maxAssets')).toEqualNumber(0);

      // 5000 is an arbitrary number larger than what we expect to ever actually use
      await send(controller, '_setMaxAssets', [5000]);
      expect(await call(controller, 'maxAssets')).toEqualNumber(5000);
    });
  });

  describe('_setLiquidationIncentive', () => {
    const initialIncentive = etherMantissa(1.0);
    const validIncentive = etherMantissa(1.1);
    const tooSmallIncentive = etherMantissa(0.99999);
    const tooLargeIncentive = etherMantissa(1.50000001);

    let controller;
    beforeEach(async () => {
      controller = await makeController();
    });

    it("fails if called by non-admin", async () => {
      const {reply, receipt} = await both(controller, '_setLiquidationIncentive', [initialIncentive], {from: accounts[0]});
      expect(reply).toHaveTrollError('UNAUTHORIZED');
      expect(receipt).toHaveTrollFailure('UNAUTHORIZED', 'SET_LIQUIDATION_INCENTIVE_OWNER_CHECK');
      expect(await call(controller, 'liquidationIncentiveMantissa')).toEqualNumber(initialIncentive);
    });

    it("fails if incentive is less than min", async () => {
      const {reply, receipt} = await both(controller, '_setLiquidationIncentive', [tooSmallIncentive]);
      expect(reply).toHaveTrollError('INVALID_LIQUIDATION_INCENTIVE');
      expect(receipt).toHaveTrollFailure('INVALID_LIQUIDATION_INCENTIVE', 'SET_LIQUIDATION_INCENTIVE_VALIDATION');
      expect(await call(controller, 'liquidationIncentiveMantissa')).toEqualNumber(initialIncentive);
    });

    it("fails if incentive is greater than max", async () => {
      const {reply, receipt} = await both(controller, '_setLiquidationIncentive', [tooLargeIncentive]);
      expect(reply).toHaveTrollError('INVALID_LIQUIDATION_INCENTIVE');
      expect(receipt).toHaveTrollFailure('INVALID_LIQUIDATION_INCENTIVE', 'SET_LIQUIDATION_INCENTIVE_VALIDATION');
      expect(await call(controller, 'liquidationIncentiveMantissa')).toEqualNumber(initialIncentive);
    });

    it("accepts a valid incentive and emits a NewLiquidationIncentive event", async () => {
      const {reply, receipt} = await both(controller, '_setLiquidationIncentive', [validIncentive]);
      expect(reply).toHaveTrollError('NO_ERROR');
      expect(receipt).toHaveLog('NewLiquidationIncentive', {
        oldLiquidationIncentiveMantissa: initialIncentive.toString(),
        newLiquidationIncentiveMantissa: validIncentive.toString()
      });
      expect(await call(controller, 'liquidationIncentiveMantissa')).toEqualNumber(validIncentive);
    });
  });

  describe('_setPriceOracle', () => {
    let controller, newOracle;

    it("accepts a valid price oracle, and fails if called by non-admin", async () => {
      controller = await makeController();
      newOracle = await makePriceOracle();

      const result = await send(controller.registryProxy, '_setOracle', [newOracle._address]);
      expect(result).toSucceed();
      expect(await call(controller, 'getOracle')).toEqual(newOracle._address);

      let currentOracle = await controller.methods.getOracle().call();

      expect(
          await send(controller.registryProxy, '_setOracle', [newOracle._address], {from: accounts[0]})
      ).toHaveRegistryFailure('UNAUTHORIZED', 'SET_NEW_ORACLE');
      expect(await controller.methods.getOracle().call()).toEqual(currentOracle);
    });
  });

  describe('_setCloseFactor', () => {
    it("fails if not called by admin", async () => {
      const pToken = await makePToken();
      expect(
        await send(pToken.controller, '_setCloseFactor', [1], {from: accounts[0]})
      ).toHaveTrollFailure('UNAUTHORIZED', 'SET_CLOSE_FACTOR_OWNER_CHECK');
    });

    it("fails if close factor too low", async () => {
      const pToken = await makePToken();
      expect(await send(pToken.controller, '_setCloseFactor', [1])).toHaveTrollFailure('INVALID_CLOSE_FACTOR', 'SET_CLOSE_FACTOR_VALIDATION');
    });

    it("fails if close factor too low", async () => {
      const pToken = await makePToken();
      expect(await send(pToken.controller, '_setCloseFactor', [etherMantissa(1e18)])).toHaveTrollFailure('INVALID_CLOSE_FACTOR', 'SET_CLOSE_FACTOR_VALIDATION');
    });
  });

  describe('_setCollateralFactor', () => {
    const half = etherMantissa(0.5);
    const one = etherMantissa(1);

    it("fails if not called by admin", async () => {
      const pToken = await makePToken();
      expect(
        await send(pToken.controller, '_setCollateralFactor', [pToken._address, half], {from: accounts[0]})
      ).toHaveTrollFailure('UNAUTHORIZED', 'SET_COLLATERAL_FACTOR_OWNER_CHECK');
    });

    it("fails if factor is too high", async () => {
      const pToken = await makePToken({supportMarket: true});
      expect(
        await send(pToken.controller, '_setCollateralFactor', [pToken._address, one])
      ).toHaveTrollFailure('INVALID_COLLATERAL_FACTOR', 'SET_COLLATERAL_FACTOR_VALIDATION');
    });

    it("fails if factor is set without an underlying price", async () => {
      const pToken = await makePToken({supportMarket: true});
      expect(
        await send(pToken.controller, '_setCollateralFactor', [pToken._address, half])
      ).toHaveTrollFailure('PRICE_ERROR', 'SET_COLLATERAL_FACTOR_WITHOUT_PRICE');
    });

    it("succeeds and sets market", async () => {
      const pToken = await makePToken({supportMarket: true, underlyingPrice: 1});
      const result = await send(pToken.controller, '_setCollateralFactor', [pToken._address, half]);
      expect(result).toHaveLog('NewCollateralFactor', {
        pToken: pToken._address,
        oldCollateralFactorMantissa: '0',
        newCollateralFactorMantissa: half.toString()
      });
    });
  });

  describe('_supportMarket', () => {
    it("fails if not called by admin", async () => {
      const pToken = await makePToken({root: root});
      expect(
        await send(pToken.controller, '_supportMarket', [pToken._address], {from: accounts[0]})
      ).toHaveTrollFailure('UNAUTHORIZED', 'SUPPORT_MARKET_OWNER_CHECK');
    });

    it("fails if asset is not a PToken", async () => {
      const controller = await makeController();
      const asset = await makeToken(root);
      await expect(send(controller, '_supportMarket', [asset._address])).rejects.toRevert();
    });

    it("succeeds and sets market", async () => {
      const pToken = await makePToken();
      const result = await call(pToken.controller, 'markets', [pToken._address]);
      expect(result.isListed).toEqual(true);
    });

    it("cannot list a market a second time", async () => {
      const pToken = await makePToken();
      const result1 = await send(pToken.controller, '_supportMarket', [pToken._address]);
      expect(result1).toHaveTrollFailure('MARKET_ALREADY_LISTED', 'SUPPORT_MARKET_EXISTS');
    });

    it("can list two different markets", async () => {
      const pToken1 = await makePToken();
      const pToken2 = await makePToken({controller: pToken1.controller, pTokenFactory: pToken1.pTokenFactory});
      const result1 = await call(pToken1.controller, 'markets', [pToken1._address]);
      const result2 = await call(pToken1.controller, 'markets', [pToken2._address]);
      expect(result1.isListed).toEqual(true);
      expect(result2.isListed).toEqual(true);
    });
  });

  describe('redeemVerify', () => {
    it('should allow you to redeem 0 underlying for 0 tokens', async () => {
      const controller = await makeController();
      const pToken = await makePToken({controller: controller, priceOracle: controller.priceOracle, registryProxy: controller.registryProxy});
      await call(controller, 'redeemVerify', [pToken._address, accounts[0], 0, 0]);
    });

    it('should allow you to redeem 5 underlyig for 5 tokens', async () => {
      const controller = await makeController();
      const pToken = await makePToken({controller: controller, priceOracle: controller.priceOracle, registryProxy: controller.registryProxy});
      await call(controller, 'redeemVerify', [pToken._address, accounts[0], 5, 5]);
    });

    it('should not allow you to redeem 5 underlying for 0 tokens', async () => {
      const controller = await makeController();
      const pToken = await makePToken({controller: controller, priceOracle: controller.priceOracle, registryProxy: controller.registryProxy});
      await expect(call(controller, 'redeemVerify', [pToken._address, accounts[0], 5, 0])).rejects.toRevert("revert redeemTokens zero");
    });
  })
});
