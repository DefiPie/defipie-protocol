const {
  makePToken,
  getBalances,
  adjustBalances
} = require('../Utils/DeFiPie');

describe('PEther', function () {
  let root, nonRoot, accounts;
  let pToken;
  beforeEach(async () => {
    [root, nonRoot, ...accounts] = saddle.accounts;
    pToken = await makePToken({kind: 'pether', controllerOpts: {kind: 'bool'}});
  });

  describe("getCashPrior", () => {
    it("returns the amount of ether held by the pEther contract before the current message", async () => {
      expect(await call(pToken, 'harnessGetCashPrior', [], {value: 100})).toEqualNumber(0);
    });
  });

  describe("doTransferIn", () => {
    it("succeeds if from is msg.nonRoot and amount is msg.value", async () => {
      expect(await call(pToken, 'harnessDoTransferIn', [root, 100], {value: 100})).toEqualNumber(100);
    });

    it("reverts if from != msg.sender", async () => {
      await expect(call(pToken, 'harnessDoTransferIn', [nonRoot, 100], {value: 100})).rejects.toRevert("revert sender mismatch");
    });

    it("reverts if amount != msg.value", async () => {
      await expect(call(pToken, 'harnessDoTransferIn', [root, 77], {value: 100})).rejects.toRevert("revert value mismatch");
    });

    describe("doTransferOut", () => {
      it("transfers ether out", async () => {
        const beforeBalances = await getBalances([pToken], [nonRoot]);
        const receipt = await send(pToken, 'harnessDoTransferOut', [nonRoot, 77], {value: 77});
        const afterBalances = await getBalances([pToken], [nonRoot]);
        expect(receipt).toSucceed();
        expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
          [pToken, nonRoot, 'eth', 77]
        ]));
      });

      it("reverts if it fails", async () => {
        await expect(call(pToken, 'harnessDoTransferOut', [root, 77], {value: 0})).rejects.toRevert();
      });
    });
  });
});
