const {
  makeController,
  makePToken
} = require('../Utils/DeFiPie');

describe('PToken', function () {
  let root, accounts;
  let pToken, oldController, newController;
  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
    pToken = await makePToken();
    oldController = pToken.controller;
    newController = await makeController();
    expect(newController._address).not.toEqual(oldController._address);
  });

  describe('_setController', () => {
    it("should fail if called by non-admin", async () => {
      expect(
        await send(pToken, '_setController', [newController._address], { from: accounts[0] })
      ).toHaveTokenFailure('UNAUTHORIZED', 'SET_CONTROLLER_OWNER_CHECK');
      expect(await call(pToken, 'controller')).toEqual(oldController._address);
    });

    it("reverts if passed a contract that doesn't implement isController", async () => {
      await expect(send(pToken, '_setController', [pToken.underlying._address])).rejects.toRevert("revert");
      expect(await call(pToken, 'controller')).toEqual(oldController._address);
    });

    it("reverts if passed a contract that implements isController as false", async () => {
      // extremely unlikely to occur, of course, but let's be exhaustive
      const badController = await makeController({ kind: 'false-marker' });
      await expect(send(pToken, '_setController', [badController._address])).rejects.toRevert("revert marker method returned false");
      expect(await call(pToken, 'controller')).toEqual(oldController._address);
    });

    it("updates controller and emits log on success", async () => {
      const result = await send(pToken, '_setController', [newController._address]);
      expect(result).toSucceed();
      expect(result).toHaveLog('NewController', {
        oldController: oldController._address,
        newController: newController._address
      });
      expect(await call(pToken, 'controller')).toEqual(newController._address);
    });
  });
});
