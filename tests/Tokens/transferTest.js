const {makePToken} = require('../Utils/DeFiPie');

describe('PToken', function () {
  let root, accounts;
  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
  });

  describe('transfer', () => {
    it("cannot transfer from a zero balance", async () => {
      const pToken = await makePToken({supportMarket: true});
      expect(await call(pToken, 'balanceOf', [root])).toEqualNumber(0);
      expect(await send(pToken, 'transfer', [accounts[0], 100])).toHaveTokenFailure('MATH_ERROR', 'TRANSFER_NOT_ENOUGH');
    });

    it("transfers 50 tokens", async () => {
      const pToken = await makePToken({supportMarket: true});
      await send(pToken, 'harnessSetBalance', [root, 100]);
      expect(await call(pToken, 'balanceOf', [root])).toEqualNumber(100);
      await send(pToken, 'transfer', [accounts[0], 50]);
      expect(await call(pToken, 'balanceOf', [root])).toEqualNumber(50);
      expect(await call(pToken, 'balanceOf', [accounts[0]])).toEqualNumber(50);
    });

    it("doesn't transfer when src == dst", async () => {
      const pToken = await makePToken({supportMarket: true});
      await send(pToken, 'harnessSetBalance', [root, 100]);
      expect(await call(pToken, 'balanceOf', [root])).toEqualNumber(100);
      expect(await send(pToken, 'transfer', [root, 50])).toHaveTokenFailure('BAD_INPUT', 'TRANSFER_NOT_ALLOWED');
    });

    it("rejects transfer when not allowed and reverts if not verified", async () => {
      const pToken = await makePToken({controllerOpts: {kind: 'bool'}});
      await send(pToken, 'harnessSetBalance', [root, 100]);
      expect(await call(pToken, 'balanceOf', [root])).toEqualNumber(100);

      await send(pToken.controller, 'setTransferAllowed', [false])
      expect(await send(pToken, 'transfer', [root, 50])).toHaveTrollReject('TRANSFER_CONTROLLER_REJECTION');

      await send(pToken.controller, 'setTransferAllowed', [true])
      await send(pToken.controller, 'setTransferVerify', [false])
      await expect(send(pToken, 'transfer', [accounts[0], 50])).rejects.toRevert("revert transferVerify rejected transfer");
    });
  });
});