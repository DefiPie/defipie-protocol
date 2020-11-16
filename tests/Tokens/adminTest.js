const {makePToken} = require('../Utils/DeFiPie');

describe('admin / _setPendingAdmin / _acceptAdmin', () => {
  let pToken, root, accounts;

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
  });

  describe('admin()', () => {
      it('should return correct admin', async () => {
          pToken = await makePToken();
          expect(await call(pToken, 'getMyAdmin')).toEqual(root);
      });
  });
});
