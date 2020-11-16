const {
  etherBalance,
  etherGasCost
} = require('./Utils/Ethereum');

const {
  makePToken,
  pretendBorrow,
  borrowSnapshot
} = require('./Utils/DeFiPie');

describe('Maximillion', () => {
  let root, borrower;
  let maximillion, pEther;
  beforeEach(async () => {
    [root, borrower] = saddle.accounts;
    pEther = await makePToken({kind: "pether", supportMarket: true});
    maximillion = await deploy('Maximillion', [pEther._address]);
  });

  describe("constructor", () => {
    it("sets address of pEther", async () => {
      expect(await call(maximillion, "pEther")).toEqual(pEther._address);
    });
  });

  describe("repayBehalf", () => {
    it("refunds the entire amount with no borrows", async () => {
      const beforeBalance = await etherBalance(root);
      const result = await send(maximillion, "repayBehalf", [borrower], {value: 100});
      const gasCost = await etherGasCost(result);
      const afterBalance = await etherBalance(root);
      expect(result).toSucceed();
      expect(afterBalance).toEqualNumber(beforeBalance.sub(gasCost));
    });

    it("repays part of a borrow", async () => {
      await pretendBorrow(pEther, borrower, 1, 1, 150);
      const beforeBalance = await etherBalance(root);
      const result = await send(maximillion, "repayBehalf", [borrower], {value: 100});
      const gasCost = await etherGasCost(result);
      const afterBalance = await etherBalance(root);
      const afterBorrowSnap = await borrowSnapshot(pEther, borrower);
      expect(result).toSucceed();
      expect(afterBalance).toEqualNumber(beforeBalance.sub(gasCost).sub(100));
      expect(afterBorrowSnap.principal).toEqualNumber(50);
    });

    it("repays a full borrow and refunds the rest", async () => {
      await pretendBorrow(pEther, borrower, 1, 1, 90);
      const beforeBalance = await etherBalance(root);
      const result = await send(maximillion, "repayBehalf", [borrower], {value: 100});
      const gasCost = await etherGasCost(result);
      const afterBalance = await etherBalance(root);
      const afterBorrowSnap = await borrowSnapshot(pEther, borrower);
      expect(result).toSucceed();
      expect(afterBalance).toEqualNumber(beforeBalance.sub(gasCost).sub(90));
      expect(afterBorrowSnap.principal).toEqualNumber(0);
    });
  });
});
