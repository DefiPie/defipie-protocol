const {
  etherUnsigned,
  etherMantissa
} = require('../Utils/Ethereum');

const {
  makePToken,
  balanceOf,
  borrowSnapshot,
  totalBorrows,
  fastForward,
  setBalance,
  preApprove,
  pretendBorrow
} = require('../Utils/DeFiPie');

const borrowAmount = etherUnsigned(10e3);
const repayAmount = etherUnsigned(10e2);

async function preBorrow(pToken, borrower, borrowAmount) {
  await send(pToken.controller, 'setBorrowAllowed', [true]);
  await send(pToken.controller, 'setBorrowVerify', [true]);
  await send(pToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(pToken.underlying, 'harnessSetBalance', [pToken._address, borrowAmount]);
  await send(pToken, 'harnessSetFailTransferToAddress', [borrower, false]);
  await send(pToken, 'harnessSetAccountBorrows', [borrower, 0, 0]);
  await send(pToken, 'harnessSetTotalBorrows', [0]);
}

async function borrowFresh(pToken, borrower, borrowAmount) {
  return send(pToken, 'harnessBorrowFresh', [borrower, borrowAmount]);
}

async function borrow(pToken, borrower, borrowAmount, opts = {}) {
  // make sure to have a block delta so we accrue interest
  await send(pToken, 'harnessFastForward', [1]);
  return send(pToken, 'borrow', [borrowAmount], {from: borrower});
}

async function preRepay(pToken, benefactor, borrower, repayAmount) {
  // setup either benefactor OR borrower for success in repaying
  await send(pToken.controller, 'setRepayBorrowAllowed', [true]);
  await send(pToken.controller, 'setRepayBorrowVerify', [true]);
  await send(pToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(pToken.underlying, 'harnessSetFailTransferFromAddress', [benefactor, false]);
  await send(pToken.underlying, 'harnessSetFailTransferFromAddress', [borrower, false]);
  await pretendBorrow(pToken, borrower, 1, 1, repayAmount);
  await preApprove(pToken, benefactor, repayAmount);
  await preApprove(pToken, borrower, repayAmount);
}

async function repayBorrowFresh(pToken, payer, borrower, repayAmount) {
  return send(pToken, 'harnessRepayBorrowFresh', [payer, borrower, repayAmount], {from: payer});
}

async function repayBorrow(pToken, borrower, repayAmount) {
  // make sure to have a block delta so we accrue interest
  await send(pToken, 'harnessFastForward', [1]);
  return send(pToken, 'repayBorrow', [repayAmount], {from: borrower});
}

async function repayBorrowBehalf(pToken, payer, borrower, repayAmount) {
  // make sure to have a block delta so we accrue interest
  await send(pToken, 'harnessFastForward', [1]);
  return send(pToken, 'repayBorrowBehalf', [borrower, repayAmount], {from: payer});
}

describe('PToken', function () {
  let pToken, root, borrower, benefactor, accounts;
  beforeEach(async () => {
    [root, borrower, benefactor, ...accounts] = saddle.accounts;
    pToken = await makePToken({controllerOpts: {kind: 'bool'}});
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

    it("fails if error if protocol has less than borrowAmount of underlying", async () => {
      expect(await borrowFresh(pToken, borrower, borrowAmount.add(1))).toHaveTokenFailure('TOKEN_INSUFFICIENT_CASH', 'BORROW_CASH_NOT_AVAILABLE');
    });

    it("fails if borrowBalanceStored fails (due to non-zero stored principal with zero account index)", async () => {
      await pretendBorrow(pToken, borrower, 0, 3e18, 5e18);
      expect(await borrowFresh(pToken, borrower, borrowAmount)).toHaveTokenFailure('MATH_ERROR', 'BORROW_ACCUMULATED_BALANCE_CALCULATION_FAILED');
    });

    it("fails if calculating account new total borrow balance overflows", async () => {
      await pretendBorrow(pToken, borrower, 1e-18, 1e-18, -1);
      expect(await borrowFresh(pToken, borrower, borrowAmount)).toHaveTokenFailure('MATH_ERROR', 'BORROW_NEW_ACCOUNT_BORROW_BALANCE_CALCULATION_FAILED');
    });

    it("fails if calculation of new total borrow balance overflows", async () => {
      await send(pToken, 'harnessSetTotalBorrows', [-1]);
      expect(await borrowFresh(pToken, borrower, borrowAmount)).toHaveTokenFailure('MATH_ERROR', 'BORROW_NEW_TOTAL_BALANCE_CALCULATION_FAILED');
    });

    it("reverts if transfer out fails", async () => {
      await send(pToken, 'harnessSetFailTransferToAddress', [borrower, true]);
      await expect(borrowFresh(pToken, borrower, borrowAmount)).rejects.toRevert("revert TOKEN_TRANSFER_OUT_FAILED");
    });

    it("reverts if borrowVerify fails", async() => {
      await send(pToken.controller, 'setBorrowVerify', [false]);
      await expect(borrowFresh(pToken, borrower, borrowAmount)).rejects.toRevert("revert borrowVerify rejected borrow");
    });

    it("transfers the underlying cash, tokens, and emits Transfer, Borrow events", async () => {
      const beforeProtocolCash = await balanceOf(pToken.underlying, pToken._address);
      const beforeProtocolBorrows = await totalBorrows(pToken);
      const beforeAccountCash = await balanceOf(pToken.underlying, borrower);
      const result = await borrowFresh(pToken, borrower, borrowAmount);
      expect(result).toSucceed();
      expect(await balanceOf(pToken.underlying, borrower)).toEqualNumber(beforeAccountCash.add(borrowAmount));
      expect(await balanceOf(pToken.underlying, pToken._address)).toEqualNumber(beforeProtocolCash.sub(borrowAmount));
      expect(await totalBorrows(pToken)).toEqualNumber(beforeProtocolBorrows.add(borrowAmount));
      expect(result).toHaveLog('Transfer', {
        from: pToken._address,
        to: borrower,
        amount: borrowAmount.toString()
      });
      expect(result).toHaveLog('Borrow', {
        borrower: borrower,
        borrowAmount: borrowAmount.toString(),
        accountBorrows: borrowAmount.toString(),
        totalBorrows: beforeProtocolBorrows.add(borrowAmount).toString()
      });
    });

    it("stores new borrow principal and interest index", async () => {
      const beforeProtocolBorrows = await totalBorrows(pToken);
      await pretendBorrow(pToken, borrower, 0, 3, 0);
      await borrowFresh(pToken, borrower, borrowAmount);
      const borrowSnap = await borrowSnapshot(pToken, borrower);
      expect(borrowSnap.principal).toEqualNumber(borrowAmount);
      expect(borrowSnap.interestIndex).toEqualNumber(etherMantissa(3));
      expect(await totalBorrows(pToken)).toEqualNumber(beforeProtocolBorrows.add(borrowAmount));
    });
  });

  describe('borrow', () => {
    beforeEach(async () => await preBorrow(pToken, borrower, borrowAmount));

    it("emits a borrow failure if interest accrual fails", async () => {
      await send(pToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(borrow(pToken, borrower, borrowAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from borrowFresh without emitting any extra logs", async () => {
      expect(await borrow(pToken, borrower, borrowAmount.add(1))).toHaveTokenFailure('TOKEN_INSUFFICIENT_CASH', 'BORROW_CASH_NOT_AVAILABLE');
    });

    it("returns success from borrowFresh and transfers the correct amount", async () => {
      const beforeAccountCash = await balanceOf(pToken.underlying, borrower);
      await fastForward(pToken);
      expect(await borrow(pToken, borrower, borrowAmount)).toSucceed();
      expect(await balanceOf(pToken.underlying, borrower)).toEqualNumber(beforeAccountCash.add(borrowAmount));
    });
  });

  describe('repayBorrowFresh', () => {
    [true, false].forEach((benefactorIsPayer) => {
      let payer;
      const label = benefactorIsPayer ? "benefactor paying" : "borrower paying";
      describe(label, () => {
        beforeEach(async () => {
          payer = benefactorIsPayer ? benefactor : borrower;
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

        it("fails if insufficient approval", async() => {
          await preApprove(pToken, payer, 1);
          await expect(repayBorrowFresh(pToken, payer, borrower, repayAmount)).rejects.toRevert('revert Insufficient allowance');
        });

        it("fails if insufficient balance", async() => {
          await setBalance(pToken.underlying, payer, 1);
          await expect(repayBorrowFresh(pToken, payer, borrower, repayAmount)).rejects.toRevert('revert Insufficient balance');
        });


        it("returns an error if calculating account new account borrow balance fails", async () => {
          await pretendBorrow(pToken, borrower, 1, 1, 1);
          await expect(repayBorrowFresh(pToken, payer, borrower, repayAmount)).rejects.toRevert("revert REPAY_BORROW_NEW_ACCOUNT_BORROW_BALANCE_CALCULATION_FAILED");
        });

        it("returns an error if calculation of new total borrow balance fails", async () => {
          await send(pToken, 'harnessSetTotalBorrows', [1]);
          await expect(repayBorrowFresh(pToken, payer, borrower, repayAmount)).rejects.toRevert("revert REPAY_BORROW_NEW_TOTAL_BALANCE_CALCULATION_FAILED");
        });


        it("reverts if doTransferIn fails", async () => {
          await send(pToken.underlying, 'harnessSetFailTransferFromAddress', [payer, true]);
          await expect(repayBorrowFresh(pToken, payer, borrower, repayAmount)).rejects.toRevert("revert TOKEN_TRANSFER_IN_FAILED");
        });

        it("reverts if repayBorrowVerify fails", async() => {
          await send(pToken.controller, 'setRepayBorrowVerify', [false]);
          await expect(repayBorrowFresh(pToken, payer, borrower, repayAmount)).rejects.toRevert("revert repayBorrowVerify rejected repayBorrow");
        });

        it("transfers the underlying cash, and emits Transfer, RepayBorrow events", async () => {
          const beforeProtocolCash = await balanceOf(pToken.underlying, pToken._address);
          const result = await repayBorrowFresh(pToken, payer, borrower, repayAmount);
          expect(await balanceOf(pToken.underlying, pToken._address)).toEqualNumber(beforeProtocolCash.add(repayAmount));
          expect(result).toHaveLog('Transfer', {
            from: payer,
            to: pToken._address,
            amount: repayAmount.toString()
          });
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
          expect(afterAccountBorrows.principal).toEqualNumber(beforeAccountBorrowSnap.principal.sub(repayAmount));
          expect(afterAccountBorrows.interestIndex).toEqualNumber(etherMantissa(1));
          expect(await totalBorrows(pToken)).toEqualNumber(beforeProtocolBorrows.sub(repayAmount));
        });
      });
    });
  });

  describe('repayBorrow', () => {
    beforeEach(async () => {
      await preRepay(pToken, borrower, borrower, repayAmount);
    });

    it("emits a repay borrow failure if interest accrual fails", async () => {
      await send(pToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(repayBorrow(pToken, borrower, repayAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from repayBorrowFresh without emitting any extra logs", async () => {
      await setBalance(pToken.underlying, borrower, 1);
      await expect(repayBorrow(pToken, borrower, repayAmount)).rejects.toRevert('revert Insufficient balance');
    });

    it("returns success from repayBorrowFresh and repays the right amount", async () => {
      await fastForward(pToken);
      const beforeAccountBorrowSnap = await borrowSnapshot(pToken, borrower);
      expect(await repayBorrow(pToken, borrower, repayAmount)).toSucceed();
      const afterAccountBorrowSnap = await borrowSnapshot(pToken, borrower);
      expect(afterAccountBorrowSnap.principal).toEqualNumber(beforeAccountBorrowSnap.principal.sub(repayAmount));
    });

    it("repays the full amount owed if payer has enough", async () => {
      await fastForward(pToken);
      expect(await repayBorrow(pToken, borrower, -1)).toSucceed();
      const afterAccountBorrowSnap = await borrowSnapshot(pToken, borrower);
      expect(afterAccountBorrowSnap.principal).toEqualNumber(0);
    });

    it("fails gracefully if payer does not have enough", async () => {
      await setBalance(pToken.underlying, borrower, 3);
      await fastForward(pToken);
      await expect(repayBorrow(pToken, borrower, -1)).rejects.toRevert('revert Insufficient balance');
    });
  });

  describe('repayBorrowBehalf', () => {
    let payer;

    beforeEach(async () => {
      payer = benefactor;
      await preRepay(pToken, payer, borrower, repayAmount);
    });

    it("emits a repay borrow failure if interest accrual fails", async () => {
      await send(pToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(repayBorrowBehalf(pToken, payer, borrower, repayAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from repayBorrowFresh without emitting any extra logs", async () => {
      await setBalance(pToken.underlying, payer, 1);
      await expect(repayBorrowBehalf(pToken, payer, borrower, repayAmount)).rejects.toRevert('revert Insufficient balance');
    });

    it("returns success from repayBorrowFresh and repays the right amount", async () => {
      await fastForward(pToken);
      const beforeAccountBorrowSnap = await borrowSnapshot(pToken, borrower);
      expect(await repayBorrowBehalf(pToken, payer, borrower, repayAmount)).toSucceed();
      const afterAccountBorrowSnap = await borrowSnapshot(pToken, borrower);
      expect(afterAccountBorrowSnap.principal).toEqualNumber(beforeAccountBorrowSnap.principal.sub(repayAmount));
    });
  });
});
