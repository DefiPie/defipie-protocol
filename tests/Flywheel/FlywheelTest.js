const {
  makeController,
  makePToken,
  balanceOf,
  fastForward,
  pretendBorrow,
  quickMint
} = require('../Utils/DeFiPie');
const {
  etherExp,
  etherDouble,
  etherUnsigned,
  etherMantissa
} = require('../Utils/Ethereum');

const pieRate = etherUnsigned(1e18);

async function pieAccrued(controller, user) {
  return etherUnsigned(await call(controller, 'pieAccrued', [user]));
}

async function pieBalance(controller, user) {
  return etherUnsigned(await call(controller.pie, 'balanceOf', [user]))
}

async function totalPieAccrued(controller, user) {
  return (await pieAccrued(controller, user)).add(await pieBalance(controller, user));
}

describe('Flywheel upgrade', () => {
  describe('becomes the controller', () => {
    it('_supportMarket() adds to all markets, and only once', async () => {
      let unitroller = await makeController({kind: 'unitroller-g3'});
      let allMarkets = [];
      for (let _ of Array(10)) {
        allMarkets.push(await makePToken({controller: unitroller, supportMarket: true}));
      }
      expect(await call(unitroller, 'getAllMarkets')).toEqual(allMarkets.map(c => c._address));
    });
  });
});

