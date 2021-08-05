const {
  etherGasCost,
  etherUnsigned,
  etherMantissa,
  UInt256Max
} = require('../Utils/Ethereum');

const {
  makePToken,
  borrowSnapshot,
  totalBorrows,
  fastForward,
  pretendBorrow,
  setEtherBalance,
  getBalances,
  adjustBalances
} = require('../Utils/DeFiPie');

const BigNumber = require('bignumber.js');

const borrowAmount = etherUnsigned(10e3);
const repayAmount = etherUnsigned(10e2);

async function preBorrow(pToken, borrower, borrowAmount) {
  await send(pToken.controller, 'setBorrowAllowed', [true]);
  await send(pToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(pToken, 'harnessSetFailTransferToAddress', [borrower, false]);
  await send(pToken, 'harnessSetAccountBorrows', [borrower, 0, 0]);
  await send(pToken, 'harnessSetTotalBorrows', [0]);
  await setEtherBalance(pToken, borrowAmount);
}

async function borrowFresh(pToken, borrower, borrowAmount) {
  return send(pToken, 'harnessBorrowFresh', [borrower, borrowAmount], {from: borrower});
}

async function borrow(pToken, borrower, borrowAmount, opts = {}) {
  await send(pToken, 'harnessFastForward', [1]);
  return send(pToken, 'borrow', [borrowAmount], {from: borrower});
}

async function preRepay(pToken, benefactor, borrower, repayAmount) {
  // setup either benefactor OR borrower for success in repaying
  await send(pToken.controller, 'setRepayBorrowAllowed', [true]);
  await send(pToken.interestRateModel, 'setFailBorrowRate', [false]);
  await pretendBorrow(pToken, borrower, 1, 1, repayAmount);
}

async function repayBorrowFresh(pToken, payer, borrower, repayAmount) {
  return send(pToken, 'harnessRepayBorrowFresh', [payer, borrower, repayAmount], {from: payer, value: repayAmount});
}

async function repayBorrow(pToken, borrower, repayAmount) {
  await send(pToken, 'harnessFastForward', [1]);
  return send(pToken, 'repayBorrow', [], {from: borrower, value: repayAmount});
}

async function repayBorrowBehalf(pToken, payer, borrower, repayAmount) {
  await send(pToken, 'harnessFastForward', [1]);
  return send(pToken, 'repayBorrowBehalf', [borrower], {from: payer, value: repayAmount});
}

describe('PEther', function () {
  let pToken, root, borrower, benefactor, accounts;
  beforeEach(async () => {
    [root, borrower, benefactor, ...accounts] = saddle.accounts;
    pToken = await makePToken({kind: 'pether', controllerOpts: {kind: 'bool'}});
  });

  describe('borrowFresh', () => {
    beforeEach(async () => await preBorrow(pToken, borrower, borrowAmount));

    it("fails if controller tells it to", async () => {
      await send(pToken.controller, 'setBorrowAllowed', [false]);
      expect(await borrowFresh(pToken, borrower, borrowAmount)).toHaveTrollReject('BORROW_CONTROLLER_REJECTION');
    });

    it("proceeds if controller tells it to", async () => {
      await expect(await borrowFresh(pToken, borrower, borrowAmount)).toSucceed();
    });

    it("fails if market not fresh", async () => {
      await fastForward(pToken);
      expect(await borrowFresh(pToken, borrower, borrowAmount)).toHaveTokenFailure('MARKET_NOT_FRESH', 'BORROW_FRESHNESS_CHECK');
    });

    it("continues if fresh", async () => {
      await expect(await send(pToken, 'accrueInterest')).toSucceed();
      await expect(await borrowFresh(pToken, borrower, borrowAmount)).toSucceed();
    });

    it("fails if protocol has less than borrowAmount of underlying", async () => {
      expect(await borrowFresh(pToken, borrower, borrowAmount.plus(1))).toHaveTokenFailure('TOKEN_INSUFFICIENT_CASH', 'BORROW_CASH_NOT_AVAILABLE');
    });

    it("fails if borrowBalanceStored fails (due to non-zero stored principal with zero account index)", async () => {
      await pretendBorrow(pToken, borrower, 0, 3e18, 5e18);
      expect(await borrowFresh(pToken, borrower, borrowAmount)).toHaveTokenFailure('MATH_ERROR', 'BORROW_ACCUMULATED_BALANCE_CALCULATION_FAILED');
    });

    it("fails if calculating account new total borrow balance overflows", async () => {
      await pretendBorrow(pToken, borrower, 1e-18, 1e-18, UInt256Max());
      expect(await borrowFresh(pToken, borrower, borrowAmount)).toHaveTokenFailure('MATH_ERROR', 'BORROW_NEW_ACCOUNT_BORROW_BALANCE_CALCULATION_FAILED');
    });

    it("fails if calculation of new total borrow balance overflows", async () => {
      await send(pToken, 'harnessSetTotalBorrows', [UInt256Max()]);
      expect(await borrowFresh(pToken, borrower, borrowAmount)).toHaveTokenFailure('MATH_ERROR', 'BORROW_NEW_TOTAL_BALANCE_CALCULATION_FAILED');
    });

    it("reverts if transfer out fails", async () => {
      await send(pToken, 'harnessSetFailTransferToAddress', [borrower, true]);
      await expect(borrowFresh(pToken, borrower, borrowAmount)).rejects.toRevert("revert TOKEN_TRANSFER_OUT_FAILED");
    });

    it("transfers the underlying cash, tokens, and emits Borrow event", async () => {
      const beforeBalances = await getBalances([pToken], [borrower]);
      const beforeProtocolBorrows = await totalBorrows(pToken);
      const result = await borrowFresh(pToken, borrower, borrowAmount);
      const afterBalances = await getBalances([pToken], [borrower]);
      expect(result).toSucceed();
      expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
        [pToken, 'eth', -borrowAmount],
        [pToken, 'borrows', borrowAmount],
        [pToken, borrower, 'eth', borrowAmount.minus(await etherGasCost(result))],
        [pToken, borrower, 'borrows', borrowAmount]
      ]));
      expect(result).toHaveLog('Borrow', {
        borrower: borrower,
        borrowAmount: borrowAmount.toString(),
        accountBorrows: borrowAmount.toString(),
        totalBorrows: beforeProtocolBorrows.plus(borrowAmount).toString()
      });
    });

    it("stores new borrow principal and interest index", async () => {
      const beforeProtocolBorrows = await totalBorrows(pToken);
      await pretendBorrow(pToken, borrower, 0, 3, 0);
      await borrowFresh(pToken, borrower, borrowAmount);
      const borrowSnap = await borrowSnapshot(pToken, borrower);
      expect(borrowSnap.principal).toEqualNumber(borrowAmount);
      expect(borrowSnap.interestIndex).toEqualNumber(etherMantissa(3));
      expect(await totalBorrows(pToken)).toEqualNumber(beforeProtocolBorrows.plus(borrowAmount));
    });
  });

  describe('borrow', () => {
    beforeEach(async () => await preBorrow(pToken, borrower, borrowAmount));

    it("emits a borrow failure if interest accrual fails", async () => {
      await send(pToken.interestRateModel, 'setFailBorrowRate', [true]);
      await send(pToken, 'harnessFastForward', [1]);
      await expect(borrow(pToken, borrower, borrowAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from borrowFresh without emitting any extra logs", async () => {
      expect(await borrow(pToken, borrower, borrowAmount.plus(1))).toHaveTokenFailure('TOKEN_INSUFFICIENT_CASH', 'BORROW_CASH_NOT_AVAILABLE');
    });

    it("returns success from borrowFresh and transfers the correct amount", async () => {
      const beforeBalances = await getBalances([pToken], [borrower]);
      await fastForward(pToken);
      const result = await borrow(pToken, borrower, borrowAmount);
      const afterBalances = await getBalances([pToken], [borrower]);
      expect(result).toSucceed();
      expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
        [pToken, 'eth', -borrowAmount],
        [pToken, 'borrows', borrowAmount],
        [pToken, borrower, 'eth', borrowAmount.minus(await etherGasCost(result))],
        [pToken, borrower, 'borrows', borrowAmount]
      ]));
    });
  });

  describe('repayBorrowFresh', () => {
    [true, false].forEach(async (benefactorPaying) => {
      let payer;
      const label = benefactorPaying ? "benefactor paying" : "borrower paying";
      describe(label, () => {
        beforeEach(async () => {
          payer = benefactorPaying ? benefactor : borrower;

          await preRepay(pToken, payer, borrower, repayAmount);
        });

        it("fails if repay is not allowed", async () => {
          await send(pToken.controller, 'setRepayBorrowAllowed', [false]);
          expect(await repayBorrowFresh(pToken, payer, borrower, repayAmount)).toHaveTrollReject('REPAY_BORROW_CONTROLLER_REJECTION', 'MATH_ERROR');
        });

        it("fails if block number ≠ current block number", async () => {
          await fastForward(pToken);
          expect(await repayBorrowFresh(pToken, payer, borrower, repayAmount)).toHaveTokenFailure('MARKET_NOT_FRESH', 'REPAY_BORROW_FRESHNESS_CHECK');
        });

        it.skip("returns an error if calculating account new account borrow balance fails", async () => {
          await pretendBorrow(pToken, borrower, 1, 1, 1);
          await expect(repayBorrowFresh(pToken, payer, borrower, repayAmount)).rejects.toRevert('revert REPAY_BORROW_NEW_ACCOUNT_BORROW_BALANCE_CALCULATION_FAILED');
        });

        it.skip("returns an error if calculation of new total borrow balance fails", async () => {
          await send(pToken, 'harnessSetTotalBorrows', [1]);
          await expect(repayBorrowFresh(pToken, payer, borrower, repayAmount)).rejects.toRevert('revert REPAY_BORROW_NEW_TOTAL_BALANCE_CALCULATION_FAILED');
        });

        it("reverts if checkTransferIn fails", async () => {
          await expect(
            send(pToken, 'harnessRepayBorrowFresh', [payer, borrower, repayAmount], {from: root, value: repayAmount})
          ).rejects.toRevert("revert sender mismatch");
          await expect(
            send(pToken, 'harnessRepayBorrowFresh', [payer, borrower, repayAmount], {from: payer, value: 1})
          ).rejects.toRevert("revert value mismatch");
        });

        it("transfers the underlying cash, and emits RepayBorrow event", async () => {
          const beforeBalances = await getBalances([pToken], [borrower]);
          const result = await repayBorrowFresh(pToken, payer, borrower, repayAmount);
          const afterBalances = await getBalances([pToken], [borrower]);
          expect(result).toSucceed();
          if (borrower == payer) {
            expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
              [pToken, 'eth', repayAmount],
              [pToken, 'borrows', -repayAmount],
              [pToken, borrower, 'borrows', -repayAmount],
              [pToken, borrower, 'eth', -repayAmount.plus(await etherGasCost(result))]
            ]));
          } else {
            expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
              [pToken, 'eth', repayAmount],
              [pToken, 'borrows', -repayAmount],
              [pToken, borrower, 'borrows', -repayAmount],
            ]));
          }
          expect(result).toHaveLog('RepayBorrow', {
            payer: payer,
            borrower: borrower,
            repayAmount: repayAmount.toString(),
            accountBorrows: "0",
            totalBorrows: "0"
          });
        });

        it("stores new borrow principal and interest index", async () => {
          const beforeProtocolBorrows = await totalBorrows(pToken);
          const beforeAccountBorrowSnap = await borrowSnapshot(pToken, borrower);
          expect(await repayBorrowFresh(pToken, payer, borrower, repayAmount)).toSucceed();
          const afterAccountBorrows = await borrowSnapshot(pToken, borrower);
          expect(afterAccountBorrows.principal).toEqualNumber(beforeAccountBorrowSnap.principal.minus(repayAmount));
          expect(afterAccountBorrows.interestIndex).toEqualNumber(etherMantissa(1));
          expect(await totalBorrows(pToken)).toEqualNumber(beforeProtocolBorrows.minus(repayAmount));
        });
      });
    });
  });

  describe('repayBorrow', () => {
    beforeEach(async () => {
      await preRepay(pToken, borrower, borrower, repayAmount);
    });

    it("reverts if interest accrual fails", async () => {
      await send(pToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(repayBorrow(pToken, borrower, repayAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("reverts when repay borrow fresh fails", async () => {
      await send(pToken.controller, 'setRepayBorrowAllowed', [false]);
      await expect(repayBorrow(pToken, borrower, repayAmount)).rejects.toRevertWithError('CONTROLLER_REJECTION', "revert repayBorrow failed");
    });

    it("returns success from repayBorrowFresh and repays the right amount", async () => {
      await fastForward(pToken);
      const beforeAccountBorrowSnap = await borrowSnapshot(pToken, borrower);
      expect(await repayBorrow(pToken, borrower, repayAmount)).toSucceed();
      const afterAccountBorrowSnap = await borrowSnapshot(pToken, borrower);
      expect(afterAccountBorrowSnap.principal).toEqualNumber(beforeAccountBorrowSnap.principal.minus(repayAmount));
    });

    it("reverts if overpaying", async () => {
      const beforeAccountBorrowSnap = await borrowSnapshot(pToken, borrower);
      let tooMuch = new BigNumber(beforeAccountBorrowSnap.principal).plus(1);
      await expect(repayBorrow(pToken, borrower, tooMuch)).rejects.toRevert("revert value mismatch");
    });
  });

  describe('repayBorrowBehalf', () => {
    let payer;

    beforeEach(async () => {
      payer = benefactor;
      await preRepay(pToken, payer, borrower, repayAmount);
    });

    it("reverts if interest accrual fails", async () => {
      await send(pToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(repayBorrowBehalf(pToken, payer, borrower, repayAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("reverts from within repay borrow fresh", async () => {
      await send(pToken.controller, 'setRepayBorrowAllowed', [false]);
      await expect(repayBorrowBehalf(pToken, payer, borrower, repayAmount)).rejects.toRevertWithError('CONTROLLER_REJECTION', "revert repayBorrowBehalf failed");
    });

    it("returns success from repayBorrowFresh and repays the right amount", async () => {
      await fastForward(pToken);
      const beforeAccountBorrowSnap = await borrowSnapshot(pToken, borrower);
      expect(await repayBorrowBehalf(pToken, payer, borrower, repayAmount)).toSucceed();
      const afterAccountBorrowSnap = await borrowSnapshot(pToken, borrower);
      expect(afterAccountBorrowSnap.principal).toEqualNumber(beforeAccountBorrowSnap.principal.minus(repayAmount));
    });
  });
});
