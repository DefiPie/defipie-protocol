const {
  etherUnsigned,
  etherMantissa,
  UInt256Max
} = require('../Utils/Ethereum');

const {
  makePToken,
  balanceOf,
  fastForward,
  setBalance,
  getBalances,
  adjustBalances,
  preApprove,
  quickMint,
  preSupply,
  quickRedeem,
  quickRedeemUnderlying
} = require('../Utils/DeFiPie');

const exchangeRate = 50e3;
const mintAmount = etherUnsigned(10e4);
const mintTokens = mintAmount.dividedBy(exchangeRate);
const redeemTokens = etherUnsigned(10e3);
const redeemAmount = redeemTokens.multipliedBy(exchangeRate);

async function preMint(pToken, minter, mintAmount, mintTokens, exchangeRate) {
  await preApprove(pToken, minter, mintAmount);
  await send(pToken.controller, 'setMintAllowed', [true]);
  await send(pToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(pToken.underlying, 'harnessSetFailTransferFromAddress', [minter, false]);
  await send(pToken, 'harnessSetBalance', [minter, 0]);
  await send(pToken, 'harnessSetExchangeRate', [etherMantissa(exchangeRate)]);
}

async function mintFresh(pToken, minter, mintAmount) {
  return send(pToken, 'harnessMintFresh', [minter, mintAmount]);
}

async function preRedeem(pToken, redeemer, redeemTokens, redeemAmount, exchangeRate) {
  await preSupply(pToken, redeemer, redeemTokens);
  await send(pToken.controller, 'setRedeemAllowed', [true]);
  await send(pToken.controller, 'setRedeemVerify', [true]);
  await send(pToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(pToken.underlying, 'harnessSetBalance', [pToken._address, redeemAmount]);
  await send(pToken.underlying, 'harnessSetBalance', [redeemer, 0]);
  await send(pToken.underlying, 'harnessSetFailTransferToAddress', [redeemer, false]);
  await send(pToken, 'harnessSetExchangeRate', [etherMantissa(exchangeRate)]);
}

async function redeemFreshTokens(pToken, redeemer, redeemTokens, redeemAmount) {
  return send(pToken, 'harnessRedeemFresh', [redeemer, redeemTokens, 0]);
}

async function redeemFreshAmount(pToken, redeemer, redeemTokens, redeemAmount) {
  return send(pToken, 'harnessRedeemFresh', [redeemer, 0, redeemAmount]);
}

describe('PToken', function () {
  let root, minter, redeemer, accounts;
  let pToken;
  beforeEach(async () => {
    [root, minter, redeemer, ...accounts] = saddle.accounts;
    pToken = await makePToken({controllerOpts: {kind: 'bool'}, exchangeRate});
  });

  describe('mintFresh', () => {
    beforeEach(async () => {
      await preMint(pToken, minter, mintAmount, mintTokens, exchangeRate);
    });

    it("fails if controller tells it to", async () => {
      await send(pToken.controller, 'setMintAllowed', [false]);
      expect(await mintFresh(pToken, minter, mintAmount)).toHaveTrollReject('MINT_CONTROLLER_REJECTION', 'MATH_ERROR');
    });

    it("proceeds if controller tells it to", async () => {
      await expect(await mintFresh(pToken, minter, mintAmount)).toSucceed();
    });

    it("fails if not fresh", async () => {
      await fastForward(pToken);
      expect(await mintFresh(pToken, minter, mintAmount)).toHaveTokenFailure('MARKET_NOT_FRESH', 'MINT_FRESHNESS_CHECK');
    });

    it("continues if fresh", async () => {
      await expect(await send(pToken, 'accrueInterest')).toSucceed();
      expect(await mintFresh(pToken, minter, mintAmount)).toSucceed();
    });

    it("fails if insufficient approval", async () => {
      expect(
        await send(pToken.underlying, 'approve', [pToken._address, 1], {from: minter})
      ).toSucceed();
      await expect(mintFresh(pToken, minter, mintAmount)).rejects.toRevert('revert Insufficient allowance');
    });

    it("fails if insufficient balance", async() => {
      await setBalance(pToken.underlying, minter, 1);
      await expect(mintFresh(pToken, minter, mintAmount)).rejects.toRevert('revert Insufficient balance');
    });

    it("proceeds if sufficient approval and balance", async () =>{
      expect(await mintFresh(pToken, minter, mintAmount)).toSucceed();
    });

    it("fails if exchange calculation fails", async () => {
      expect(await send(pToken, 'harnessSetExchangeRate', [0])).toSucceed();
      await expect(mintFresh(pToken, minter, mintAmount)).rejects.toRevert('revert MINT_EXCHANGE_CALCULATION_FAILED');
    });

    it("fails if transferring in fails", async () => {
      await send(pToken.underlying, 'harnessSetFailTransferFromAddress', [minter, true]);
      await expect(mintFresh(pToken, minter, mintAmount)).rejects.toRevert('revert TOKEN_TRANSFER_IN_FAILED');
    });

    it("transfers the underlying cash, tokens, and emits Mint, Transfer events", async () => {
      const beforeBalances = await getBalances([pToken], [minter]);
      const result = await mintFresh(pToken, minter, mintAmount);
      const afterBalances = await getBalances([pToken], [minter]);
      expect(result).toSucceed();
      expect(result).toHaveLog('Mint', {
        minter,
        mintAmount: mintAmount.toString(),
        mintTokens: mintTokens.toString()
      });
      expect(result).toHaveLog(['Transfer', 1], {
        from: pToken._address,
        to: minter,
        amount: mintTokens.toString()
      });
      expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
        [pToken, minter, 'cash', -mintAmount],
        [pToken, minter, 'tokens', mintTokens],
        [pToken, 'cash', mintAmount],
        [pToken, 'tokens', mintTokens]
      ]));
    });
  });

  describe('mint', () => {
    beforeEach(async () => {
      await preMint(pToken, minter, mintAmount, mintTokens, exchangeRate);
    });

    it("emits a mint failure if interest accrual fails", async () => {
      await send(pToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(quickMint(pToken, minter, mintAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from mintFresh without emitting any extra logs", async () => {
      await send(pToken.underlying, 'harnessSetBalance', [minter, 1]);
      await expect(mintFresh(pToken, minter, mintAmount)).rejects.toRevert('revert Insufficient balance');
    });

    it("returns success from mintFresh and mints the correct number of tokens", async () => {
      expect(await quickMint(pToken, minter, mintAmount)).toSucceed();
      expect(mintTokens).not.toEqualNumber(0);
      expect(await balanceOf(pToken, minter)).toEqualNumber(mintTokens);
    });

    it("emits an AccrueInterest event", async () => {
      expect(await quickMint(pToken, minter, mintAmount)).toHaveLog('AccrueInterest', {
        borrowIndex: "1000000000000000000",
        cashPrior: "0",
        interestAccumulated: "0",
        totalBorrows: "0",
        totalReserves: "0",
      });
    });
  });

  [redeemFreshTokens, redeemFreshAmount].forEach((redeemFresh) => {
    describe(redeemFresh.name, () => {
      beforeEach(async () => {
        await preRedeem(pToken, redeemer, redeemTokens, redeemAmount, exchangeRate);
      });

      it("fails if controller tells it to", async () =>{
        await send(pToken.controller, 'setRedeemAllowed', [false]);
        expect(await redeemFresh(pToken, redeemer, redeemTokens, redeemAmount)).toHaveTrollReject('REDEEM_CONTROLLER_REJECTION');
      });

      it("fails if not fresh", async () => {
        await fastForward(pToken);
        expect(await redeemFresh(pToken, redeemer, redeemTokens, redeemAmount)).toHaveTokenFailure('MARKET_NOT_FRESH', 'REDEEM_FRESHNESS_CHECK');
      });

      it("continues if fresh", async () => {
        await expect(await send(pToken, 'accrueInterest')).toSucceed();
        expect(await redeemFresh(pToken, redeemer, redeemTokens, redeemAmount)).toSucceed();
      });

      it("fails if insufficient protocol cash to transfer out", async() => {
        await send(pToken.underlying, 'harnessSetBalance', [pToken._address, 1]);
        expect(await redeemFresh(pToken, redeemer, redeemTokens, redeemAmount)).toHaveTokenFailure('TOKEN_INSUFFICIENT_CASH', 'REDEEM_TRANSFER_OUT_NOT_POSSIBLE');
      });

      it("fails if exchange calculation fails", async () => {
        if (redeemFresh == redeemFreshTokens) {
          expect(await send(pToken, 'harnessSetExchangeRate', [UInt256Max()])).toSucceed();
          expect(await redeemFresh(pToken, redeemer, redeemTokens, redeemAmount)).toHaveTokenFailure('MATH_ERROR', 'REDEEM_EXCHANGE_TOKENS_CALCULATION_FAILED');
        } else {
          expect(await send(pToken, 'harnessSetExchangeRate', [0])).toSucceed();
          expect(await redeemFresh(pToken, redeemer, redeemTokens, redeemAmount)).toHaveTokenFailure('MATH_ERROR', 'REDEEM_EXCHANGE_AMOUNT_CALCULATION_FAILED');
        }
      });

      it("fails if transferring out fails", async () => {
        await send(pToken.underlying, 'harnessSetFailTransferToAddress', [redeemer, true]);
        await expect(redeemFresh(pToken, redeemer, redeemTokens, redeemAmount)).rejects.toRevert("revert TOKEN_TRANSFER_OUT_FAILED");
      });

      it("fails if total supply < redemption amount", async () => {
        await send(pToken, 'harnessExchangeRateDetails', [0, 0, 0]);
        expect(await redeemFresh(pToken, redeemer, redeemTokens, redeemAmount)).toHaveTokenFailure('MATH_ERROR', 'REDEEM_NEW_TOTAL_SUPPLY_CALCULATION_FAILED');
      });

      it("reverts if new account balance underflows", async () => {
        await send(pToken, 'harnessSetBalance', [redeemer, 0]);
        expect(await redeemFresh(pToken, redeemer, redeemTokens, redeemAmount)).toHaveTokenFailure('MATH_ERROR', 'REDEEM_NEW_ACCOUNT_BALANCE_CALCULATION_FAILED');
      });

      it("transfers the underlying cash, tokens, and emits Redeem, Transfer events", async () => {
        const beforeBalances = await getBalances([pToken], [redeemer]);
        const result = await redeemFresh(pToken, redeemer, redeemTokens, redeemAmount);
        const afterBalances = await getBalances([pToken], [redeemer]);
        expect(result).toSucceed();
        expect(result).toHaveLog('Redeem', {
          redeemer,
          redeemAmount: redeemAmount.toString(),
          redeemTokens: redeemTokens.toString()
        });
        expect(result).toHaveLog(['Transfer', 1], {
          from: redeemer,
          to: pToken._address,
          amount: redeemTokens.toString()
        });
        expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
          [pToken, redeemer, 'cash', redeemAmount],
          [pToken, redeemer, 'tokens', -redeemTokens],
          [pToken, 'cash', -redeemAmount],
          [pToken, 'tokens', -redeemTokens]
        ]));
      });
    });
  });

  describe('redeem', () => {
    beforeEach(async () => {
      await preRedeem(pToken, redeemer, redeemTokens, redeemAmount, exchangeRate);
    });

    it("emits a redeem failure if interest accrual fails", async () => {
      await send(pToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(quickRedeem(pToken, redeemer, redeemTokens)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from redeemFresh without emitting any extra logs", async () => {
      await setBalance(pToken.underlying, pToken._address, 0);
      expect(await quickRedeem(pToken, redeemer, redeemTokens, {exchangeRate})).toHaveTokenFailure('TOKEN_INSUFFICIENT_CASH', 'REDEEM_TRANSFER_OUT_NOT_POSSIBLE');
    });

    it("returns success from redeemFresh and redeems the right amount", async () => {
      expect(
        await send(pToken.underlying, 'harnessSetBalance', [pToken._address, redeemAmount])
      ).toSucceed();
      expect(await quickRedeem(pToken, redeemer, redeemTokens, {exchangeRate})).toSucceed();
      expect(redeemAmount).not.toEqualNumber(0);
      expect(await balanceOf(pToken.underlying, redeemer)).toEqualNumber(redeemAmount);
    });

    it("returns success from redeemFresh and redeems the right amount of underlying", async () => {
      expect(
        await send(pToken.underlying, 'harnessSetBalance', [pToken._address, redeemAmount])
      ).toSucceed();
      expect(
        await quickRedeemUnderlying(pToken, redeemer, redeemAmount, {exchangeRate})
      ).toSucceed();
      expect(redeemAmount).not.toEqualNumber(0);
      expect(await balanceOf(pToken.underlying, redeemer)).toEqualNumber(redeemAmount);
    });

    it("emits an AccrueInterest event", async () => {
      expect(await quickMint(pToken, minter, mintAmount)).toHaveLog('AccrueInterest', {
        borrowIndex: "1000000000000000000",
        cashPrior: "500000000",
        interestAccumulated: "0",
        totalBorrows: "0",
        totalReserves: "0",
      });
    });
  });
});
