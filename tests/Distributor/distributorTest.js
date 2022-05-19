const {
    etherMantissa,
    both
} = require('../Utils/Ethereum');

const {
    makeController,
    makePriceOracle,
    makePToken,
    makeToken, makeDistributor
} = require('../Utils/DeFiPie');

const chai = require("chai");

describe('Distributor', () => {
    let root, accounts;

    beforeEach(async () => {
        [root, ...accounts] = saddle.accounts;
    });

    describe('constructor', () => {
        it("on success it implementation, registry, controller is set", async () => {
            const distributor = await makeDistributor();
            chai.assert.notEqual(await call(distributor, 'implementation'), "0x0000000000000000000000000000000000000000");
            chai.assert.notEqual(await call(distributor, 'registry'), "0x0000000000000000000000000000000000000000");
            chai.assert.notEqual(await call(distributor, 'controller'), "0x0000000000000000000000000000000000000000");
        });
    });

    describe('_setPieAddress', () => {
        let newPie, distributor;
        beforeEach(async () => {
            distributor = await makeDistributor();
            newPie = await makeToken();
        });

        it("fails if called twice", async () => {
            // once set in makeDistributor
            await expect(send(distributor, '_setPieAddress', [newPie._address])).rejects.toRevert("revert pie address may only be initialized once");
        });
    });
});
