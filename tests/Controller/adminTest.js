const {address} = require('../Utils/Ethereum');

const {
    makeRegistryProxy
} = require('../Utils/DeFiPie');

describe('admin / _setPendingAdmin / _acceptAdmin', () => {
  let root, accounts;
  let controller, registryProxy;

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
    registryProxy = await makeRegistryProxy();
    controller = await deploy('Unitroller', [registryProxy._address]);
  });

  describe('admin()', () => {
    it('should return correct admin', async () => {
      expect(await call(controller, 'getAdmin')).toEqual(root);
    });
  });

  describe('pendingAdmin()', () => {
    it('should return correct pending admin', async () => {
      expect(await call(registryProxy, 'pendingAdmin')).toBeAddressZero()
    });
  });

  describe('_setPendingAdmin()', () => {
    it('should only be callable by admin', async () => {
      expect(
        await send(registryProxy, '_setPendingAdmin', [accounts[0]], {from: accounts[0]})
      ).toHaveRegistryFailure('UNAUTHORIZED', 'SET_PENDING_ADMIN_OWNER_CHECK');

      // Check admin stays the same
      expect(await call(controller, 'getAdmin')).toEqual(root);
      expect(await call(registryProxy, 'pendingAdmin')).toBeAddressZero();
    });

    it('should properly set pending admin', async () => {
      expect(await send(registryProxy, '_setPendingAdmin', [accounts[0]])).toSucceed();

      // Check admin stays the same
      expect(await call(controller, 'getAdmin')).toEqual(root);
      expect(await call(registryProxy, 'pendingAdmin')).toEqual(accounts[0]);
    });

    it('should properly set pending admin twice', async () => {
      expect(await send(registryProxy, '_setPendingAdmin', [accounts[0]])).toSucceed();
      expect(await send(registryProxy, '_setPendingAdmin', [accounts[1]])).toSucceed();

      // Check admin stays the same
      expect(await call(controller, 'getAdmin')).toEqual(root);
      expect(await call(registryProxy, 'pendingAdmin')).toEqual(accounts[1]);
    });

    it('should emit event', async () => {
      const result = await send(registryProxy, '_setPendingAdmin', [accounts[0]]);
      expect(result).toHaveLog('NewPendingAdmin', {
        oldPendingAdmin: address(0),
        newPendingAdmin: accounts[0],
      });
    });
  });

  describe('_acceptAdmin()', () => {
    it('should fail when pending admin is zero', async () => {
      expect(await send(registryProxy, '_acceptAdmin')).toHaveTrollFailure('UNAUTHORIZED', 'ACCEPT_ADMIN_PENDING_ADMIN_CHECK');

      // Check admin stays the same
      expect(await call(controller, 'getAdmin')).toEqual(root);
      expect(await call(registryProxy, 'pendingAdmin')).toBeAddressZero();
    });

    it('should fail when called by another account (e.g. root)', async () => {
      expect(await send(registryProxy, '_setPendingAdmin', [accounts[0]])).toSucceed();
      expect(await send(registryProxy, '_acceptAdmin')).toHaveTrollFailure('UNAUTHORIZED', 'ACCEPT_ADMIN_PENDING_ADMIN_CHECK');

      // Check admin stays the same
      expect(await call(controller, 'getAdmin')).toEqual(root);
      expect(await call(registryProxy, 'pendingAdmin')).toEqual(accounts[0]);
    });

    it('should succeed and set admin and clear pending admin', async () => {
      expect(await send(registryProxy, '_setPendingAdmin', [accounts[0]])).toSucceed();
      expect(await send(registryProxy, '_acceptAdmin', [], {from: accounts[0]})).toSucceed();

      // Check admin stays the same
      expect(await call(controller, 'getAdmin')).toEqual(accounts[0]);
      expect(await call(registryProxy, 'pendingAdmin')).toBeAddressZero();
    });

    it('should emit log on success', async () => {
      expect(await send(registryProxy, '_setPendingAdmin', [accounts[0]])).toSucceed();
      const result = await send(registryProxy, '_acceptAdmin', [], {from: accounts[0]});
      expect(result).toHaveLog('NewAdmin', {
        oldAdmin: root,
        newAdmin: accounts[0],
      });
      expect(result).toHaveLog('NewPendingAdmin', {
        oldPendingAdmin: accounts[0],
        newPendingAdmin: address(0),
      });
    });
  });
});
