const {
  etherGasCost,
  etherMantissa,
  etherUnsigned,
  sendFallback
} = require('../Utils/Ethereum');

const {
  makePToken,
  fastForward,
  setBalance,
  setEtherBalance,
  getBalances,
  adjustBalances,
} = require('../Utils/DeFiPie');

const exchangeRate = 5;
const mintAmount = etherUnsigned(1e5);
const mintTokens = mintAmount.dividedBy(exchangeRate);
const redeemTokens = etherUnsigned(10e3);
const redeemAmount = redeemTokens.multipliedBy(exchangeRate);

async function preMint(pToken, minter, mintAmount, mintTokens, exchangeRate) {
  await send(pToken.controller, 'setMintAllowed', [true]);
  await send(pToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(pToken, 'harnessSetExchangeRate', [etherMantissa(exchangeRate)]);
}

async function mintExplicit(pToken, minter, mintAmount) {
  return send(pToken, 'mint', [], {from: minter, value: mintAmount});
}

async function mintFallback(pToken, minter, mintAmount) {
  return sendFallback(pToken, {from: minter, value: mintAmount});
}

async function preRedeem(pToken, redeemer, redeemTokens, redeemAmount, exchangeRate) {
  await send(pToken.controller, 'setRedeemAllowed', [true]);
  await send(pToken.controller, 'setRedeemVerify', [true]);
  await send(pToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(pToken, 'harnessSetExchangeRate', [etherMantissa(exchangeRate)]);
  await setEtherBalance(pToken, redeemAmount);
  await send(pToken, 'harnessSetTotalSupply', [redeemTokens]);
  await setBalance(pToken, redeemer, redeemTokens);
}

async function redeemPTokens(pToken, redeemer, redeemTokens, redeemAmount) {
  return send(pToken, 'redeem', [redeemTokens], {from: redeemer});
}

async function redeemUnderlying(pToken, redeemer, redeemTokens, redeemAmount) {
  return send(pToken, 'redeemUnderlying', [redeemAmount], {from: redeemer});
}

describe('PEther', () => {
  let root, minter, redeemer, accounts;
  let pToken;

  beforeEach(async () => {
    [root, minter, redeemer, ...accounts] = saddle.accounts;
    pToken = await makePToken({kind: 'pether', controllerOpts: {kind: 'bool'}});
    await fastForward(pToken, 1);
  });

  [mintExplicit, mintFallback].forEach((mint) => {
    describe(mint.name, () => {
      beforeEach(async () => {
        await preMint(pToken, minter, mintAmount, mintTokens, exchangeRate);
      });

      it("reverts if interest accrual fails", async () => {
        await send(pToken.interestRateModel, 'setFailBorrowRate', [true]);
        await expect(mint(pToken, minter, mintAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
      });

      it("returns success from mintFresh and mints the correct number of tokens", async () => {
        const beforeBalances = await getBalances([pToken], [minter]);
        const receipt = await mint(pToken, minter, mintAmount);
        const afterBalances = await getBalances([pToken], [minter]);
        expect(receipt).toSucceed();
        expect(mintTokens).not.toEqualNumber(0);
        expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
          [pToken, 'eth', mintAmount],
          [pToken, 'tokens', mintTokens],
          [pToken, minter, 'eth', -mintAmount.plus(await etherGasCost(receipt))],
          [pToken, minter, 'tokens', mintTokens]
        ]));
      });
    });
  });

  [redeemPTokens, redeemUnderlying].forEach((redeem) => {
    describe(redeem.name, () => {
      beforeEach(async () => {
        await preRedeem(pToken, redeemer, redeemTokens, redeemAmount, exchangeRate);
      });

      it("emits a redeem failure if interest accrual fails", async () => {
        await send(pToken.interestRateModel, 'setFailBorrowRate', [true]);
        await expect(redeem(pToken, redeemer, redeemTokens, redeemAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
      });

      it("returns error from redeemFresh without emitting any extra logs", async () => {
        expect(await redeem(pToken, redeemer, redeemTokens.multipliedBy(5), redeemAmount.multipliedBy(5))).toHaveTokenFailure('MATH_ERROR', 'REDEEM_NEW_TOTAL_SUPPLY_CALCULATION_FAILED');
      });

      it("returns success from redeemFresh and redeems the correct amount", async () => {
        await fastForward(pToken);
        const beforeBalances = await getBalances([pToken], [redeemer]);
        const receipt = await redeem(pToken, redeemer, redeemTokens, redeemAmount);
        expect(receipt).toTokenSucceed();
        const afterBalances = await getBalances([pToken], [redeemer]);
        expect(redeemTokens).not.toEqualNumber(0);
        expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
          [pToken, 'eth', -redeemAmount],
          [pToken, 'tokens', -redeemTokens],
          [pToken, redeemer, 'eth', redeemAmount.minus(await etherGasCost(receipt))],
          [pToken, redeemer, 'tokens', -redeemTokens]
        ]));
      });
    });
  });
});
