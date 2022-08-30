const {
  etherMantissa,
  both, blockNumber
} = require('../Utils/Ethereum');

const {
  makeController,
  makePTokenFactory,
  makePToken,
  makeToken
} = require('../Utils/DeFiPie');

const mine = (timestamp) => {
    return new Promise((resolve, reject) => {
        saddle.web3.currentProvider.send({
            jsonrpc: '2.0',
            method: 'evm_mine',
            id: Date.now(),
            params: [timestamp],
        }, (err, res) => {
            if (err) return reject(err);
            resolve(res)
        })
    })
};

describe('User moderate pool', () => {
  let root, accounts, factory, controller, oracle;
  let ppieAddress;

  beforeEach(async () => {
    [root, guardian, ...accounts] = saddle.accounts;
    oracle = await deploy('FixedPriceOracleV2');
    controller = await makeController();
    factory = await makePTokenFactory({registryProxy: controller.registryProxy, controller: controller, priceOracle: oracle});
  });

  describe('Init state', () => {
    it("Check default values", async () => {
      expect(await call(factory, 'controller')).toEqual(controller._address);
      expect(await call(factory, 'registry')).toEqual(controller.registryProxy._address);

      expect(await call(factory, 'createPoolFeeAmount')).toEqualNumber(0);
      expect(await call(controller, 'userPauseDepositAmount')).toEqualNumber(0);
      expect(await call(controller, 'guardianModerateTime')).toEqualNumber(0);
      expect(await call(controller, 'totalFreeze')).toEqualNumber(0);
    });
  });

  describe("Check PoolFeeAmount", () => {
    it("set PoolFeeAmount", async () => {
      await send(factory, '_setCreatePoolFeeAmount', [1]);
      expect(await call(factory, 'createPoolFeeAmount')).toEqual('1');
    });

    it("set PoolFeeAmount, not UNAUTHORIZED", async () => {
      let result = await send(factory, '_setCreatePoolFeeAmount', [1], {from: accounts[1]});
      expect(result).toHaveFactoryFailure('UNAUTHORIZED', 'SET_NEW_CREATE_POOL_FEE_AMOUNT');
    });
  });

  describe("Check UserModeratePoolData", () => {
    it("set UserModeratePoolData", async () => {
      await send(controller, '_setUserModeratePoolData', [1, 1]);
      expect(await call(controller, 'userPauseDepositAmount')).toEqual('1');
      expect(await call(controller, 'guardianModerateTime')).toEqual('1');
    });

    it("set UserModeratePoolData, not UNAUTHORIZED", async () => {
      await expect(send(controller, '_setUserModeratePoolData', [1,1], {from: accounts[1]})).rejects.toRevert('revert only admin can change');
    });
  });

  describe("Check setFreezePoolAmount", () => {
    it("set freezePoolAmount, not factory", async () => {
      await expect(send(controller, 'setFreezePoolAmount', [accounts[0], 1])).rejects.toRevert('revert only factory can set freeze');
    });
  });

  describe('Start state', () => {
    let createPoolFeeAmount = '10000000000000000000'; // 10e18 - 10 tokens
    let userPauseDepositAmount = '20000000000000000000'; // 20e18 - 20 tokens
    let guardianModerateTime = '86400'; // 1 day
    let feeAmountAndUserDeposit = '30000000000000000000'; // createPoolFeeAmount + userPauseDepositAmount

    beforeEach(async () => {
      await send(factory, '_setCreatePoolFeeAmount', [createPoolFeeAmount]);
      await send(controller, '_setUserModeratePoolData', [userPauseDepositAmount, guardianModerateTime]);
    });

    describe('Check start state', () => {
      it("Check update values", async () => {
        expect(await call(factory, 'createPoolFeeAmount')).toEqual(createPoolFeeAmount);
        expect(await call(controller, 'userPauseDepositAmount')).toEqual(userPauseDepositAmount);
        expect(await call(controller, 'guardianModerateTime')).toEqual(guardianModerateTime);
      });
    });

    describe('Create pToken', () => {
      let underlying;

      beforeEach(async () => {
        let pPIEImplementation = await deploy('PPIEDelegateHarness');
        let res1 = await send(factory, '_createPPIE', [controller.pie._address, pPIEImplementation._address]);
        expect(res1).toSucceed();
        ppieAddress = res1.events['PTokenCreated'].returnValues['newPToken'];

        underlying = await makeToken();
      });

      it("Check revert without approve and values", async () => {
        await expect(
            send(factory, 'createPToken', [underlying._address])
        ).rejects.toRevert('revert Pie::transferFrom: transfer amount exceeds spender allowance');
      });

      it("Check create pToken, check state", async () => {
        let transferTokens = await send(controller.pie, 'transfer', [accounts[1], createPoolFeeAmount]);
        expect(transferTokens).toSucceed();
        let approveTokens = await send(controller.pie, 'approve', [factory._address, createPoolFeeAmount], {from: accounts[1]});
        expect(approveTokens).toSucceed();

        let balanceOfUserBefore = await call(controller.pie, 'balanceOf', [accounts[1]]);
        expect(balanceOfUserBefore).toEqual(createPoolFeeAmount);
        let balanceOfControllerBefore = await call(controller.pie, 'balanceOf', [controller._address]);
        expect(balanceOfControllerBefore).toEqual('0');

        let result = await send(factory, 'createPToken', [underlying._address], {from: accounts[1]});
        let pTokenAddress = result.events['PTokenCreated'].returnValues['newPToken'];
        let block = await web3.eth.getBlock(await blockNumber());
        let startBorrowTimestamp = +block.timestamp + +86400;

        expect(result).toHaveLog('PTokenCreated', {
          newPToken: pTokenAddress,
          startBorrowTimestamp: startBorrowTimestamp,
          underlyingType: '1'
        });

        let balanceOfUserAfter = await call(controller.pie, 'balanceOf', [accounts[1]]);
        expect(balanceOfUserAfter).toEqual('0');
        let balanceOfControllerAfter = await call(controller.pie, 'balanceOf', [controller._address]);
        expect(balanceOfControllerAfter).toEqual(createPoolFeeAmount);
      });

      it("Check transfer unused reward after success create pool", async () => {
        let transferTokens = await send(controller.pie, 'transfer', [accounts[1], createPoolFeeAmount]);
        let approveTokens = await send(controller.pie, 'approve', [factory._address, createPoolFeeAmount], {from: accounts[1]});
        let result = await send(factory, 'createPToken', [underlying._address], {from: accounts[1]});
        let pTokenAddress = result.events['PTokenCreated'].returnValues['newPToken'];

        let block = await web3.eth.getBlock(await blockNumber());
        let startBorrowTimestamp = +block.timestamp + +86400;

        let timestamp = +startBorrowTimestamp + +guardianModerateTime +1;

        let ControllerBalanceBefore = await call(controller.pie, 'balanceOf', [controller._address]);
        expect(ControllerBalanceBefore).toEqual(createPoolFeeAmount);

        let res0 = await send(controller, 'transferModeratePoolReward', {from: accounts[1]});
        expect(res0).toSucceed();

        let ControllerBalanceAfter = await call(controller.pie, 'balanceOf', [controller._address]);
        expect(ControllerBalanceAfter).toEqual(createPoolFeeAmount);

        await expect(
          send(controller, 'harvestUnusedReward', [pTokenAddress], {from: accounts[1]})
        ).rejects.toRevert('revert current time is less than user end moderate pool time');

        mine(timestamp);

        let totalFreezeBefore = await call(controller, 'totalFreeze');
        expect(totalFreezeBefore).toEqual(createPoolFeeAmount);

        let rewardStateBefore = await call(controller, 'moderatePools', [pTokenAddress]);
        expect(rewardStateBefore['0']).toEqual('0');

        let res1 = await send(controller, 'harvestUnusedReward', [pTokenAddress], {from: accounts[1]});
        expect(res1).toSucceed();

        expect(res1).toHaveLog('UnfreezePoolAmount', {
          pToken: pTokenAddress,
          freezePoolAmount: createPoolFeeAmount
        });

        let totalFreezeAfter = await call(controller, 'totalFreeze');
        expect(totalFreezeAfter).toEqual('0');

        let rewardStateAfter = await call(controller, 'moderatePools', [pTokenAddress]);
        expect(rewardStateAfter['0']).toEqual('4');

        let ppieAddress = await call(controller.registryProxy, 'pPIE');
        let balanceOfUserBefore = await call(controller.pie, 'balanceOf', [ppieAddress]);
        expect(balanceOfUserBefore).toEqual('0');
        let balanceOfControllerBefore = await call(controller.pie, 'balanceOf', [controller._address]);
        expect(balanceOfControllerBefore).toEqual(createPoolFeeAmount);

        let res2 = await send(controller, 'transferModeratePoolReward', {from: accounts[1]});
        expect(res2).toSucceed();

        let balanceOfUserAfter = await call(controller.pie, 'balanceOf', [ppieAddress]);
        expect(balanceOfUserAfter).toEqual(createPoolFeeAmount);
        let balanceOfControllerAfter = await call(controller.pie, 'balanceOf', [controller._address]);
        expect(balanceOfControllerAfter).toEqual('0');

        await expect(
          send(controller, 'harvestUnusedReward', [pTokenAddress], {from: accounts[1]})
        ).rejects.toRevert('revert reward must be unused');
      });

      describe('Moderate pToken', () => {
        beforeEach(async () => {
          let res = await send(controller, '_setPauseGuardian', [guardian]);
          expect(res).toSucceed();
        });

        it("Check guardian unpause", async () => {
          let transferTokens = await send(controller.pie, 'transfer', [accounts[1], createPoolFeeAmount]);
          let approveTokens = await send(controller.pie, 'approve', [factory._address, createPoolFeeAmount], {from: accounts[1]});
          let result = await send(factory, 'createPToken', [underlying._address], {from: accounts[1]});
          let pTokenAddress = result.events['PTokenCreated'].returnValues['newPToken'];

          let block = await web3.eth.getBlock(await blockNumber());
          let startBorrowTimestamp = +block.timestamp + +86400;
          let timestamp = +startBorrowTimestamp + +guardianModerateTime +1;

          result = await send(controller, '_setBorrowPaused', [pTokenAddress, false], {from: guardian});
          expect(result).toSucceed();

          await send(controller, '_setBorrowPaused', [pTokenAddress, true], {from: guardian});

          mine(timestamp);

          await expect(
              send(controller, '_setBorrowPaused', [pTokenAddress, false], {from: accounts[1]})
          ).rejects.toRevert('revert only pause');
        });

        it("Check moderate (reverts for user)", async () => {
          let transferTokens = await send(controller.pie, 'transfer', [accounts[1], createPoolFeeAmount]);
          let approveTokens = await send(controller.pie, 'approve', [factory._address, createPoolFeeAmount], {from: accounts[1]});
          let result = await send(factory, 'createPToken', [underlying._address], {from: accounts[1]});
          let pTokenAddress = result.events['PTokenCreated'].returnValues['newPToken'];

          let block = await web3.eth.getBlock(await blockNumber());
          let startBorrowTimestamp = +block.timestamp + +86400;
          let timestamp = +startBorrowTimestamp + +guardianModerateTime +1;

          await expect(
              send(controller, '_setBorrowPaused', [pTokenAddress, false], {from: accounts[2]})
          ).rejects.toRevert('revert only pause');

          await expect(
              send(controller, '_setBorrowPaused', [pTokenAddress, true], {from: accounts[2]})
          ).rejects.toRevert('revert Pie::transferFrom: transfer amount exceeds spender allowance');

          mine(timestamp);

          await expect(
              send(controller, '_setBorrowPaused', [pTokenAddress, true], {from: accounts[2]})
          ).rejects.toRevert('revert only before startBorrow');
        });

        it("Check moderate (rejected, harvestUnusedReward)", async () => {
          let transferTokens = await send(controller.pie, 'transfer', [accounts[1], createPoolFeeAmount]);
          let approveTokens = await send(controller.pie, 'approve', [factory._address, createPoolFeeAmount], {from: accounts[1]});
          let result = await send(factory, 'createPToken', [underlying._address], {from: accounts[1]});
          let pTokenAddress = result.events['PTokenCreated'].returnValues['newPToken'];

          let block = await web3.eth.getBlock(await blockNumber());
          let startBorrowTimestamp = +block.timestamp + +86400;
          let endTimestamp = +startBorrowTimestamp + +guardianModerateTime +1;

          let transferTokensForPause = await send(controller.pie, 'transfer', [accounts[2], userPauseDepositAmount]);
          let approveTokensForPause = await send(controller.pie, 'approve', [controller._address, userPauseDepositAmount], {from: accounts[2]});

          let totalFreezeAfterCreateToken = await call(controller, 'totalFreeze');
          expect(totalFreezeAfterCreateToken).toEqual(createPoolFeeAmount);

          let res2 = await send(controller, '_setBorrowPaused', [pTokenAddress, true], {from: accounts[2]});
          expect(res2).toSucceed();

          let totalFreezeAfterBorrowPaused = await call(controller, 'totalFreeze');
          expect(totalFreezeAfterBorrowPaused).toEqual(feeAmountAndUserDeposit); // createPoolFeeAmount + userPauseDepositAmount

          let rewardStateStart = await call(controller, 'moderatePools', [pTokenAddress]);
          expect(rewardStateStart['0']).toEqual('1');
          expect(rewardStateStart['1']).toEqual(feeAmountAndUserDeposit); // createPoolFeeAmount + userPauseDepositAmount
          expect(rewardStateStart['2']).toEqual(accounts[2]);

          let res3 = await send(controller, '_setBorrowPaused', [pTokenAddress, false], {from: guardian});
          expect(res3).toSucceed();

          let rewardStateAfter = await call(controller, 'moderatePools', [pTokenAddress]);
          expect(rewardStateAfter['0']).toEqual('2');
          expect(rewardStateAfter['1']).toEqual(feeAmountAndUserDeposit); // createPoolFeeAmount + userPauseDepositAmount
          expect(rewardStateAfter['2']).toEqual(accounts[2]);

          mine(endTimestamp);

          let balanceOfPPiePoolBefore = await call(controller.pie, 'balanceOf', [ppieAddress]);
          expect(balanceOfPPiePoolBefore).toEqual('0');
          let balanceOfControllerBefore = await call(controller.pie, 'balanceOf', [controller._address]);
          expect(balanceOfControllerBefore).toEqual(feeAmountAndUserDeposit);

          let res4 = await send(controller, 'harvestUnusedReward', [pTokenAddress]);
          expect(res4).toSucceed();

          let totalFreezeAfterHarvest = await call(controller, 'totalFreeze');
          expect(totalFreezeAfterHarvest).toEqual('0');

          await expect(
            send(controller, 'harvestUnusedReward', [pTokenAddress])
          ).rejects.toRevert('revert reward must be unused');

          let res5 = await send(controller, 'transferModeratePoolReward');
          expect(res5).toSucceed();

          let balanceOfPPiePoolAfter = await call(controller.pie, 'balanceOf', [ppieAddress]);
          expect(balanceOfPPiePoolAfter).toEqual(feeAmountAndUserDeposit);
          let balanceOfControllerAfter = await call(controller.pie, 'balanceOf', [controller._address]);
          expect(balanceOfControllerAfter).toEqual('0');

          let rewardStateAfterReward = await call(controller, 'moderatePools', [pTokenAddress]);
          expect(rewardStateAfterReward['0']).toEqual('4');
          expect(rewardStateAfterReward['1']).toEqual(feeAmountAndUserDeposit); // createPoolFeeAmount + userPauseDepositAmount
          expect(rewardStateAfterReward['2']).toEqual(accounts[2]);
        });

        it("Check moderate (confirmed, harvestUnusedReward)", async () => {
          let transferTokens = await send(controller.pie, 'transfer', [accounts[1], createPoolFeeAmount]);
          let approveTokens = await send(controller.pie, 'approve', [factory._address, createPoolFeeAmount], {from: accounts[1]});
          let result = await send(factory, 'createPToken', [underlying._address], {from: accounts[1]});
          let pTokenAddress = result.events['PTokenCreated'].returnValues['newPToken'];
          let block = await web3.eth.getBlock(await blockNumber());
          let startBorrowTimestamp = +block.timestamp + +86400;
          let endTimestamp = +startBorrowTimestamp + +guardianModerateTime +1;

          let transferTokensForPause = await send(controller.pie, 'transfer', [accounts[2], userPauseDepositAmount]);
          let approveTokensForPause = await send(controller.pie, 'approve', [controller._address, userPauseDepositAmount], {from: accounts[2]});

          let totalFreezeAfterCreateToken = await call(controller, 'totalFreeze');
          expect(totalFreezeAfterCreateToken).toEqual(createPoolFeeAmount);

          let res2 = await send(controller, '_setBorrowPaused', [pTokenAddress, true], {from: accounts[2]});
          expect(res2).toSucceed();

          let totalFreezeAfterBorrowPaused = await call(controller, 'totalFreeze');
          expect(totalFreezeAfterBorrowPaused).toEqual(feeAmountAndUserDeposit); // createPoolFeeAmount + userPauseDepositAmount

          let rewardStateStart = await call(controller, 'moderatePools', [pTokenAddress]);
          expect(rewardStateStart['0']).toEqual('1');
          expect(rewardStateStart['1']).toEqual(feeAmountAndUserDeposit); // createPoolFeeAmount + userPauseDepositAmount
          expect(rewardStateStart['2']).toEqual(accounts[2]);

          mine(endTimestamp);

          let balanceOfUserBefore = await call(controller.pie, 'balanceOf', [accounts[2]]);
          expect(balanceOfUserBefore).toEqual('0');
          let balanceOfControllerBefore = await call(controller.pie, 'balanceOf', [controller._address]);
          expect(balanceOfControllerBefore).toEqual(feeAmountAndUserDeposit);

          await expect(
            send(controller, 'getModerateUserReward', [pTokenAddress], {from: accounts[1]})
          ).rejects.toRevert('revert only moderate pool user can get reward');

          let res4 = await send(controller, 'getModerateUserReward', [pTokenAddress], {from: accounts[2]});
          expect(res4).toSucceed();

          await expect(
              send(controller, 'getModerateUserReward', [pTokenAddress], {from: accounts[2]})
          ).rejects.toRevert('revert only once');

          let balanceOfUserAfter = await call(controller.pie, 'balanceOf', [accounts[2]]);
          expect(balanceOfUserAfter).toEqual(feeAmountAndUserDeposit);
          let balanceOfControllerAfter = await call(controller.pie, 'balanceOf', [controller._address]);
          expect(balanceOfControllerAfter).toEqual('0');

          let rewardStateAfterReward = await call(controller, 'moderatePools', [pTokenAddress]);
          expect(rewardStateAfterReward['0']).toEqual('3');
          expect(rewardStateAfterReward['1']).toEqual(feeAmountAndUserDeposit); // createPoolFeeAmount + userPauseDepositAmount
          expect(rewardStateAfterReward['2']).toEqual(accounts[2]);
        });
      });
    });
  });
});
