const {address} = require('./Utils/Ethereum');

const {
    makeController,
    makeRegistryProxy,
    makeInterestRateModel,
} = require('./Utils/DeFiPie');

describe('Registry coverage tests', () => {
    let root, admin, accounts;
    let registryProxy;
    let controller, pDelegatee, interestRateModel, exchangeRate;

    beforeEach(async () => {
        [root, admin, ...accounts] = saddle.accounts;

        controller = await makeController({kind: 'bool'});
        pDelegatee = await deploy('PErc20DelegateHarness');
        interestRateModel = await makeInterestRateModel({borrowRate: '1'});
        exchangeRate = 1;

        registryProxy = await makeRegistryProxy({
            implementation: pDelegatee
        });
    });

    describe("constructor", () => {
        it("gets address of implementation", async () => {
            let implementationAddress = await call(registryProxy, "pTokenImplementation");
            expect(implementationAddress).toEqual(pDelegatee._address);
        });

        it("gets value of admin", async () => {
            let admin = await call(registryProxy, "admin");
            expect(admin).toEqual(root);
        });
    });

    describe("implementation address", () => {
        it("set implementation address", async () => {
            await send(registryProxy, '_setPTokenImplementation', [accounts[1]]);
            expect(await call(registryProxy, 'pTokenImplementation')).toEqual(accounts[1]);
        });

        it("set implementation address, not UNAUTHORIZED", async () => {
            let result = await send(registryProxy, '_setPTokenImplementation', [accounts[2]], {from: accounts[2]});
            expect(result).toHaveRegistryFailure('UNAUTHORIZED', 'SET_NEW_IMPLEMENTATION');
        });
    });

    describe('admin()', () => {
        it('should return correct admin', async () => {
            expect(await call(registryProxy, 'admin')).toEqual(root);
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

            expect(await call(registryProxy, 'admin')).toEqual(root);
            expect(await call(registryProxy, 'pendingAdmin')).toBeAddressZero();
        });

        it('should properly set pending admin', async () => {
            expect(await send(registryProxy, '_setPendingAdmin', [accounts[0]])).toSucceed();

            expect(await call(registryProxy, 'admin')).toEqual(root);
            expect(await call(registryProxy, 'pendingAdmin')).toEqual(accounts[0]);
        });

        it('should properly set pending admin twice', async () => {
            expect(await send(registryProxy, '_setPendingAdmin', [accounts[0]])).toSucceed();
            expect(await send(registryProxy, '_setPendingAdmin', [accounts[1]])).toSucceed();

            expect(await call(registryProxy, 'admin')).toEqual(root);
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
            expect(await send(registryProxy, '_acceptAdmin')).toHaveRegistryFailure('UNAUTHORIZED', 'ACCEPT_ADMIN_PENDING_ADMIN_CHECK');

            expect(await call(registryProxy, 'admin')).toEqual(root);
            expect(await call(registryProxy, 'pendingAdmin')).toBeAddressZero();
        });

        it('should fail when called by another account (e.g. root)', async () => {
            expect(await send(registryProxy, '_setPendingAdmin', [accounts[0]])).toSucceed();
            expect(await send(registryProxy, '_acceptAdmin')).toHaveRegistryFailure('UNAUTHORIZED', 'ACCEPT_ADMIN_PENDING_ADMIN_CHECK');

            expect(await call(registryProxy, 'admin')).toEqual(root);
            expect(await call(registryProxy, 'pendingAdmin')).toEqual(accounts[0]);
        });

        it('should succeed and set admin and clear pending admin', async () => {
            expect(await send(registryProxy, '_setPendingAdmin', [accounts[0]])).toSucceed();
            expect(await send(registryProxy, '_acceptAdmin', [], {from: accounts[0]})).toSucceed();

            expect(await call(registryProxy, 'admin')).toEqual(accounts[0]);
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