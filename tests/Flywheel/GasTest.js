const {
  makeController,
  makePToken
} = require('../Utils/DeFiPie');
const {
  etherExp,
  etherUnsigned
} = require('../Utils/Ethereum');

// NB: coverage doesn't like this
describe.skip('Flywheel trace ops', () => {
  let root, a1, a2, a3, accounts;
  let controller, market;
  beforeEach(async () => {
    let interestRateModelOpts = {borrowRate: 0.000001};
    [root, a1, a2, a3, ...accounts] = saddle.accounts;
    controller = await makeController();
    market = await makePToken({controller, supportMarket: true, underlyingPrice: 3, interestRateModelOpts});
    await send(controller, '_addPieMarkets', [[market].map(c => c._address)]);
  });

  it('update supply index SSTOREs', async () => {
    await send(controller, 'setBlockNumber', [100]);
    await send(market, 'harnessSetTotalBorrows', [etherUnsigned(11e18)]);
    await send(controller, 'setPieSpeed', [market._address, etherExp(0.5)]);

    const tx = await send(controller, 'harnessUpdatePieSupplyIndex', [market._address]);

    const ops = {};
    await saddle.trace(tx, {
      execLog: log => {
        if (log.lastLog != undefined) {
          ops[log.op] = (ops[log.op] || []).concat(log);
        }
      }
    });
    expect(ops.SSTORE.length).toEqual(1);
  });

  it('update borrow index SSTOREs', async () => {
    await send(controller, 'setBlockNumber', [100]);
    await send(market, 'harnessSetTotalBorrows', [etherUnsigned(11e18)]);
    await send(controller, 'setPieSpeed', [market._address, etherExp(0.5)]);

    const tx = await send(controller, 'harnessUpdatePieBorrowIndex', [market._address, etherExp(1.1)]);

    const ops = {};
    await saddle.trace(tx, {
      execLog: log => {
        if (log.lastLog != undefined) {
          ops[log.op] = (ops[log.op] || []).concat(log);
        }
      }
    });
    expect(ops.SSTORE.length).toEqual(1);
  });
});