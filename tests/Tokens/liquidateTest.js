const {
  etherGasCost,
  etherUnsigned,
  UInt256Max
} = require('../Utils/Ethereum');

const {
  makePToken,
  fastForward,
  setBalance,
  getBalances,
  adjustBalances,
  pretendBorrow,
  preApprove
} = require('../Utils/DeFiPie');

const repayAmount = etherUnsigned(10e2);
const seizeAmount = repayAmount;
const seizeTokens = seizeAmount.multipliedBy(4); // forced

async function preLiquidate(pToken, liquidator, borrower, repayAmount, pTokenCollateral) {
  // setup for success in liquidating
  await send(pToken.controller, 'setLiquidateBorrowAllowed', [true]);
  await send(pToken.controller, 'setRepayBorrowAllowed', [true]);
  await send(pToken.controller, 'setSeizeAllowed', [true]);
  await send(pToken.controller, 'setFailCalculateSeizeTokens', [false]);
  await send(pToken.underlying, 'harnessSetFailTransferFromAddress', [liquidator, false]);
  await send(pToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(pTokenCollateral.interestRateModel, 'setFailBorrowRate', [false]);
  await send(pTokenCollateral.controller, 'setCalculatedSeizeTokens', [seizeTokens]);
  await setBalance(pTokenCollateral, liquidator, 0);
  await setBalance(pTokenCollateral, borrower, seizeTokens);
  await pretendBorrow(pTokenCollateral, borrower, 0, 1, 0);
  await pretendBorrow(pToken, borrower, 1, 1, repayAmount);
  await preApprove(pToken, liquidator, repayAmount);
}

async function liquidateFresh(pToken, liquidator, borrower, repayAmount, pTokenCollateral) {
  return send(pToken, 'harnessLiquidateBorrowFresh', [liquidator, borrower, repayAmount, pTokenCollateral._address]);
}

async function liquidate(pToken, liquidator, borrower, repayAmount, pTokenCollateral) {
  // make sure to have a block delta so we accrue interest
  await fastForward(pToken, 1);
  await fastForward(pTokenCollateral, 1);
  return send(pToken, 'liquidateBorrow', [borrower, repayAmount, pTokenCollateral._address], {from: liquidator});
}

async function seize(pToken, liquidator, borrower, seizeAmount) {
  return send(pToken, 'seize', [liquidator, borrower, seizeAmount]);
}

describe('PToken', function () {
  let root, liquidator, borrower, accounts;
  let pToken, pTokenCollateral;

  beforeEach(async () => {
    [root, liquidator, borrower, ...accounts] = saddle.accounts;
    pToken = await makePToken({controllerOpts: {kind: 'bool'}});
    pTokenCollateral = await makePToken({controller: pToken.controller});
  });

  beforeEach(async () => {
    await preLiquidate(pToken, liquidator, borrower, repayAmount, pTokenCollateral);
  });

  describe('liquidateBorrowFresh', () => {
    it("fails if controller tells it to", async () => {
      await send(pToken.controller, 'setLiquidateBorrowAllowed', [false]);
      expect(
        await liquidateFresh(pToken, liquidator, borrower, repayAmount, pTokenCollateral)
      ).toHaveTrollReject('LIQUIDATE_CONTROLLER_REJECTION', 'MATH_ERROR');
    });

    it("proceeds if controller tells it to", async () => {
      expect(
        await liquidateFresh(pToken, liquidator, borrower, repayAmount, pTokenCollateral)
      ).toSucceed();
    });

    it("fails if market not fresh", async () => {
      await fastForward(pToken);
      expect(
        await liquidateFresh(pToken, liquidator, borrower, repayAmount, pTokenCollateral)
      ).toHaveTokenFailure('MARKET_NOT_FRESH', 'LIQUIDATE_FRESHNESS_CHECK');
    });

    it("fails if collateral market not fresh", async () => {
      await fastForward(pToken);
      await fastForward(pTokenCollateral);
      await send(pToken, 'accrueInterest');
      expect(
        await liquidateFresh(pToken, liquidator, borrower, repayAmount, pTokenCollateral)
      ).toHaveTokenFailure('MARKET_NOT_FRESH', 'LIQUIDATE_COLLATERAL_FRESHNESS_CHECK');
    });

    it("fails if borrower is equal to liquidator", async () => {
      expect(
        await liquidateFresh(pToken, borrower, borrower, repayAmount, pTokenCollateral)
      ).toHaveTokenFailure('INVALID_ACCOUNT_PAIR', 'LIQUIDATE_LIQUIDATOR_IS_BORROWER');
    });

    it("fails if repayAmount = 0", async () => {
      expect(await liquidateFresh(pToken, liquidator, borrower, 0, pTokenCollateral)).toHaveTokenFailure('INVALID_CLOSE_AMOUNT_REQUESTED', 'LIQUIDATE_CLOSE_AMOUNT_IS_ZERO');
    });

    it("fails if calculating seize tokens fails and does not adjust balances", async () => {
      const beforeBalances = await getBalances([pToken, pTokenCollateral], [liquidator, borrower]);
      await send(pToken.controller, 'setFailCalculateSeizeTokens', [true]);
      await expect(
        liquidateFresh(pToken, liquidator, borrower, repayAmount, pTokenCollateral)
      ).rejects.toRevert('revert LIQUIDATE_CONTROLLER_CALCULATE_AMOUNT_SEIZE_FAILED');
      const afterBalances = await getBalances([pToken, pTokenCollateral], [liquidator, borrower]);
      expect(afterBalances).toEqual(beforeBalances);
    });

    it("fails if repay fails", async () => {
      await send(pToken.controller, 'setRepayBorrowAllowed', [false]);
      expect(
        await liquidateFresh(pToken, liquidator, borrower, repayAmount, pTokenCollateral)
      ).toHaveTrollReject('LIQUIDATE_REPAY_BORROW_FRESH_FAILED');
    });

    it("reverts if seize fails", async () => {
      await send(pToken.controller, 'setSeizeAllowed', [false]);
      await expect(
        liquidateFresh(pToken, liquidator, borrower, repayAmount, pTokenCollateral)
      ).rejects.toRevert("revert token seizure failed");
    });

    it("transfers the cash, borrows, tokens, and emits Transfer, LiquidateBorrow events", async () => {
      const beforeBalances = await getBalances([pToken, pTokenCollateral], [liquidator, borrower]);
      const result = await liquidateFresh(pToken, liquidator, borrower, repayAmount, pTokenCollateral);
      const afterBalances = await getBalances([pToken, pTokenCollateral], [liquidator, borrower]);
      expect(result).toSucceed();
      expect(result).toHaveLog('LiquidateBorrow', {
        liquidator: liquidator,
        borrower: borrower,
        repayAmount: repayAmount.toString(),
        pTokenCollateral: pTokenCollateral._address,
        seizeTokens: seizeTokens.toString()
      });
      expect(result).toHaveLog(['Transfer', 0], {
        from: liquidator,
        to: pToken._address,
        amount: repayAmount.toString()
      });
      expect(result).toHaveLog(['Transfer', 1], {
        from: borrower,
        to: liquidator,
        amount: seizeTokens.toString()
      });
      expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
        [pToken, 'cash', repayAmount],
        [pToken, 'borrows', -repayAmount],
        [pToken, liquidator, 'cash', -repayAmount],
        [pTokenCollateral, liquidator, 'tokens', seizeTokens],
        [pToken, borrower, 'borrows', -repayAmount],
        [pTokenCollateral, borrower, 'tokens', -seizeTokens]
      ]));
    });
  });

  describe('liquidateBorrow', () => {
    it("emits a liquidation failure if borrowed asset interest accrual fails", async () => {
      await send(pToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(liquidate(pToken, liquidator, borrower, repayAmount, pTokenCollateral)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("emits a liquidation failure if collateral asset interest accrual fails", async () => {
      await send(pTokenCollateral.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(liquidate(pToken, liquidator, borrower, repayAmount, pTokenCollateral)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from liquidateBorrowFresh without emitting any extra logs", async () => {
      expect(await liquidate(pToken, liquidator, borrower, 0, pTokenCollateral)).toHaveTokenFailure('INVALID_CLOSE_AMOUNT_REQUESTED', 'LIQUIDATE_CLOSE_AMOUNT_IS_ZERO');
    });

    it("returns success from liquidateBorrowFresh and transfers the correct amounts", async () => {
      const beforeBalances = await getBalances([pToken, pTokenCollateral], [liquidator, borrower]);
      const result = await liquidate(pToken, liquidator, borrower, repayAmount, pTokenCollateral);
      const gasCost = await etherGasCost(result);
      const afterBalances = await getBalances([pToken, pTokenCollateral], [liquidator, borrower]);
      expect(result).toSucceed();
      expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
        [pToken, 'cash', repayAmount],
        [pToken, 'borrows', -repayAmount],
        [pToken, liquidator, 'eth', -gasCost],
        [pToken, liquidator, 'cash', -repayAmount],
        [pTokenCollateral, liquidator, 'eth', -gasCost],
        [pTokenCollateral, liquidator, 'tokens', seizeTokens],
        [pToken, borrower, 'borrows', -repayAmount],
        [pTokenCollateral, borrower, 'tokens', -seizeTokens]
      ]));
    });
  });

  describe('seize', () => {
    // XXX verify callers are properly checked

    it("fails if seize is not allowed", async () => {
      await send(pToken.controller, 'setSeizeAllowed', [false]);
      expect(await seize(pTokenCollateral, liquidator, borrower, seizeTokens)).toHaveTrollReject('LIQUIDATE_SEIZE_CONTROLLER_REJECTION', 'MATH_ERROR');
    });

    it("fails if pTokenBalances[borrower] < amount", async () => {
      await setBalance(pTokenCollateral, borrower, 1);
      expect(await seize(pTokenCollateral, liquidator, borrower, seizeTokens)).toHaveTokenMathFailure('LIQUIDATE_SEIZE_BALANCE_DECREMENT_FAILED', 'INTEGER_UNDERFLOW');
    });

    it("fails if pTokenBalances[liquidator] overflows", async () => {
      await setBalance(pTokenCollateral, liquidator, UInt256Max());
      expect(await seize(pTokenCollateral, liquidator, borrower, seizeTokens)).toHaveTokenMathFailure('LIQUIDATE_SEIZE_BALANCE_INCREMENT_FAILED', 'INTEGER_OVERFLOW');
    });

    it("succeeds, updates balances, and emits Transfer event", async () => {
      const beforeBalances = await getBalances([pTokenCollateral], [liquidator, borrower]);
      const result = await seize(pTokenCollateral, liquidator, borrower, seizeTokens);
      const afterBalances = await getBalances([pTokenCollateral], [liquidator, borrower]);
      expect(result).toSucceed();
      expect(result).toHaveLog('Transfer', {
        from: borrower,
        to: liquidator,
        amount: seizeTokens.toString()
      });
      expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
        [pTokenCollateral, liquidator, 'tokens', seizeTokens],
        [pTokenCollateral, borrower, 'tokens', -seizeTokens]
      ]));
    });
  });
});