describe('Flywheel', () => {
  let root, a1, a2, a3, accounts;
  let controller, pLOW, pREP, pZRX, pEVIL;
  beforeEach(async () => {
    let interestRateModelOpts = {borrowRate: 0.000001};
    [root, a1, a2, a3, ...accounts] = saddle.accounts;
    controller = await makeController();
    pLOW = await makePToken({controller, supportMarket: true, underlyingPrice: 1, interestRateModelOpts});
    pREP = await makePToken({controller, supportMarket: true, underlyingPrice: 2, interestRateModelOpts});
    pZRX = await makePToken({controller, supportMarket: true, underlyingPrice: 3, interestRateModelOpts});
    pEVIL = await makePToken({controller, supportMarket: true, underlyingPrice: 3, interestRateModelOpts});
    await send(controller, 'setSupportMarket', [pEVIL._address, false]);
    await send(controller, '_addPieMarkets', [[pLOW, pREP, pZRX].map(c => c._address)]);
  });

  describe('getPieMarkets()', () => {
    it('should return the pie markets', async () => {
      expect(await call(controller, 'getPieMarkets')).toEqual(
        [pLOW, pREP, pZRX].map((c) => c._address)
      );
    });
  });

  describe('updatePieBorrowIndex()', () => {
    it('should calculate pie borrower index correctly', async () => {
      const mkt = pREP;
      await send(controller, 'setBlockNumber', [100]);
      await send(mkt, 'harnessSetTotalBorrows', [etherUnsigned(11e18)]);
      await send(controller, 'setPieSpeed', [mkt._address, etherExp(0.5)]);
      await send(controller, 'harnessUpdatePieBorrowIndex', [
        mkt._address,
        etherExp(1.1),
      ]);
      /*
        100 blocks, 10e18 origin total borrows, 0.5e18 borrowSpeed

        borrowAmt   = totalBorrows * 1e18 / borrowIdx
                    = 11e18 * 1e18 / 1.1e18 = 10e18
        pieAccrued = deltaBlocks * borrowSpeed
                    = 100 * 0.5e18 = 50e18
        newIndex   += 1e36 + pieAccrued * 1e36 / borrowAmt
                    = 1e36 + 50e18 * 1e36 / 10e18 = 6e36
      */

      const {index, block} = await call(controller, 'pieBorrowState', [mkt._address]);
      expect(index).toEqualNumber(6e36);
      expect(block).toEqualNumber(100);
    });

    it('should not revert or update pieBorrowState index and block if pToken not in PIE markets', async () => {
      const mkt = await makePToken({
        controller: controller,
        supportMarket: true,
        addPieMarket: false,
      });
      await send(controller, 'setBlockNumber', [100]);
      await send(controller, 'harnessUpdatePieBorrowIndex', [
        mkt._address,
        etherExp(1.1),
      ]);

      const {index, block} = await call(controller, 'pieBorrowState', [mkt._address]);
      expect(index).toEqualNumber(0);
      expect(block).toEqualNumber(0);
      const speed = await call(controller, 'pieSpeeds', [mkt._address]);
      expect(speed).toEqualNumber(0);
    });

    it('should not update index if no blocks passed since last accrual', async () => {
      const mkt = pREP;
      await send(controller, 'setPieSpeed', [mkt._address, etherExp(0.5)]);
      await send(controller, 'harnessUpdatePieBorrowIndex', [
        mkt._address,
        etherExp(1.1),
      ]);

      const {index, block} = await call(controller, 'pieBorrowState', [mkt._address]);
      expect(index).toEqualNumber(1e36);
      expect(block).toEqualNumber(0);
    });

    it('should not update index and block if pie speed is 0', async () => {
      const mkt = pREP;
      await send(controller, 'setPieSpeed', [mkt._address, etherExp(0)]);
      await send(controller, 'setBlockNumber', [100]);
      await send(controller, 'harnessUpdatePieBorrowIndex', [
        mkt._address,
        etherExp(1.1),
      ]);

      const {index, block} = await call(controller, 'pieBorrowState', [mkt._address]);
      expect(index).toEqualNumber(1e36);
      expect(block).toEqualNumber(0);
    });
  });

  describe('updatePieSupplyIndex()', () => {
    it('should calculate pie supplier index correctly', async () => {
      const mkt = pREP;
      await send(controller, 'setBlockNumber', [100]);
      await send(mkt, 'harnessSetTotalSupply', [etherUnsigned(10e18)]);
      await send(controller, 'setPieSpeed', [mkt._address, etherExp(0.5)]);
      await send(controller, 'harnessUpdatePieSupplyIndex', [mkt._address]);
      /*
        suppyTokens = 10e18
        pieAccrued = deltaBlocks * supplySpeed
                    = 100 * 0.5e18 = 50e18
        newIndex   += pieAccrued * 1e36 / supplyTokens
                    = 1e36 + 50e18 * 1e36 / 10e18 = 6e36
      */
      const {index, block} = await call(controller, 'pieSupplyState', [mkt._address]);
      expect(index).toEqualNumber(6e36);
      expect(block).toEqualNumber(100);
    });

    it('should not update index and block on non-PIE markets', async () => {
      const mkt = await makePToken({
        controller: controller,
        supportMarket: true,
        addPieMarket: false
      });
      await send(controller, 'setBlockNumber', [100]);
      await send(controller, 'harnessUpdatePieSupplyIndex', [
        mkt._address
      ]);

      const {index, block} = await call(controller, 'pieSupplyState', [mkt._address]);
      expect(index).toEqualNumber(0);
      expect(block).toEqualNumber(0);
      const speed = await call(controller, 'pieSpeeds', [mkt._address]);
      expect(speed).toEqualNumber(0);
      // pToken could have no pie speed or pie supplier state if not in pie markets
      // this logic could also possibly be implemented in the allowed hook
    });

    it('should not update index if no blocks passed since last accrual', async () => {
      const mkt = pREP;
      await send(controller, 'setBlockNumber', [0]);
      await send(mkt, 'harnessSetTotalSupply', [etherUnsigned(10e18)]);
      await send(controller, 'setPieSpeed', [mkt._address, etherExp(0.5)]);
      await send(controller, 'harnessUpdatePieSupplyIndex', [mkt._address]);

      const {index, block} = await call(controller, 'pieSupplyState', [mkt._address]);
      expect(index).toEqualNumber(1e36);
      expect(block).toEqualNumber(0);
    });

    it('should not matter if the index is updated multiple times', async () => {
      const pieRemaining = pieRate.mul(100)
      await send(controller.pie, 'transfer', [controller._address, pieRemaining], {from: root});
      await pretendBorrow(pLOW, a1, 1, 1, 100);
      await send(controller, 'refreshPieSpeeds');

      await quickMint(pLOW, a2, etherUnsigned(10e18));
      await quickMint(pLOW, a3, etherUnsigned(15e18));

      const a2Accrued0 = await totalPieAccrued(controller, a2);
      const a3Accrued0 = await totalPieAccrued(controller, a3);
      const a2Balance0 = await balanceOf(pLOW, a2);
      const a3Balance0 = await balanceOf(pLOW, a3);

      await fastForward(controller, 20);

      const txT1 = await send(pLOW, 'transfer', [a2, a3Balance0.sub(a2Balance0)], {from: a3});

      const a2Accrued1 = await totalPieAccrued(controller, a2);
      const a3Accrued1 = await totalPieAccrued(controller, a3);
      const a2Balance1 = await balanceOf(pLOW, a2);
      const a3Balance1 = await balanceOf(pLOW, a3);

      await fastForward(controller, 10);
      await send(controller, 'harnessUpdatePieSupplyIndex', [pLOW._address]);
      await fastForward(controller, 10);

      const txT2 = await send(pLOW, 'transfer', [a3, a2Balance1.sub(a3Balance1)], {from: a2});

      const a2Accrued2 = await totalPieAccrued(controller, a2);
      const a3Accrued2 = await totalPieAccrued(controller, a3);

      expect(a2Accrued0).toEqualNumber(0);
      expect(a3Accrued0).toEqualNumber(0);
      expect(a2Accrued1).not.toEqualNumber(0);
      expect(a3Accrued1).not.toEqualNumber(0);
      expect(a2Accrued1).toEqualNumber(a3Accrued2.sub(a3Accrued1));
      expect(a3Accrued1).toEqualNumber(a2Accrued2.sub(a2Accrued1));

      expect(txT1.gasUsed).toBeLessThan(200074);
      expect(txT1.gasUsed).toBeGreaterThan(150000);
      expect(txT2.gasUsed).toBeLessThan(200000);
      expect(txT2.gasUsed).toBeGreaterThan(150000);
    });
  });

  describe('distributeBorrowerPie()', () => {

    it('should update borrow index checkpoint but not pieAccrued for first time user', async () => {
      const mkt = pREP;
      await send(controller, "setPieBorrowState", [mkt._address, etherDouble(6), 10]);
      await send(controller, "setPieBorrowerIndex", [mkt._address, root, etherUnsigned(0)]);

      await send(controller, "harnessDistributeBorrowerPie", [mkt._address, root, etherExp(1.1)]);
      expect(await call(controller, "pieAccrued", [root])).toEqualNumber(0);
      expect(await call(controller, "pieBorrowerIndex", [ mkt._address, root])).toEqualNumber(6e36);
    });

    it('should transfer pie and update borrow index checkpoint correctly for repeat time user', async () => {
      const mkt = pREP;
      await send(controller.pie, 'transfer', [controller._address, etherUnsigned(50e18)], {from: root});
      await send(mkt, "harnessSetAccountBorrows", [a1, etherUnsigned(5.5e18), etherExp(1)]);
      await send(controller, "setPieBorrowState", [mkt._address, etherDouble(6), 10]);
      await send(controller, "setPieBorrowerIndex", [mkt._address, a1, etherDouble(1)]);

      /*
      * 100 delta blocks, 10e18 origin total borrows, 0.5e18 borrowSpeed => 6e18 pieBorrowIndex
      * this tests that an acct with half the total borrows over that time gets 25e18 PIE
        borrowerAmount = borrowBalance * 1e18 / borrow idx
                       = 5.5e18 * 1e18 / 1.1e18 = 5e18
        deltaIndex     = marketStoredIndex - userStoredIndex
                       = 6e36 - 1e36 = 5e36
        borrowerAccrued= borrowerAmount * deltaIndex / 1e36
                       = 5e18 * 5e36 / 1e36 = 25e18
      */
      const tx = await send(controller, "harnessDistributeBorrowerPie", [mkt._address, a1, etherUnsigned(1.1e18)]);
      expect(await pieAccrued(controller, a1)).toEqualNumber(0);
      expect(await pieBalance(controller, a1)).toEqualNumber(25e18);
      expect(tx).toHaveLog('DistributedBorrowerPie', {
        pToken: mkt._address,
        borrower: a1,
        pieDelta: etherUnsigned(25e18).toString(),
        pieBorrowIndex: etherDouble(6).toString()
      });
    });

    it('should not transfer if below pie claim threshold', async () => {
      const mkt = pREP;
      await send(controller.pie, 'transfer', [controller._address, etherUnsigned(50e18)], {from: root});
      await send(mkt, "harnessSetAccountBorrows", [a1, etherUnsigned(5.5e17), etherExp(1)]);
      await send(controller, "setPieBorrowState", [mkt._address, etherDouble(1.0019), 10]);
      await send(controller, "setPieBorrowerIndex", [mkt._address, a1, etherDouble(1)]);
      /*
        borrowerAmount = borrowBalance * 1e18 / borrow idx
                       = 5.5e17 * 1e18 / 1.1e18 = 5e17
        deltaIndex     = marketStoredIndex - userStoredIndex
                       = 1.0019e36 - 1e36 = 0.0019e36
        borrowerAccrued= borrowerAmount * deltaIndex / 1e36
                       = 5e17 * 0.0019e36 / 1e36 = 0.00095e18
        0.00095e18 < pieClaimThreshold of 0.001e18
      */
      await send(controller, "harnessDistributeBorrowerPie", [mkt._address, a1, etherExp(1.1)]);
      expect(await pieAccrued(controller, a1)).toEqualNumber(0.00095e18);
      expect(await pieBalance(controller, a1)).toEqualNumber(0);
    });

    it('should not revert or distribute when called with non-PIE market', async () => {
      const mkt = await makePToken({
        controller: controller,
        supportMarket: true,
        addPieMarket: false,
      });

      await send(controller, "harnessDistributeBorrowerPie", [mkt._address, a1, etherExp(1.1)]);
      expect(await pieAccrued(controller, a1)).toEqualNumber(0);
      expect(await pieBalance(controller, a1)).toEqualNumber(0);
      expect(await call(controller, 'pieBorrowerIndex', [mkt._address, a1])).toEqualNumber(0);
    });
  });

  describe('distributeSupplierPie()', () => {
    it('should transfer pie and update supply index correctly for first time user', async () => {
      const mkt = pREP;
      await send(controller.pie, 'transfer', [controller._address, etherUnsigned(50e18)], {from: root});

      await send(mkt, "harnessSetBalance", [a1, etherUnsigned(5e18)]);
      await send(controller, "setPieSupplyState", [mkt._address, etherDouble(6), 10]);
      /*
      * 100 delta blocks, 10e18 total supply, 0.5e18 supplySpeed => 6e18 pieSupplyIndex
      * confirming an acct with half the total supply over that time gets 25e18 PIE:
        supplierAmount  = 5e18
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 6e36 - 1e36 = 5e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e18 * 5e36 / 1e36 = 25e18
      */

      const tx = await send(controller, "harnessDistributeSupplierPie", [mkt._address, a1]);
      expect(await pieAccrued(controller, a1)).toEqualNumber(0);
      expect(await pieBalance(controller, a1)).toEqualNumber(25e18);
      expect(tx).toHaveLog('DistributedSupplierPie', {
        pToken: mkt._address,
        supplier: a1,
        pieDelta: etherUnsigned(25e18).toString(),
        pieSupplyIndex: etherDouble(6).toString()
      });
    });

    it('should update pie accrued and supply index for repeat user', async () => {
      const mkt = pREP;
      await send(controller.pie, 'transfer', [controller._address, etherUnsigned(50e18)], {from: root});

      await send(mkt, "harnessSetBalance", [a1, etherUnsigned(5e18)]);
      await send(controller, "setPieSupplyState", [mkt._address, etherDouble(6), 10]);
      await send(controller, "setPieSupplierIndex", [mkt._address, a1, etherDouble(2)])
      /*
        supplierAmount  = 5e18
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 6e36 - 2e36 = 4e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e18 * 4e36 / 1e36 = 20e18
      */

      await send(controller, "harnessDistributeSupplierPie", [mkt._address, a1]);
      expect(await pieAccrued(controller, a1)).toEqualNumber(0);
      expect(await pieBalance(controller, a1)).toEqualNumber(20e18);
    });

    it('should not transfer when pieAccrued below threshold', async () => {
      const mkt = pREP;
      await send(controller.pie, 'transfer', [controller._address, etherUnsigned(50e18)], {from: root});

      await send(mkt, "harnessSetBalance", [a1, etherUnsigned(5e17)]);
      await send(controller, "setPieSupplyState", [mkt._address, etherDouble(1.0019), 10]);
      /*
        supplierAmount  = 5e17
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 1.0019e36 - 1e36 = 0.0019e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e17 * 0.0019e36 / 1e36 = 0.00095e18
      */

      await send(controller, "harnessDistributeSupplierPie", [mkt._address, a1]);
      expect(await pieAccrued(controller, a1)).toEqualNumber(0.00095e18);
      expect(await pieBalance(controller, a1)).toEqualNumber(0);
    });

    it('should not revert or distribute when called with non-PIE market', async () => {
      const mkt = await makePToken({
        controller: controller,
        supportMarket: true,
        addPieMarket: false,
      });

      await send(controller, "harnessDistributeSupplierPie", [mkt._address, a1]);
      expect(await pieAccrued(controller, a1)).toEqualNumber(0);
      expect(await pieBalance(controller, a1)).toEqualNumber(0);
      expect(await call(controller, 'pieBorrowerIndex', [mkt._address, a1])).toEqualNumber(0);
    });

  });

  describe('transferPie', () => {
    it('should transfer pie accrued when amount is above threshold', async () => {
      const pieRemaining = 1000, a1AccruedPre = 100, threshold = 1;
      const pieBalancePre = await pieBalance(controller, a1);
      const tx0 = await send(controller.pie, 'transfer', [controller._address, pieRemaining], {from: root});
      const tx1 = await send(controller, 'setPieAccrued', [a1, a1AccruedPre]);
      const tx2 = await send(controller, 'harnessTransferPie', [a1, a1AccruedPre, threshold]);
      const a1AccruedPost = await pieAccrued(controller, a1);
      const pieBalancePost = await pieBalance(controller, a1);
      expect(pieBalancePre).toEqualNumber(0);
      expect(pieBalancePost).toEqualNumber(a1AccruedPre);
    });

    it('should not transfer when pie accrued is below threshold', async () => {
      const pieRemaining = 1000, a1AccruedPre = 100, threshold = 101;
      const pieBalancePre = await call(controller.pie, 'balanceOf', [a1]);
      const tx0 = await send(controller.pie, 'transfer', [controller._address, pieRemaining], {from: root});
      const tx1 = await send(controller, 'setPieAccrued', [a1, a1AccruedPre]);
      const tx2 = await send(controller, 'harnessTransferPie', [a1, a1AccruedPre, threshold]);
      const a1AccruedPost = await pieAccrued(controller, a1);
      const pieBalancePost = await pieBalance(controller, a1);
      expect(pieBalancePre).toEqualNumber(0);
      expect(pieBalancePost).toEqualNumber(0);
    });

    it('should not transfer pie if pie accrued is greater than pie remaining', async () => {
      const pieRemaining = 99, a1AccruedPre = 100, threshold = 1;
      const pieBalancePre = await pieBalance(controller, a1);
      const tx0 = await send(controller.pie, 'transfer', [controller._address, pieRemaining], {from: root});
      const tx1 = await send(controller, 'setPieAccrued', [a1, a1AccruedPre]);
      const tx2 = await send(controller, 'harnessTransferPie', [a1, a1AccruedPre, threshold]);
      const a1AccruedPost = await pieAccrued(controller, a1);
      const pieBalancePost = await pieBalance(controller, a1);
      expect(pieBalancePre).toEqualNumber(0);
      expect(pieBalancePost).toEqualNumber(0);
    });
  });

  describe('claimPie', () => {
    it('should accrue pie and then transfer pie accrued', async () => {
      const pieRemaining = pieRate.mul(100), mintAmount = etherUnsigned(12e18), deltaBlocks = 10;
      await send(controller.pie, 'transfer', [controller._address, pieRemaining], {from: root});
      await pretendBorrow(pLOW, a1, 1, 1, 100);
      await send(controller, 'refreshPieSpeeds');
      const speed = await call(controller, 'pieSpeeds', [pLOW._address]);
      const a2AccruedPre = await pieAccrued(controller, a2);
      const pieBalancePre = await pieBalance(controller, a2);
      await quickMint(pLOW, a2, mintAmount);
      await fastForward(controller, deltaBlocks);
      await send(controller, 'setSupportMarket', [pEVIL._address, true]);
      const tx = await send(controller, 'claimPie', [a2]);
      const a2AccruedPost = await pieAccrued(controller, a2);
      const pieBalancePost = await pieBalance(controller, a2);
      expect(tx.gasUsed).toBeLessThan(440000);
      expect(speed).toEqualNumber(pieRate);
      expect(a2AccruedPre).toEqualNumber(0);
      expect(a2AccruedPost).toEqualNumber(0);
      expect(pieBalancePre).toEqualNumber(0);
      expect(pieBalancePost).toEqualNumber(pieRate.mul(deltaBlocks).sub(1)); // index is 8333...
    });

    it('should accrue pie and then transfer pie accrued in a single market', async () => {
      const pieRemaining = pieRate.mul(100), mintAmount = etherUnsigned(12e18), deltaBlocks = 10;
      await send(controller.pie, 'transfer', [controller._address, pieRemaining], {from: root});
      await pretendBorrow(pLOW, a1, 1, 1, 100);
      await send(controller, 'refreshPieSpeeds');
      const speed = await call(controller, 'pieSpeeds', [pLOW._address]);
      const a2AccruedPre = await pieAccrued(controller, a2);
      const pieBalancePre = await pieBalance(controller, a2);
      await quickMint(pLOW, a2, mintAmount);
      await fastForward(controller, deltaBlocks);
      const tx = await send(controller, 'claimPie', [a2, [pLOW._address]]);
      const a2AccruedPost = await pieAccrued(controller, a2);
      const pieBalancePost = await pieBalance(controller, a2);
      expect(tx.gasUsed).toBeLessThan(162077);
      expect(speed).toEqualNumber(pieRate);
      expect(a2AccruedPre).toEqualNumber(0);
      expect(a2AccruedPost).toEqualNumber(0);
      expect(pieBalancePre).toEqualNumber(0);
      expect(pieBalancePost).toEqualNumber(pieRate.mul(deltaBlocks).sub(1)); // index is 8333...
    });

    it('should claim when pie accrued is below threshold', async () => {
      const pieRemaining = etherExp(1), accruedAmt = etherUnsigned(0.0009e18)
      await send(controller.pie, 'transfer', [controller._address, pieRemaining], {from: root});
      await send(controller, 'setPieAccrued', [a1, accruedAmt]);
      await send(controller, 'claimPie', [a1, [pLOW._address]]);
      expect(await pieAccrued(controller, a1)).toEqualNumber(0);
      expect(await pieBalance(controller, a1)).toEqualNumber(accruedAmt);
    });

    it('should revert when a market is not listed', async () => {
      const cNOT = await makePToken({controller});
      await send(controller, 'setSupportMarket', [cNOT._address, false]);
      await expect(
        send(controller, 'claimPie', [a1, [cNOT._address]])
      ).rejects.toRevert('revert market must be listed');
    });
  });

  describe('claimPie batch', () => {
    it('should revert when claiming pie from non-listed market', async () => {

      const pieRemaining = pieRate.mul(100), deltaBlocks = 10, mintAmount = etherExp(10);
      await send(controller.pie, 'transfer', [controller._address, pieRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;

      for(let from of claimAccts) {
        expect(await send(pLOW.underlying, 'harnessSetBalance', [from, mintAmount], { from })).toSucceed();
        send(pLOW.underlying, 'approve', [pLOW._address, mintAmount], { from });
        send(pLOW, 'mint', [mintAmount], { from });
      }

      await pretendBorrow(pLOW, root, 1, 1, etherExp(10));
      await send(controller, 'refreshPieSpeeds');

      await fastForward(controller, deltaBlocks);

      await expect(send(controller, 'claimPie', [claimAccts, [pLOW._address, pEVIL._address], true, true])).rejects.toRevert('revert market must be listed');
    });


    it('should claim the expected amount when holders and pTokens arg is duplicated', async () => {
      const pieRemaining = pieRate.mul(100), deltaBlocks = 10, mintAmount = etherExp(10);
      await send(controller.pie, 'transfer', [controller._address, pieRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;
      for(let from of claimAccts) {
        expect(await send(pLOW.underlying, 'harnessSetBalance', [from, mintAmount], { from })).toSucceed();
        send(pLOW.underlying, 'approve', [pLOW._address, mintAmount], { from });
        send(pLOW, 'mint', [mintAmount], { from });
      }
      await pretendBorrow(pLOW, root, 1, 1, etherExp(10));
      await send(controller, 'refreshPieSpeeds');

      await fastForward(controller, deltaBlocks);

      const tx = await send(controller, 'claimPie', [[...claimAccts, ...claimAccts], [pLOW._address, pLOW._address], false, true]);
      // pie distributed => 10e18
      for(let acct of claimAccts) {
        expect(await call(controller, 'pieSupplierIndex', [pLOW._address, acct])).toEqualNumber(etherDouble(1.125));
        expect(await pieBalance(controller, acct)).toEqualNumber(etherExp(1.25));
      }
    });

    it('claims pie for multiple suppliers only', async () => {
      const pieRemaining = pieRate.mul(100), deltaBlocks = 10, mintAmount = etherExp(10);
      await send(controller.pie, 'transfer', [controller._address, pieRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;
      for(let from of claimAccts) {
        expect(await send(pLOW.underlying, 'harnessSetBalance', [from, mintAmount], { from })).toSucceed();
        send(pLOW.underlying, 'approve', [pLOW._address, mintAmount], { from });
        send(pLOW, 'mint', [mintAmount], { from });
      }
      await pretendBorrow(pLOW, root, 1, 1, etherExp(10));
      await send(controller, 'refreshPieSpeeds');

      await fastForward(controller, deltaBlocks);

      const tx = await send(controller, 'claimPie', [claimAccts, [pLOW._address], false, true]);
      // pie distributed => 10e18
      for(let acct of claimAccts) {
        expect(await call(controller, 'pieSupplierIndex', [pLOW._address, acct])).toEqualNumber(etherDouble(1.125));
        expect(await pieBalance(controller, acct)).toEqualNumber(etherExp(1.25));
      }
    });

    it('claims pie for multiple borrowers only, primes uninitiated', async () => {
      const pieRemaining = pieRate.mul(100), deltaBlocks = 10, mintAmount = etherExp(10), borrowAmt = etherExp(1), borrowIdx = etherExp(1)
      await send(controller.pie, 'transfer', [controller._address, pieRemaining], {from: root});
      let [_,__, ...claimAccts] = saddle.accounts;

      for(let acct of claimAccts) {
        await send(pLOW, 'harnessIncrementTotalBorrows', [borrowAmt]);
        await send(pLOW, 'harnessSetAccountBorrows', [acct, borrowAmt, borrowIdx]);
      }
      await send(controller, 'refreshPieSpeeds');

      await send(controller, 'harnessFastForward', [10]);

      const tx = await send(controller, 'claimPie', [claimAccts, [pLOW._address], true, false]);
      for(let acct of claimAccts) {
        expect(await call(controller, 'pieBorrowerIndex', [pLOW._address, acct])).toEqualNumber(etherDouble(2.25));
        expect(await call(controller, 'pieSupplierIndex', [pLOW._address, acct])).toEqualNumber(0);
      }
    });

    it('should revert when a market is not listed', async () => {
      const cNOT = await makePToken({controller});
      await send(controller, 'setSupportMarket', [cNOT._address, false]);
      await expect(
        send(controller, 'claimPie', [[a1, a2], [cNOT._address], true, true])
      ).rejects.toRevert('revert market must be listed');
    });
  });

  describe('refreshPieSpeeds', () => {
    it('should start out 0', async () => {
      await send(controller, 'refreshPieSpeeds');
      const speed = await call(controller, 'pieSpeeds', [pLOW._address]);
      expect(speed).toEqualNumber(0);
    });

    it('should get correct speeds with borrows', async () => {
      await pretendBorrow(pLOW, a1, 1, 1, 100);
      const tx = await send(controller, 'refreshPieSpeeds');
      const speed = await call(controller, 'pieSpeeds', [pLOW._address]);
      expect(speed).toEqualNumber(pieRate);
      expect(tx).toHaveLog(['PieSpeedUpdated', 0], {
        pToken: pLOW._address,
        newSpeed: speed
      });
      expect(tx).toHaveLog(['PieSpeedUpdated', 1], {
        pToken: pREP._address,
        newSpeed: 0
      });
      expect(tx).toHaveLog(['PieSpeedUpdated', 2], {
        pToken: pZRX._address,
        newSpeed: 0
      });
    });

    it('should get correct speeds for 2 assets', async () => {
      await pretendBorrow(pLOW, a1, 1, 1, 100);
      await pretendBorrow(pZRX, a1, 1, 1, 100);
      await send(controller, 'refreshPieSpeeds');
      const speed1 = await call(controller, 'pieSpeeds', [pLOW._address]);
      const speed2 = await call(controller, 'pieSpeeds', [pREP._address]);
      const speed3 = await call(controller, 'pieSpeeds', [pZRX._address]);
      expect(speed1).toEqualNumber(pieRate.div(4));
      expect(speed2).toEqualNumber(0);
      expect(speed3).toEqualNumber(pieRate.div(4).mul(3));
    });

    it('should not be callable inside a contract', async () => {
      await pretendBorrow(pLOW, a1, 1, 1, 100);
      await pretendBorrow(pZRX, a1, 1, 1, 100);
      await expect(deploy('RefreshSpeedsProxy', [controller._address])).rejects.toRevert('revert only externally owned accounts may refresh speeds');
    });
  });

  describe('_addPieMarkets', () => {
    it('should correctly add a pie market if called by admin', async () => {
      const cBAT = await makePToken({controller, supportMarket: true});
      const tx = await send(controller, '_addPieMarkets', [[cBAT._address]]);
      const markets = await call(controller, 'getPieMarkets');
      expect(markets).toEqual([pLOW, pREP, pZRX, cBAT].map((c) => c._address));
      expect(tx).toHaveLog('MarketPied', {
        pToken: cBAT._address,
        isPied: true
      });
    });

    it('should revert if not called by admin', async () => {
      const cBAT = await makePToken({ controller, supportMarket: true });
      await expect(
        send(controller, '_addPieMarkets', [[cBAT._address]], {from: a1})
      ).rejects.toRevert('revert only admin can add pie market');
    });

    it('should not add non-listed markets', async () => {
      const cBAT = await makePToken({ controller, supportMarket: true });
      await send(controller, 'setSupportMarket', [cBAT._address, false]);
      await expect(
        send(controller, '_addPieMarkets', [[cBAT._address]])
      ).rejects.toRevert('revert pie market is not listed');

      const markets = await call(controller, 'getPieMarkets');
      expect(markets).toEqual([pLOW, pREP, pZRX].map((c) => c._address));
    });

    it('should not add duplicate markets', async () => {
      const cBAT = await makePToken({controller, supportMarket: true});
      await send(controller, '_addPieMarkets', [[cBAT._address]]);

      await expect(
        send(controller, '_addPieMarkets', [[cBAT._address]])
      ).rejects.toRevert('revert pie market already added');
    });

    it('should not write over a markets existing state', async () => {
      const mkt = pLOW._address;
      const bn0 = 10, bn1 = 20;
      const idx = etherUnsigned(1.5e36);

      await send(controller, "setPieSupplyState", [mkt, idx, bn0]);
      await send(controller, "setPieBorrowState", [mkt, idx, bn0]);
      await send(controller, "setBlockNumber", [bn1]);
      await send(controller, "_dropPieMarket", [mkt]);
      await send(controller, "_addPieMarkets", [[mkt]]);

      const supplyState = await call(controller, 'pieSupplyState', [mkt]);
      expect(supplyState.block).toEqual(bn1.toString());
      expect(supplyState.index).toEqual(idx.toString());

      const borrowState = await call(controller, 'pieBorrowState', [mkt]);
      expect(borrowState.block).toEqual(bn1.toString());
      expect(borrowState.index).toEqual(idx.toString());
    });
  });

  describe('_dropPieMarket', () => {
    it('should correctly drop a pie market if called by admin', async () => {
      const tx = await send(controller, '_dropPieMarket', [pLOW._address]);
      expect(await call(controller, 'getPieMarkets')).toEqual(
        [pREP, pZRX].map((c) => c._address)
      );
      expect(tx).toHaveLog('MarketPied', {
        pToken: pLOW._address,
        isPied: false
      });
    });

    it('should correctly drop a pie market from middle of array', async () => {
      await send(controller, '_dropPieMarket', [pREP._address]);
      expect(await call(controller, 'getPieMarkets')).toEqual(
        [pLOW, pZRX].map((c) => c._address)
      );
    });

    it('should not drop a pie market unless called by admin', async () => {
      await expect(
        send(controller, '_dropPieMarket', [pLOW._address], {from: a1})
      ).rejects.toRevert('revert only admin can drop pie market');
    });

    it('should not drop a pie market already dropped', async () => {
      await send(controller, '_dropPieMarket', [pLOW._address]);
      await expect(
        send(controller, '_dropPieMarket', [pLOW._address])
      ).rejects.toRevert('revert market is not a pie market');
    });
  });

  describe('_setPieRate', () => {
    it('should correctly change pie rate if called by admin', async () => {
      expect(await call(controller, 'pieRate')).toEqualNumber(etherUnsigned(1e18));
      const tx1 = await send(controller, '_setPieRate', [etherUnsigned(3e18)]);
      expect(await call(controller, 'pieRate')).toEqualNumber(etherUnsigned(3e18));
      const tx2 = await send(controller, '_setPieRate', [etherUnsigned(2e18)]);
      expect(await call(controller, 'pieRate')).toEqualNumber(etherUnsigned(2e18));
      expect(tx2).toHaveLog('NewPieRate', {
        oldPieRate: etherUnsigned(3e18),
        newPieRate: etherUnsigned(2e18)
      });
    });

    it('should not change pie rate unless called by admin', async () => {
      await expect(
        send(controller, '_setPieRate', [pLOW._address], {from: a1})
      ).rejects.toRevert('revert only admin can change pie rate');
    });
  });
});
