const {both} = require('../Utils/Ethereum');
const {
  makeController,
  makePToken
} = require('../Utils/DeFiPie');

describe('assetListTest', () => {
  let root, customer, accounts;
  let controller;
  let allTokens, OMG, ZRX, BAT, REP, DAI, SKT;

  beforeEach(async () => {
    [root, customer, ...accounts] = saddle.accounts;
    controller = await makeController({maxAssets: 10});

    OMG = await makePToken({controller: controller, uniswapOracle: controller.priceOracle, registryProxy: controller.registryProxy, name: 'OMG', symbol: 'OMG', supportMarket: true, underlyingPrice: 0.5});
    ZRX = await makePToken({controller: controller, uniswapOracle: controller.priceOracle, registryProxy: controller.registryProxy, pTokenFactory: OMG.pTokenFactory, name: 'ZRX', symbol: 'ZRX', supportMarket: true, underlyingPrice: 0.5});
    BAT = await makePToken({controller: controller, uniswapOracle: controller.priceOracle, registryProxy: controller.registryProxy, pTokenFactory: OMG.pTokenFactory, name: 'BAT', symbol: 'BAT', supportMarket: true, underlyingPrice: 0.5});
    REP = await makePToken({controller: controller, uniswapOracle: controller.priceOracle, registryProxy: controller.registryProxy, pTokenFactory: OMG.pTokenFactory, name: 'REP', symbol: 'REP', supportMarket: true, underlyingPrice: 0.5});
    DAI = await makePToken({controller: controller, uniswapOracle: controller.priceOracle, registryProxy: controller.registryProxy, pTokenFactory: OMG.pTokenFactory, name: 'DAI', symbol: 'DAI', supportMarket: true, underlyingPrice: 0.5});
    SKT = await makePToken({controller: controller, uniswapOracle: controller.priceOracle, registryProxy: controller.registryProxy, pTokenFactory: OMG.pTokenFactory, name: 'SKT', symbol: 'SKT', supportMarket: true, underlyingPrice: 0.5});

    allTokens = [OMG, ZRX, BAT, REP, DAI, SKT];

    await send(controller, 'setSupportMarket', [SKT._address, false]);
  });

  describe('_setMaxAssets', () => {
    it("fails if called by a non-admin", async () => {
      expect(await send(controller, '_setMaxAssets', [15], {from: customer})).toHaveTrollFailure('UNAUTHORIZED', 'SET_MAX_ASSETS_OWNER_CHECK');
      expect(await call(controller, 'maxAssets')).toEqualNumber(10);
    });

    it("succeeds if called by an admin", async() => {
      expect(await send(controller, '_setMaxAssets', [15])).toHaveLog('NewMaxAssets', {
          oldMaxAssets: "10",
          newMaxAssets: "15"
        });
      expect(await call(controller, 'maxAssets')).toEqualNumber(15);
    });
  });

  async function checkMarkets(expectedTokens) {
    for (let token of allTokens) {
      const isExpected = expectedTokens.some(e => e.symbol == token.symbol);
      expect(await call(controller, 'checkMembership', [customer, token._address])).toEqual(isExpected);
    }
  }

  async function enterAndCheckMarkets(enterTokens, expectedTokens, expectedErrors = null) {
    const {reply, receipt} = await both(controller, 'enterMarkets', [enterTokens.map(t => t._address)], {from: customer});
    const assetsIn = await call(controller, 'getAssetsIn', [customer]);
    expectedErrors = expectedErrors || enterTokens.map(_ => 'NO_ERROR');

    reply.forEach((tokenReply, i) => {
      expect(tokenReply).toHaveTrollError(expectedErrors[i]);
    });

    expect(receipt).toSucceed();
    expect(assetsIn).toEqual(expectedTokens.map(t => t._address));

    await checkMarkets(expectedTokens);

    return receipt;
  };

  async function exitAndCheckMarkets(exitToken, expectedTokens, expectedError = 'NO_ERROR') {
    const {reply, receipt} = await both(controller, 'exitMarket', [exitToken._address], {from: customer});
    const assetsIn = await call(controller, 'getAssetsIn', [customer]);
    expect(reply).toHaveTrollError(expectedError);
    //assert.trollSuccess(receipt); XXX enterMarkets cannot fail, but exitMarket can - kind of confusing
    expect(assetsIn).toEqual(expectedTokens.map(t => t._address));
    await checkMarkets(expectedTokens);
    return receipt;
  };

  describe('enterMarkets', () => {
    it("properly emits events", async () => {
      const result1 = await enterAndCheckMarkets([OMG], [OMG]);
      const result2 = await enterAndCheckMarkets([OMG], [OMG]);
      expect(result1).toHaveLog('MarketEntered', {
          pToken: OMG._address,
          account: customer
        });
      expect(result2.events).toEqual({});
    });

    it("adds to the asset list only once", async () => {
      await enterAndCheckMarkets([OMG], [OMG]);
      await enterAndCheckMarkets([OMG], [OMG]);
      await enterAndCheckMarkets([ZRX, BAT, OMG], [OMG, ZRX, BAT]);
      await enterAndCheckMarkets([ZRX, OMG], [OMG, ZRX, BAT]);
      await enterAndCheckMarkets([ZRX], [OMG, ZRX, BAT]);
      await enterAndCheckMarkets([OMG], [OMG, ZRX, BAT]);
      await enterAndCheckMarkets([ZRX], [OMG, ZRX, BAT]);
      await enterAndCheckMarkets([BAT], [OMG, ZRX, BAT]);
    });

    it("the market must be listed for add to succeed", async () => {
      await enterAndCheckMarkets([SKT], [], ['MARKET_NOT_LISTED']);
      await send(controller, 'setSupportMarket', [SKT._address, true]);
      await enterAndCheckMarkets([SKT], [SKT]);
    });

    it("returns a list of codes mapping to user's ultimate membership in given addresses", async () => {
      await enterAndCheckMarkets([OMG, ZRX, BAT], [OMG, ZRX, BAT], ['NO_ERROR', 'NO_ERROR', 'NO_ERROR'], "success if can enter markets");
      await enterAndCheckMarkets([OMG, SKT], [OMG, ZRX, BAT], ['NO_ERROR', 'MARKET_NOT_LISTED'], "error for unlisted markets");
    });

    it("can enter one + asset cap reached", async () => {
      await send(controller, '_setMaxAssets', [1]);
      await enterAndCheckMarkets([ZRX, OMG], [ZRX], ['NO_ERROR', 'TOO_MANY_ASSETS'], "error if asset cap reached");
    });

    it("reaches asset cap + already in asset", async () => {
      await send(controller, '_setMaxAssets', [1]);
      await enterAndCheckMarkets([ZRX], [ZRX]);
      await enterAndCheckMarkets([OMG, ZRX], [ZRX], ['TOO_MANY_ASSETS', 'NO_ERROR'], "error if already in asset");
    });

    describe('reaching the asset cap', () => {
      beforeEach(async () => {
        await send(controller, '_setMaxAssets', [3]);
        await enterAndCheckMarkets([OMG, ZRX, BAT], [OMG, ZRX, BAT]);
      });

      it("does not grow if user exactly at asset cap", async () => {
        await send(controller, '_setMaxAssets', [3]);
        await enterAndCheckMarkets([REP], [OMG, ZRX, BAT], ['TOO_MANY_ASSETS']);
        await send(controller, '_setMaxAssets', [4]);
        await enterAndCheckMarkets([REP], [OMG, ZRX, BAT, REP]);
        await enterAndCheckMarkets([DAI], [OMG, ZRX, BAT, REP], ['TOO_MANY_ASSETS']);
      });

      it("does not grow if user is well beyond asset cap", async () => {
        await send(controller, '_setMaxAssets', [1]);
        await enterAndCheckMarkets([REP], [OMG, ZRX, BAT], ['TOO_MANY_ASSETS']);
      });
    });
  });

  describe('exitMarket', () => {
    it("doesn't let you exit if you have a borrow balance", async () => {
      await enterAndCheckMarkets([OMG], [OMG]);
      await send(OMG, 'harnessSetAccountBorrows', [customer, 1, 1]);
      await exitAndCheckMarkets(OMG, [OMG], 'NONZERO_BORROW_BALANCE');
    });

    it("rejects unless redeem allowed", async () => {
      await enterAndCheckMarkets([OMG, BAT], [OMG, BAT]);
      await send(BAT, 'harnessSetAccountBorrows', [customer, 1, 1]);

      // BAT has a negative balance and there's no supply, thus account should be underwater
      await exitAndCheckMarkets(OMG, [OMG, BAT], 'REJECTION');
    });

    it("accepts when you're not in the market already", async () => {
      await enterAndCheckMarkets([OMG, BAT], [OMG, BAT]);

      // Not in ZRX, should exit fine
      await exitAndCheckMarkets(ZRX, [OMG, BAT], 'NO_ERROR');
    });

    it("properly removes when there's only one asset", async () => {
      await enterAndCheckMarkets([OMG], [OMG]);
      await exitAndCheckMarkets(OMG, [], 'NO_ERROR');
    });

    it("properly removes when there's only two assets, removing the first", async () => {
      await enterAndCheckMarkets([OMG, BAT], [OMG, BAT]);
      await exitAndCheckMarkets(OMG, [BAT], 'NO_ERROR');
    });

    it("properly removes when there's only two assets, removing the second", async () => {
      await enterAndCheckMarkets([OMG, BAT], [OMG, BAT]);
      await exitAndCheckMarkets(BAT, [OMG], 'NO_ERROR');
    });

    it("properly removes when there's only three assets, removing the first", async () => {
      await enterAndCheckMarkets([OMG, BAT, ZRX], [OMG, BAT, ZRX]);
      await exitAndCheckMarkets(OMG, [ZRX, BAT], 'NO_ERROR');
    });

    it("properly removes when there's only three assets, removing the second", async () => {
      await enterAndCheckMarkets([OMG, BAT, ZRX], [OMG, BAT, ZRX]);
      await exitAndCheckMarkets(BAT, [OMG, ZRX], 'NO_ERROR');
    });

    it("properly removes when there's only three assets, removing the third", async () => {
      await enterAndCheckMarkets([OMG, BAT, ZRX], [OMG, BAT, ZRX]);
      await exitAndCheckMarkets(ZRX, [OMG, BAT], 'NO_ERROR');
    });
  });

  describe('entering from borrowAllowed', () => {
    it("enters when called by a pToken", async () => {
      await send(BAT, 'harnessCallBorrowAllowed', [1], {from: customer});

      const assetsIn = await call(controller, 'getAssetsIn', [customer]);

      expect([BAT._address]).toEqual(assetsIn);

      await checkMarkets([BAT]);
    });

    it("reverts when called by not a pToken", async () => {
      await expect(
        send(controller, 'borrowAllowed', [BAT._address, customer, 1], {from: customer})
      ).rejects.toRevert('revert sender must be pToken');

      const assetsIn = await call(controller, 'getAssetsIn', [customer]);

      expect([]).toEqual(assetsIn);

      await checkMarkets([]);
    });

    it("adds to the asset list only once", async () => {
      await send(BAT, 'harnessCallBorrowAllowed', [1], {from: customer});

      await enterAndCheckMarkets([BAT], [BAT]);

      await send(BAT, 'harnessCallBorrowAllowed', [1], {from: customer});
      const assetsIn = await call(controller, 'getAssetsIn', [customer]);
      expect([BAT._address]).toEqual(assetsIn);
    });
  });
});
