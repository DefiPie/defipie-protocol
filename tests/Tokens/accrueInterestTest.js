const {
  etherMantissa,
  etherUnsigned
} = require('../Utils/Ethereum');
const {
  makePToken,
  setBorrowRate
} = require('../Utils/DeFiPie');

const blockNumber = 2e7;
const borrowIndex = 1e18;
const borrowRate = .000001;

async function pretendBlock(pToken, accrualBlock = blockNumber, deltaBlocks = 1) {
  await send(pToken, 'harnessSetAccrualBlockNumber', [etherUnsigned(blockNumber)]);
  await send(pToken, 'harnessSetBlockNumber', [etherUnsigned(blockNumber + deltaBlocks)]);
  await send(pToken, 'harnessSetBorrowIndex', [etherUnsigned(borrowIndex)]);
}

async function preAccrue(pToken) {
  await setBorrowRate(pToken, borrowRate);
  await send(pToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(pToken, 'harnessExchangeRateDetails', [0, 0, 0]);
}

describe('PToken', () => {
  let root, accounts;
  let pToken;
  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
    pToken = await makePToken({controllerOpts: {kind: 'bool'}});
  });

  beforeEach(async () => {
    await preAccrue(pToken);
  });

  describe('accrueInterest', () => {
    it('reverts if the interest rate is absurdly high', async () => {
      await pretendBlock(pToken, blockNumber, 1);
      expect(await call(pToken, 'getBorrowRateMaxMantissa')).toEqualNumber(etherMantissa(0.000005)); // 0.0005% per block
      await setBorrowRate(pToken, 0.001e-2); // 0.0010% per block
      await expect(send(pToken, 'accrueInterest')).rejects.toRevert("revert borrow rate is absurdly high");
    });

    it('fails if new borrow rate calculation fails', async () => {
      await pretendBlock(pToken, blockNumber, 1);
      await send(pToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(send(pToken, 'accrueInterest')).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it('fails if simple interest factor calculation fails', async () => {
      await pretendBlock(pToken, blockNumber, 5e70);
      expect(await send(pToken, 'accrueInterest')).toHaveTokenFailure('MATH_ERROR', 'ACCRUE_INTEREST_SIMPLE_INTEREST_FACTOR_CALCULATION_FAILED');
    });

    it('fails if new borrow index calculation fails', async () => {
      await pretendBlock(pToken, blockNumber, 5e60);
      expect(await send(pToken, 'accrueInterest')).toHaveTokenFailure('MATH_ERROR', 'ACCRUE_INTEREST_NEW_BORROW_INDEX_CALCULATION_FAILED');
    });

    it('fails if new borrow interest index calculation fails', async () => {
      await pretendBlock(pToken);
      await send(pToken, 'harnessSetBorrowIndex', [-1]);
      expect(await send(pToken, 'accrueInterest')).toHaveTokenFailure('MATH_ERROR', 'ACCRUE_INTEREST_NEW_BORROW_INDEX_CALCULATION_FAILED');
    });

    it('fails if interest accumulated calculation fails', async () => {
      await send(pToken, 'harnessExchangeRateDetails', [0, -1, 0]);
      await pretendBlock(pToken);
      expect(await send(pToken, 'accrueInterest')).toHaveTokenFailure('MATH_ERROR', 'ACCRUE_INTEREST_ACCUMULATED_INTEREST_CALCULATION_FAILED');
    });

    it('fails if new total borrows calculation fails', async () => {
      await setBorrowRate(pToken, 1e-18);
      await pretendBlock(pToken);
      await send(pToken, 'harnessExchangeRateDetails', [0, -1, 0]);
      expect(await send(pToken, 'accrueInterest')).toHaveTokenFailure('MATH_ERROR', 'ACCRUE_INTEREST_NEW_TOTAL_BORROWS_CALCULATION_FAILED');
    });

    it('fails if interest accumulated for reserves calculation fails', async () => {
      await setBorrowRate(pToken, .000001);
      await send(pToken, 'harnessExchangeRateDetails', [0, etherUnsigned(1e30), -1]);
      await send(pToken, 'harnessSetReserveFactorFresh', [etherUnsigned(1e10)]);
      await pretendBlock(pToken, blockNumber, 5e20);
      expect(await send(pToken, 'accrueInterest')).toHaveTokenFailure('MATH_ERROR', 'ACCRUE_INTEREST_NEW_TOTAL_RESERVES_CALCULATION_FAILED');
    });

    it('fails if new total reserves calculation fails', async () => {
      await setBorrowRate(pToken, 1e-18);
      await send(pToken, 'harnessExchangeRateDetails', [0, etherUnsigned(1e56), -1]);
      await send(pToken, 'harnessSetReserveFactorFresh', [etherUnsigned(1e17)]);
      await pretendBlock(pToken);
      expect(await send(pToken, 'accrueInterest')).toHaveTokenFailure('MATH_ERROR', 'ACCRUE_INTEREST_NEW_TOTAL_RESERVES_CALCULATION_FAILED');
    });

    it('succeeds and saves updated values in storage on success', async () => {
      const startingTotalBorrows = 1e22;
      const startingTotalReserves = 1e20;
      const reserveFactor = 1e17;

      await send(pToken, 'harnessExchangeRateDetails', [0, etherUnsigned(startingTotalBorrows), etherUnsigned(startingTotalReserves)]);
      await send(pToken, 'harnessSetReserveFactorFresh', [etherUnsigned(reserveFactor)]);
      await pretendBlock(pToken);

      const expectedAccrualBlockNumber = blockNumber + 1;
      const expectedBorrowIndex = borrowIndex + borrowIndex * borrowRate;
      const expectedTotalBorrows = startingTotalBorrows + startingTotalBorrows * borrowRate;
      const expectedTotalReserves = startingTotalReserves + startingTotalBorrows *  borrowRate * reserveFactor / 1e18;

      const receipt = await send(pToken, 'accrueInterest');
      expect(receipt).toSucceed();
      expect(receipt).toHaveLog('AccrueInterest', {
        cashPrior: 0,
        interestAccumulated: etherUnsigned(expectedTotalBorrows).sub(etherUnsigned(startingTotalBorrows)),
        borrowIndex: etherUnsigned(expectedBorrowIndex),
        totalBorrows: etherUnsigned(expectedTotalBorrows)
      });
      expect(await call(pToken, 'accrualBlockNumber')).toEqualNumber(expectedAccrualBlockNumber);
      expect(await call(pToken, 'borrowIndex')).toEqualNumber(expectedBorrowIndex);
      expect(await call(pToken, 'totalBorrows')).toEqualNumber(expectedTotalBorrows);
      expect(await call(pToken, 'totalReserves')).toEqualNumber(expectedTotalReserves);
    });
  });
});
