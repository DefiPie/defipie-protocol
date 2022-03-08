const {
  etherMantissa,
  increaseTime,
  minerStart,
  minerStop,
  UInt256Max
} = require('./Utils/Ethereum');

const {
  makePToken,
  balanceOf,
  borrowSnapshot,
  enterMarkets,
  makePriceOracle
} = require('./Utils/DeFiPie');

describe('Spinarama', () => {
  let root, from, accounts, priceOracle;

  beforeEach(async () => {
    [root, from, ...accounts] = saddle.accounts;
    priceOracle = await makePriceOracle();
  });

  describe('#mintMint', () => {
    it('should succeed', async () => {
      const pToken = await makePToken({priceOracle: priceOracle, supportMarket: true});
      await send(pToken.underlying, 'harnessSetBalance', [from, 100], {from});
      await send(pToken.underlying, 'approve', [pToken._address, UInt256Max()], {from});
      await minerStop();
      const p1 = send(pToken, 'mint', [1], {from});
      const p2 = send(pToken, 'mint', [2], {from});
      await minerStart();
      expect(await p1).toSucceed();
      expect(await p2).toSucceed();
      expect(await balanceOf(pToken, from)).toEqualNumber(3);
    });

    it('should partial succeed', async () => {
      const pToken = await makePToken({priceOracle: priceOracle, supportMarket: true});
      await send(pToken.underlying, 'harnessSetBalance', [from, 100], {from});
      await send(pToken.underlying, 'approve', [pToken._address, 10], {from});
      await minerStop();
      const p1 = send(pToken, 'mint', [11], {from});
      const p2 = send(pToken, 'mint', [10], {from});
      await expect(minerStart()).rejects.toRevert("revert Insufficient allowance");
      try {
        await p1;
      } catch (err) {
        // hack: miner start reverts with correct message, but tx gives us a weird tx obj. ganache bug?
        expect(err.toString()).toContain("reverted by the EVM");
      }
      await expect(p2).resolves.toSucceed();
      expect(await balanceOf(pToken, from)).toEqualNumber(10);
    });
  });

  describe('#mintRedeem', () => {
    it('should succeed', async () => {
      const pToken = await makePToken({priceOracle: priceOracle, supportMarket: true});
      await send(pToken.underlying, 'harnessSetBalance', [from, 100], {from});
      await send(pToken.underlying, 'approve', [pToken._address, 10], {from});
      await minerStop();
      const p1 = send(pToken, 'mint', [10], {from});
      const p2 = send(pToken, 'redeemUnderlying', [10], {from});
      await minerStart();
      expect(await p1).toSucceed();
      expect(await p2).toSucceed();
      expect(await balanceOf(pToken, from)).toEqualNumber(0);
    });
  });

  describe('#redeemMint', () => {
    it('should succeed', async () => {
      const pToken = await makePToken({priceOracle: priceOracle, supportMarket: true});
      await send(pToken, 'harnessSetTotalSupply', [10]);
      await send(pToken, 'harnessSetExchangeRate', [etherMantissa(1)]);
      await send(pToken, 'harnessSetBalance', [from, 10]);
      await send(pToken.underlying, 'harnessSetBalance', [pToken._address, 10]);
      await send(pToken.underlying, 'approve', [pToken._address, 10], {from});
      await minerStop();
      const p1 = send(pToken, 'redeem', [10], {from});
      const p2 = send(pToken, 'mint', [10], {from});
      await minerStart();
      expect(await p1).toSucceed();
      expect(await p2).toSucceed();
      expect(await balanceOf(pToken, from)).toEqualNumber(10);
    });
  });

  describe('#repayRepay', () => {
    it('should succeed', async () => {
      const pToken1 = await makePToken({priceOracle: priceOracle, supportMarket: true, underlyingPrice: 1, collateralFactor: .5});
      const pToken2 = await makePToken({priceOracle: priceOracle, controller: pToken1.controller, pTokenFactory: pToken1.pTokenFactory, supportMarket: true, underlyingPrice: 1, controller: pToken1.controller});
      await send(pToken1.underlying, 'harnessSetBalance', [from, 10]);
      await send(pToken1.underlying, 'approve', [pToken1._address, 10], {from});
      await send(pToken2.underlying, 'harnessSetBalance', [pToken2._address, 10]);
      await send(pToken2, 'harnessSetTotalSupply', [100]);
      await send(pToken2.underlying, 'approve', [pToken2._address, 10], {from});
      await send(pToken2, 'harnessSetExchangeRate', [etherMantissa(1)]);
      expect(await enterMarkets([pToken1, pToken2], from)).toSucceed();
      expect(await send(pToken1, 'mint', [10], {from})).toSucceed();
      await expect(
        send(pToken2, 'borrow', [2], {from})
      ).rejects.toRevert('revert PErc20::borrow: borrow is not started');
      await increaseTime(86400);
      expect(await send(pToken2, 'borrow', [2], {from})).toSucceed();
      await minerStop();
      const p1 = send(pToken2, 'repayBorrow', [1], {from});
      const p2 = send(pToken2, 'repayBorrow', [1], {from});
      await minerStart();
      expect(await p1).toSucceed();
      expect(await p2).toSucceed();
      expect((await borrowSnapshot(pToken2, from)).principal).toEqualNumber(0);
    });

    // XXX not yet converted below this point...moving on to certora

    it.skip('can have partial failure succeed', async () => {
      const {moneyMarketHarness,
        priceOracle,
        interestRateModel} = await setupMoneyMarket(root);
      const spinarama = await Spinarama.new(moneyMarketHarness._address).send({from: root});
      const OMG = await setupSupply(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);
      const BAT = await setupBorrow(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);

      // Add cash to the protocol
      await addCash(moneyMarketHarness, BAT, root);

      // Supply some collateral
      expect(await spinarama.methods.supply(OMG._address, 15).send({from: accounts[0]})).toSucceed();

      // Now borrow 5 bat
      expect(await spinarama.methods.borrow(BAT._address, 5).send({from: accounts[0]})).toSucceed();

      // And repay it, repay it
      const {'0': err0, '1': err1} = await spinarama.methods.repayRepay(BAT._address, 100, 1).call({from: accounts[0]});

      expect(err0).hasErrorCode(ErrorEnum.INTEGER_UNDERFLOW);
      expect(err1).hasErrorCode(ErrorEnum.NO_ERROR);
    });
  });

  describe('#borrowRepayBorrow', () => {
    it.skip('should fail', async () => {
      const {moneyMarketHarness,
        priceOracle,
        interestRateModel} = await setupMoneyMarket(root);
      const spinarama = await Spinarama.new(moneyMarketHarness._address).send({from: root});
      const OMG = await setupSupply(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);
      const BAT = await setupBorrow(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);

      // Add cash to the protocol
      await addCash(moneyMarketHarness, BAT, root);

      // Supply some collateral
      expect(await spinarama.methods.supply(OMG._address, 15).send({from: accounts[0]})).toSucceed();

      // Borrow then repayBorrow should revert
      await expect(
        spinarama.methods.borrowRepayBorrow(BAT._address, 5, 1).call({from: accounts[0]})
      ).rejects.toRevert();
    });

    it.skip('can succeed with partial failure', async () => {
      const {moneyMarketHarness,
        priceOracle,
        interestRateModel} = await setupMoneyMarket(root);
      const spinarama = await Spinarama.new(moneyMarketHarness._address).send({from: root});
      const OMG = await setupSupply(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);
      const BAT = await setupBorrow(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);

      // Add cash to the protocol
      await addCash(moneyMarketHarness, BAT, root);

      // Supply some collateral
      expect(await spinarama.methods.supply(OMG._address, 15).send({from: accounts[0]})).toSucceed();

      // Borrow a little, repay a lot
      const {'0': err0, '1': err1} = await spinarama.methods.borrowRepayBorrow(BAT._address, 1, 1000).call({from: accounts[0]});

      expect(err0).hasErrorCode(ErrorEnum.NO_ERROR);
      expect(err1).hasErrorCode(ErrorEnum.INTEGER_UNDERFLOW);
    });
  });

  describe('#borrowSupply', () => {
    it.skip('should fail in same asset', async () => {
      const {moneyMarketHarness,
        priceOracle,
        interestRateModel} = await setupMoneyMarket(root);
      const spinarama = await Spinarama.new(moneyMarketHarness._address).send({from: root});
      const OMG = await setupSupply(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);
      const BAT = await setupBorrow(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);

      // Add cash to the protocol
      await addCash(moneyMarketHarness, BAT, root);

      // Supply some collateral
      expect(await spinarama.methods.supply(OMG._address, 15).send({from: accounts[0]})).toSucceed();

      // Borrow then supply should revert
      await expect(
        spinarama.methods.borrowSupply(BAT._address, BAT._address, 5, 1).call({from: accounts[0]})
      ).rejects.toRevert();
    });

    it.skip('should fail, even in different assets', async () => {
      const {moneyMarketHarness,
        priceOracle,
        interestRateModel} = await setupMoneyMarket(root);
      const spinarama = await Spinarama.new(moneyMarketHarness._address).send({from: root});
      const OMG = await setupSupply(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);
      const BAT = await setupBorrow(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);

      // Add cash to the protocol
      await addCash(moneyMarketHarness, BAT, root);

      // Supply some collateral
      expect(await spinarama.methods.supply(OMG._address, 15).send({from: accounts[0]})).toSucceed();

      // Borrow then supply in different assets
      await expect(
        spinarama.methods.borrowSupply(BAT._address, OMG._address, 5, 1).call({from: accounts[0]})
      ).rejects.toRevert();
    });
  });

  describe('#supplyLiquidate', () => {
    it.skip('should fail', async () => {
      const {moneyMarketHarness,
        priceOracle,
        interestRateModel} = await setupMoneyMarket(root);
      const spinarama = await Spinarama.new(moneyMarketHarness._address).send({from: root});
      const OMG = await setupSupply(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);
      const BAT = await setupBorrow(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);

      // Add cash to the protocol
      await addCash(moneyMarketHarness, BAT, root);

      // Supply some collateral
      expect(await spinarama.methods.supply(OMG._address, 15).send({from: accounts[0]})).toSucceed();

      await expect(
        spinarama.methods.supplyLiquidate(OMG._address, 5, accounts[0], OMG._address, BAT._address, 0).call({from: accounts[0]})
      ).rejects.toRevert();
    });
  });

  describe('#withdrawLiquidate', () => {
    it.skip('should fail', async () => {
      const {moneyMarketHarness,
        priceOracle,
        interestRateModel} = await setupMoneyMarket(root);
      const spinarama = await Spinarama.new(moneyMarketHarness._address).send({from: root});
      const OMG = await setupSupply(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);
      const BAT = await setupBorrow(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);

      // Add cash to the protocol
      await addCash(moneyMarketHarness, BAT, root);

      // Supply some collateral
      expect(await spinarama.methods.supply(OMG._address, 15).send({from: accounts[0]})).toSucceed();

      await expect(
        spinarama.methods.withdrawLiquidate(OMG._address, 5, accounts[0], OMG._address, BAT._address, 0).call({from: accounts[0]})
      ).rejects.toRevert();
    });
  });

  describe('#borrowLiquidate', () => {
    it.skip('should fail', async () => {
      const {moneyMarketHarness,
        priceOracle,
        interestRateModel} = await setupMoneyMarket(root);
      const spinarama = await Spinarama.new(moneyMarketHarness._address).send({from: root});
      const OMG = await setupSupply(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);
      const BAT = await setupBorrow(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);

      // Add cash to the protocol
      await addCash(moneyMarketHarness, BAT, root);

      // Supply some collateral
      expect(await spinarama.methods.supply(OMG._address, 15).send({from: accounts[0]})).toSucceed();

      await expect(
        spinarama.methods.borrowLiquidate(OMG._address, 5, accounts[0], OMG._address, BAT._address, 0).call({from: accounts[0]})
      ).rejects.toRevert();
    });
  });

  describe('#repayBorrowLiquidate', () => {
    it.skip('should fail', async () => {
      const {moneyMarketHarness,
        priceOracle,
        interestRateModel} = await setupMoneyMarket(root)
      const spinarama = await Spinarama.new(moneyMarketHarness._address).send({from: root});
      const OMG = await setupSupply(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);
      const BAT = await setupBorrow(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);

      // Add cash to the protocol
      await addCash(moneyMarketHarness, BAT, root);

      // Supply some collateral
      expect(await spinarama.methods.supply(OMG._address, 15).send({from: accounts[0]})).toSucceed();

      // Borrow some OMG
      expect(await spinarama.methods.borrow(OMG._address, 5).send({from: accounts[0]})).toSucceed();

      await expect(
        spinarama.methods.repayBorrowLiquidate(OMG._address, 1, accounts[0], OMG._address, BAT._address, 0).call({from: accounts[0]})
      ).rejects.toRevert();
    });
  });

  describe('#liquidateLiquidate', () => {
    it.skip('should fail', async () => {
      const {moneyMarketHarness,
        priceOracle,
        interestRateModel} = await setupMoneyMarket(root)
      const spinarama = await Spinarama.new(moneyMarketHarness._address).send({from: root});
      const OMG = await setupSupply(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);
      const BAT = await setupBorrow(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);

      // Add cash to the protocol
      await addCash(moneyMarketHarness, BAT, root);

      // Supply some collateral
      expect(await spinarama.methods.supply(OMG._address, 15).send({from: accounts[0]})).toSucceed();

      await expect(
        spinarama.methods.liquidateLiquidate(OMG._address, 1, accounts[0], OMG._address, BAT._address, 0).call({from: accounts[0]})
      ).rejects.toRevert();
    });
  });
});
