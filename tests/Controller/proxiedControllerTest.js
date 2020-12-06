const { etherMantissa } = require('../Utils/Ethereum');
const { makePToken, makePriceOracle } = require('../Utils/DeFiPie');

describe('Controller', function() {
  let root, accounts;
  let unitroller;
  let brains;
  let oracle;

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
    oracle = await makePriceOracle();
    brains = await deploy('Controller');
    unitroller = await deploy('Unitroller');
  });

  let initializeBrains = async () => {
    await send(unitroller, '_setPendingImplementation', [brains._address]);
    await send(brains, '_become', [unitroller._address]);
    return await saddle.getContractAt('Controller', unitroller._address);
  };

  let reinitializeBrains = async () => {
    await send(unitroller, '_setPendingImplementation', [brains._address]);
    await send(brains, '_become', [unitroller._address]);
    return await saddle.getContractAt('Controller', unitroller._address);
  };

  describe('delegating to controller', () => {
    const closeFactor = etherMantissa(0.051);
    const maxAssets = 10;
    let unitrollerAsController, pToken;

    beforeEach(async () => {
      unitrollerAsController = await initializeBrains(oracle, etherMantissa(0.06), 30);
      await send(unitrollerAsController, '_setPriceOracle', [oracle._address]);
      pToken = await makePToken({ controller: unitrollerAsController });
    });

    describe('becoming brains sets initial state', () => {
      it('reverts if this is not the pending implementation', async () => {
        await expect(
          send(brains, '_become', [unitroller._address])
        ).rejects.toRevert('revert change not authorized');
      });

      it('on success it sets admin to caller of constructor', async () => {
        expect(await call(unitrollerAsController, 'admin')).toEqual(root);
        expect(await call(unitrollerAsController, 'pendingAdmin')).toBeAddressZero();
      });

      it('on success it sets closeFactor and maxAssets as specified', async () => {
        await send(unitrollerAsController, '_setCloseFactor', [closeFactor]);
        await send(unitrollerAsController, '_setMaxAssets', [maxAssets]);
        const controller = await initializeBrains();

        expect(await call(controller, 'closeFactorMantissa')).toEqualNumber(closeFactor);
        expect(await call(controller, 'maxAssets')).toEqualNumber(maxAssets);
      });

      it("on reinitialization success, it doesn't set closeFactor or maxAssets", async () => {
        let controller = await initializeBrains();

        await send(unitrollerAsController, '_setCloseFactor', [closeFactor]);
        await send(unitrollerAsController, '_setMaxAssets', [maxAssets]);

        expect(await call(unitroller, 'controllerImplementation')).toEqual(brains._address);
        expect(await call(controller, 'closeFactorMantissa')).toEqualNumber(closeFactor);
        expect(await call(controller, 'maxAssets')).toEqualNumber(maxAssets);

        // Create new brains
        brains = await deploy('Controller');
        controller = await reinitializeBrains();

        expect(await call(unitroller, 'controllerImplementation')).toEqual(brains._address);
        expect(await call(controller, 'closeFactorMantissa')).toEqualNumber(closeFactor);
        expect(await call(controller, 'maxAssets')).toEqualNumber(maxAssets);
      });

      it('reverts on invalid closeFactor', async () => {
        let badCloseFactor = etherMantissa(0.049);
        let result = await send(unitrollerAsController, '_setCloseFactor', [badCloseFactor]);
        expect(result).toHaveTrollFailure('INVALID_CLOSE_FACTOR', 'SET_CLOSE_FACTOR_VALIDATION');
        badCloseFactor = etherMantissa(0.91);
        result = await send(unitrollerAsController, '_setCloseFactor', [badCloseFactor]);
        expect(result).toHaveTrollFailure('INVALID_CLOSE_FACTOR', 'SET_CLOSE_FACTOR_VALIDATION');
      });

      it('allows 0 maxAssets', async () => {
        const controller = await initializeBrains();
        await send(unitrollerAsController, '_setMaxAssets', [0]);
        expect(await call(controller, 'maxAssets')).toEqualNumber(0);
      });

      it('allows 5000 maxAssets', async () => {
        // 5000 is an arbitrary number larger than what we expect to ever actually use
          const controller = await initializeBrains();
        await send(unitrollerAsController, '_setMaxAssets', [5000]);
        expect(await call(controller, 'maxAssets')).toEqualNumber(5000);
      });
    });

    describe('_setCollateralFactor', () => {
      const half = etherMantissa(0.5),
        one = etherMantissa(1);

      it('fails if not called by admin', async () => {
        expect(
          await send(unitrollerAsController, '_setCollateralFactor', [pToken._address, half], {
            from: accounts[1]
          })
        ).toHaveTrollFailure('UNAUTHORIZED', 'SET_COLLATERAL_FACTOR_OWNER_CHECK');
      });

      it('fails if asset is not listed', async () => {
        let badTokenAddress = '0x0000000000000000000000000000000000000001';
        expect(
          await send(unitrollerAsController, '_setCollateralFactor', [badTokenAddress, half])
        ).toHaveTrollFailure('MARKET_NOT_LISTED', 'SET_COLLATERAL_FACTOR_NO_EXISTS');
      });

      it('fails if factor is too high', async () => {
        const pToken = await makePToken({ supportMarket: true, controller: unitrollerAsController });
        expect(
          await send(unitrollerAsController, '_setCollateralFactor', [pToken._address, one])
        ).toHaveTrollFailure('INVALID_COLLATERAL_FACTOR', 'SET_COLLATERAL_FACTOR_VALIDATION');
      });

      it('fails if factor is set without an underlying price', async () => {
        const pToken = await makePToken({ supportMarket: true, controller: unitrollerAsController });
        await send(oracle, 'setUnderlyingPrice', [pToken._address, 0]);
        expect(
          await send(unitrollerAsController, '_setCollateralFactor', [pToken._address, half])
        ).toHaveTrollFailure('PRICE_ERROR', 'SET_COLLATERAL_FACTOR_WITHOUT_PRICE');
      });

      it('succeeds and sets market', async () => {
        const pToken = await makePToken({ supportMarket: true, controller: unitrollerAsController });
        await send(oracle, 'setUnderlyingPrice', [pToken._address, 1]);
        expect(
          await send(unitrollerAsController, '_setCollateralFactor', [pToken._address, half])
        ).toHaveLog('NewCollateralFactor', {
          pToken: pToken._address,
          oldCollateralFactorMantissa: '0',
          newCollateralFactorMantissa: half.toString()
        });
      });
    });

    describe('_supportMarket', () => {
      it('fails if not called by admin', async () => {
        expect(
          await send(unitrollerAsController, '_supportMarket', [pToken._address], { from: accounts[1] })
        ).toHaveTrollFailure('UNAUTHORIZED', 'SUPPORT_MARKET_OWNER_CHECK');
      });

      it('fails if asset is not a PToken', async () => {
        const notAPToken = await makePriceOracle();
        await expect(send(unitrollerAsController, '_supportMarket', [notAPToken._address])).rejects.toRevert();
      });

      it('succeeds and sets market', async () => {
          const result = await call(unitrollerAsController, 'markets', [pToken._address]);
          expect(result.isListed).toEqual(true);
      });

      it('cannot list a market a second time', async () => {
        const result = await send(unitrollerAsController, '_supportMarket', [pToken._address]);
        expect(result).toHaveTrollFailure('MARKET_ALREADY_LISTED', 'SUPPORT_MARKET_EXISTS');
      });

      it('can list two different markets', async () => {
        const pToken1 = await makePToken({ controller: unitrollerAsController });
        const pToken2 = await makePToken({ controller: unitrollerAsController });
        const result1 = await call(unitrollerAsController, 'markets', [pToken1._address]);
        const result2 = await call(unitrollerAsController, 'markets', [pToken2._address]);
        expect(result1.isListed).toEqual(true);
        expect(result2.isListed).toEqual(true);
      });
    });
  });
});
