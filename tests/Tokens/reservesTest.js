const {
  etherUnsigned,
  etherMantissa,
  both
} = require('../Utils/Ethereum');

const {fastForward, makePToken} = require('../Utils/DeFiPie');

const factor = etherMantissa(.02);

const reserves = etherUnsigned(3e12);
const cash = etherUnsigned(reserves.mul(2));
const reduction = etherUnsigned(2e12);

describe('PToken', function () {
  let root, accounts;
  let reserveFactor = 1e17;

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
  });

  describe('_setReserveFactorFresh', () => {
    let pToken;
    beforeEach(async () => {
      pToken = await makePToken();
    });

    it("rejects change by non-admin", async () => {
      expect(
        await send(pToken, 'harnessSetReserveFactorFresh', [factor], {from: accounts[0]})
      ).toHaveTokenFailure('UNAUTHORIZED', 'SET_RESERVE_FACTOR_ADMIN_CHECK');
      expect(await call(pToken, 'reserveFactorMantissa')).toEqualNumber(reserveFactor);
    });

    it("rejects change if market not fresh", async () => {
      expect(await send(pToken, 'harnessFastForward', [5])).toSucceed();
      expect(await send(pToken, 'harnessSetReserveFactorFresh', [factor])).toHaveTokenFailure('MARKET_NOT_FRESH', 'SET_RESERVE_FACTOR_FRESH_CHECK');
      expect(await call(pToken, 'reserveFactorMantissa')).toEqualNumber(reserveFactor);
    });

    it("rejects newReserveFactor that descales to 1", async () => {
      expect(await send(pToken, 'harnessSetReserveFactorFresh', [etherMantissa(1.01)])).toHaveTokenFailure('BAD_INPUT', 'SET_RESERVE_FACTOR_BOUNDS_CHECK');
      expect(await call(pToken, 'reserveFactorMantissa')).toEqualNumber(reserveFactor);
    });

    it("accepts newReserveFactor in valid range and emits log", async () => {
      const result = await send(pToken, 'harnessSetReserveFactorFresh', [factor]);
      expect(result).toSucceed();
      expect(await call(pToken, 'reserveFactorMantissa')).toEqualNumber(factor);
      expect(result).toHaveLog("NewReserveFactor", {
        oldReserveFactorMantissa: reserveFactor,
        newReserveFactorMantissa: factor.toString(),
      });
    });

    it("accepts a change back to zero", async () => {
      const result1 = await send(pToken, 'harnessSetReserveFactorFresh', [factor]);
      const result2 = await send(pToken, 'harnessSetReserveFactorFresh', [0]);
      expect(result1).toSucceed();
      expect(result2).toSucceed();
      expect(result2).toHaveLog("NewReserveFactor", {
        oldReserveFactorMantissa: factor.toString(),
        newReserveFactorMantissa: '0',
      });
      expect(await call(pToken, 'reserveFactorMantissa')).toEqualNumber(0);
    });
  });

  describe('_setReserveFactor', () => {
    let pToken;
    beforeEach(async () => {
      pToken = await makePToken();
    });

    beforeEach(async () => {
      await send(pToken.interestRateModel, 'setFailBorrowRate', [false]);
      await send(pToken, '_setReserveFactor', [0]);
    });

    it("emits a reserve factor failure if interest accrual fails", async () => {
      await send(pToken.interestRateModel, 'setFailBorrowRate', [true]);
      await fastForward(pToken, 1);
      await expect(send(pToken, '_setReserveFactor', [factor])).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
      expect(await call(pToken, 'reserveFactorMantissa')).toEqualNumber(0);
    });

    it("returns error from setReserveFactorFresh without emitting any extra logs", async () => {
      const {reply, receipt} = await both(pToken, '_setReserveFactor', [etherMantissa(2)]);
      expect(reply).toHaveTokenError('BAD_INPUT');
      expect(receipt).toHaveTokenFailure('BAD_INPUT', 'SET_RESERVE_FACTOR_BOUNDS_CHECK');
      expect(await call(pToken, 'reserveFactorMantissa')).toEqualNumber(0);
    });

    it("returns success from setReserveFactorFresh", async () => {
      expect(await call(pToken, 'reserveFactorMantissa')).toEqualNumber(0);
      expect(await send(pToken, 'harnessFastForward', [5])).toSucceed();
      expect(await send(pToken, '_setReserveFactor', [factor])).toSucceed();
      expect(await call(pToken, 'reserveFactorMantissa')).toEqualNumber(factor);
    });
  });

  describe("_reduceReservesFresh", () => {
    let pToken;
    beforeEach(async () => {
      pToken = await makePToken();
      expect(await send(pToken, 'harnessSetTotalReserves', [reserves])).toSucceed();
      expect(
        await send(pToken.underlying, 'harnessSetBalance', [pToken._address, cash])
      ).toSucceed();
    });

    it("fails if called by non-admin", async () => {
      expect(
        await send(pToken, 'harnessReduceReservesFresh', [reduction], {from: accounts[0]})
      ).toHaveTokenFailure('UNAUTHORIZED', 'REDUCE_RESERVES_ADMIN_CHECK');
      expect(await call(pToken, 'totalReserves')).toEqualNumber(reserves);
    });

    it("fails if market not fresh", async () => {
      expect(await send(pToken, 'harnessFastForward', [5])).toSucceed();
      expect(await send(pToken, 'harnessReduceReservesFresh', [reduction])).toHaveTokenFailure('MARKET_NOT_FRESH', 'REDUCE_RESERVES_FRESH_CHECK');
      expect(await call(pToken, 'totalReserves')).toEqualNumber(reserves);
    });

    it("fails if amount exceeds reserves", async () => {
      expect(await send(pToken, 'harnessReduceReservesFresh', [reserves.add(1)])).toHaveTokenFailure('BAD_INPUT', 'REDUCE_RESERVES_VALIDATION');
      expect(await call(pToken, 'totalReserves')).toEqualNumber(reserves);
    });

    it("fails if amount exceeds available cash", async () => {
      const cashLessThanReserves = reserves.sub(2);
      await send(pToken.underlying, 'harnessSetBalance', [pToken._address, cashLessThanReserves]);
      expect(await send(pToken, 'harnessReduceReservesFresh', [reserves])).toHaveTokenFailure('TOKEN_INSUFFICIENT_CASH', 'REDUCE_RESERVES_CASH_NOT_AVAILABLE');
      expect(await call(pToken, 'totalReserves')).toEqualNumber(reserves);
    });

    it("increases admin balance and reduces reserves on success", async () => {
      const balance = etherUnsigned(await call(pToken.underlying, 'balanceOf', [root]));
      expect(await send(pToken, 'harnessReduceReservesFresh', [reserves])).toSucceed();
      expect(await call(pToken.underlying, 'balanceOf', [root])).toEqualNumber(balance.add(reserves));
      expect(await call(pToken, 'totalReserves')).toEqualNumber(0);
    });

    it("emits an event on success", async () => {
      const result = await send(pToken, 'harnessReduceReservesFresh', [reserves]);
      expect(result).toHaveLog('ReservesReduced', {
        admin: root,
        reduceAmount: reserves.toString(),
        newTotalReserves: '0'
      });
    });
  });

  describe("_reduceReserves", () => {
    let pToken;
    beforeEach(async () => {
      pToken = await makePToken();
      await send(pToken.interestRateModel, 'setFailBorrowRate', [false]);
      expect(await send(pToken, 'harnessSetTotalReserves', [reserves])).toSucceed();
      expect(
        await send(pToken.underlying, 'harnessSetBalance', [pToken._address, cash])
      ).toSucceed();
    });

    it("emits a reserve-reduction failure if interest accrual fails", async () => {
      await send(pToken.interestRateModel, 'setFailBorrowRate', [true]);
      await fastForward(pToken, 1);
      await expect(send(pToken, '_reduceReserves', [reduction])).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from _reduceReservesFresh without emitting any extra logs", async () => {
      const {reply, receipt} = await both(pToken, 'harnessReduceReservesFresh', [reserves.add(1)]);
      expect(reply).toHaveTokenError('BAD_INPUT');
      expect(receipt).toHaveTokenFailure('BAD_INPUT', 'REDUCE_RESERVES_VALIDATION');
    });

    it("returns success code from _reduceReservesFresh and reduces the correct amount", async () => {
      expect(await call(pToken, 'totalReserves')).toEqualNumber(reserves);
      expect(await send(pToken, 'harnessFastForward', [5])).toSucceed();
      expect(await send(pToken, '_reduceReserves', [reduction])).toSucceed();
    });
  });
});
