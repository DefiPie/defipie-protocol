const {
    etherUnsigned,
    etherMantissa,
    address,
    blockNumber,
    increaseTime
  } = require('../Utils/Ethereum');
  
  const {
    makeVotingEscrow,
    makeToken,
    makeController,
    makeRegistryProxy,
    makeDistributor,
    makeInterestRateModel,
    makePTokenFactory
  } = require('../Utils/DeFiPie');

  const { default: BigNumber } = require('bignumber.js');
  
  const exchangeRate = 1e10;
  
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
  
  describe('borrow PPIE', () => {
    let registryProxy, controller, PIE, pPIE, oracle, root, borrower, minter, benefactor, accounts, governor, votingEscrow;
    let distributor, pTokenFactory;
    beforeEach(async () => {
      [root, borrower, minter, benefactor, ...accounts] = saddle.accounts;
      oracle = await deploy('FixedPriceOracleV2');
      registryProxy = await makeRegistryProxy();
  
      PIE = await makeToken();
      controller = await makeController({ priceOracle: oracle, registryProxy: registryProxy, pieRate: exchangeRate });

      closeFactor = '500000000000000000';
      liquidationIncentive = '1100000000000000000';
      let tx01 = await send(controller, '_setCloseFactor', [closeFactor]);
      expect(tx01).toSucceed();
      let tx02 = await send(controller, '_setLiquidationIncentive', [liquidationIncentive]);
      expect(tx02).toSucceed();

      expect(await call(controller, 'registry')).toEqual(registryProxy._address);
    
      governor = await deploy('Governor', [address(0), registryProxy._address, root, '19710']);

      distributor = await makeDistributor({
        registryProxy: registryProxy,
        controller: controller,
        pieRate: exchangeRate,
        pie: PIE
      });

      expect(await call(distributor, 'getPieAddress')).toEqual(PIE._address);

      interestRateModel = await makeInterestRateModel();

      pTokenFactory = await makePTokenFactory({
          registryProxy: registryProxy,
          controller: controller,
          interestRateModel: interestRateModel,
          priceOracle: oracle
      });
    });

    it("withdraw after reward, check balance distribution", async () => {
      await send(oracle, 'setPrice', [PIE._address, '1000000000000000000']); // $1
      await send(oracle, 'setSearchPair', [PIE._address, '1000']);

      let tx5 = await send(pTokenFactory, 'createPToken', [PIE._address]);
      let pPIEAddress = tx5.events['PTokenCreated'].returnValues['newPToken'];

      pPIE = await saddle.getContractAt('PPIEDelegateHarness', pPIEAddress);

      await send(registryProxy, 'addPPIE', [pPIE._address]);

      votingEscrow = await makeVotingEscrow({token: PIE, registryProxy: registryProxy, governor: governor._address})
      await send(controller, 'setVotingEscrow', [votingEscrow._address]);
      await send(votingEscrow, '_setController', [controller._address]);

      //start creating locks
      await send(PIE, 'transfer', [accounts[2], etherUnsigned(1e23)]);
      await send(PIE, 'transfer', [accounts[3], etherUnsigned(1e23)]);
      await send(PIE, 'transfer', [accounts[4], etherUnsigned(1e23)]);

      await send(PIE, 'approve', [votingEscrow._address, '10000000000000000000000'], {from: accounts[2]});
      await send(PIE, 'approve', [votingEscrow._address, '10000000000000000000000'], {from: accounts[3]});
      await send(PIE, 'approve', [votingEscrow._address, '10000000000000000000000'], {from: accounts[4]});

      await send(votingEscrow, 'createLock', ['10000000000000000000000', '1209602'], {from: accounts[2]});
      await send(votingEscrow, 'createLock', ['10000000000000000000000', '1209602'], {from: accounts[3]});
      await send(votingEscrow, 'createLock', ['10000000000000000000000', '1209602'], {from: accounts[4]});

      expect(await call(pPIE, 'balanceOf', [votingEscrow._address])).toEqual('3000000000000');

      let block = await web3.eth.getBlock(await blockNumber());
      let endTimestamp = +block.timestamp + +1209700;
      mine(endTimestamp);

      //transfer reward
      const reward = '1000000000000000000';
      await send(PIE, 'transfer', [controller._address, reward]);

      expect(await call(PIE, 'balanceOf', [controller._address])).toEqual(reward);
      expect(await call(pPIE, 'balanceOf', [controller._address])).toEqual('0');
      
      const prevVePpieBal = await call(pPIE, 'balanceOf', [votingEscrow._address]);

      const tx1 = await send(controller, 'transferModeratePoolReward');

      expect(await call(PIE, 'balanceOf', [votingEscrow._address])).toEqual('0');

      const expectedPPIE = (new BigNumber(reward)).div(exchangeRate);
      expect(await call(pPIE, 'balanceOf', [votingEscrow._address])).toEqual((expectedPPIE.plus(prevVePpieBal)).toFixed());

      //withdraw now
      let res = await send(votingEscrow, 'withdraw', {from: accounts[2]});
      res = await send(votingEscrow, 'withdraw', {from: accounts[3]});
      res = await send(votingEscrow, 'withdraw', {from: accounts[4]});

      expect(await call(pPIE, 'balanceOf', [votingEscrow._address])).toEqual('0');
      expect(await call(pPIE, 'balanceOf', [accounts[2]])).toEqual('1000033333333'); 
      expect(await call(pPIE, 'balanceOf', [accounts[3]])).toEqual('1000033333333'); 
      expect(await call(pPIE, 'balanceOf', [accounts[4]])).toEqual('1000033333334');
    });
    
    it("withdraw after reward, check balance distribution, different balances", async () => {
      await send(oracle, 'setPrice', [PIE._address, '1000000000000000000']); // $1
      await send(oracle, 'setSearchPair', [PIE._address, '1000']);

      let tx5 = await send(pTokenFactory, 'createPToken', [PIE._address]);
      let pPIEAddress = tx5.events['PTokenCreated'].returnValues['newPToken'];

      pPIE = await saddle.getContractAt('PPIEDelegateHarness', pPIEAddress);

      await send(registryProxy, 'addPPIE', [pPIE._address]);

      votingEscrow = await makeVotingEscrow({token: PIE, registryProxy: registryProxy, governor: governor._address})
      await send(controller, 'setVotingEscrow', [votingEscrow._address]);
      await send(votingEscrow, '_setController', [controller._address]);

      //start creating locks
      await send(PIE, 'transfer', [accounts[2], etherUnsigned(1e23)]);
      await send(PIE, 'transfer', [accounts[3], etherUnsigned(1e23)]);
      await send(PIE, 'transfer', [accounts[4], etherUnsigned(1e23)]);

      await send(PIE, 'approve', [votingEscrow._address, '10000000000000000000000'], {from: accounts[2]});
      await send(PIE, 'approve', [votingEscrow._address, '10000000000000000000000'], {from: accounts[3]});
      await send(PIE, 'approve', [votingEscrow._address, '10000000000000000000000'], {from: accounts[4]});

      await send(votingEscrow, 'createLock', ['5000000000000000000000', '1209602'], {from: accounts[2]});
      await send(votingEscrow, 'createLock', ['7500000000000000000000', '1209602'], {from: accounts[3]});
      await send(votingEscrow, 'createLock', ['10000000000000000000000', '1209602'], {from: accounts[4]});

      expect(await call(pPIE, 'balanceOf', [votingEscrow._address])).toEqual('2250000000000');

      let block = await web3.eth.getBlock(await blockNumber());
      let endTimestamp = +block.timestamp + +1209700;
      mine(endTimestamp);

      //transfer reward
      const reward = '1000000000000000000';
      await send(PIE, 'transfer', [controller._address, reward]);

      expect(await call(PIE, 'balanceOf', [controller._address])).toEqual(reward);
      expect(await call(pPIE, 'balanceOf', [controller._address])).toEqual('0');
      
      const prevVePpieBal = await call(pPIE, 'balanceOf', [votingEscrow._address]);

      const tx1 = await send(controller, 'transferModeratePoolReward');

      expect(await call(PIE, 'balanceOf', [votingEscrow._address])).toEqual('0');

      const expectedPPIE = (new BigNumber(reward)).div(exchangeRate);
      expect(await call(pPIE, 'balanceOf', [votingEscrow._address])).toEqual((expectedPPIE.plus(prevVePpieBal)).toFixed());

      //withdraw now
      let res = await send(votingEscrow, 'withdraw', {from: accounts[2]});
      res = await send(votingEscrow, 'withdraw', {from: accounts[3]});
      res = await send(votingEscrow, 'withdraw', {from: accounts[4]});

      expect(await call(pPIE, 'balanceOf', [votingEscrow._address])).toEqual('0');
      expect(await call(pPIE, 'balanceOf', [accounts[2]])).toEqual('500022222222'); 
      expect(await call(pPIE, 'balanceOf', [accounts[3]])).toEqual('750033333333'); 
      expect(await call(pPIE, 'balanceOf', [accounts[4]])).toEqual('1000044444445');
    });

    it("check getting more PPIE after transferModeratePoolReward", async () => {
      let borrowDelay = 86400;
      let borrowToken = await makeToken();

      let tx1 = await send(oracle, 'setPrice', [PIE._address, '1000000000000000000']); // $1
      let tx2 = await send(oracle, 'setSearchPair', [PIE._address, '1000']);

      expect(tx1).toSucceed();
      expect(tx2).toSucceed();

      let tx3 = await send(oracle, 'setPrice', [borrowToken._address, '25000000000000000000']); // $25
      let tx4 = await send(oracle, 'setSearchPair', [borrowToken._address, '1000']);

      expect(tx3).toSucceed();
      expect(tx4).toSucceed();

      let tx5 = await send(pTokenFactory, 'createPToken', [PIE._address]);
      let pPIEAddress = tx5.events['PTokenCreated'].returnValues['newPToken'];
      expect(tx5).toSucceed();

      let block = await web3.eth.getBlock(await blockNumber());
      let startBorrowTimestamp = +block.timestamp + +borrowDelay;
      expect(tx5).toHaveLog('PTokenCreated', {
          newPToken: pPIEAddress,
          startBorrowTimestamp: startBorrowTimestamp,
          underlyingType: '1'
      });
      
      let tx6 = await send(pTokenFactory, 'createPToken', [borrowToken._address]);
      let pBorrowTokenAddress = tx6.events['PTokenCreated'].returnValues['newPToken'];
      expect(tx6).toSucceed();

      block = await web3.eth.getBlock(await blockNumber());
      startBorrowTimestamp = +block.timestamp + +borrowDelay;
      expect(tx6).toHaveLog('PTokenCreated', {
          newPToken: pBorrowTokenAddress,
          startBorrowTimestamp: startBorrowTimestamp,
          underlyingType: '1'
      });

      let tx7 = await send(oracle, 'setUnderlyingPrice', [pPIEAddress, '1000000000000000000']); // $1
      expect(tx7).toSucceed();
      let tx8 = await send(controller, '_setCollateralFactor', [pPIEAddress, '750000000000000000']); // 75%
      expect(tx8).toSucceed();
      let tx9 = await send(oracle, 'setUnderlyingPrice', [pBorrowTokenAddress, '1000000000000000000']); // $1
      expect(tx9).toSucceed();

      let tx10 = await send(PIE, 'harnessSetBalance', [accounts[0], "1000000000000000000000"], {from: accounts[0]}); // $1000
      let tx11 = await send(PIE, 'approve', [pPIEAddress, "1000000000000000000000000000000000000"], {from: accounts[0]});
      expect(tx10).toSucceed();
      expect(tx11).toSucceed();

      // 2. User0 mint simple pToken (deposit is $1000)
      pPIE = await saddle.getContractAt('PPIEDelegateHarness', pPIEAddress);
      let amount = '1000000000000000000000'; // $1000 = 1000e18
      let tx12 = await send(pPIE, 'mint', [amount], {from: accounts[0]});
      expect(tx12).toSucceed();

      // 3. User1 mint and approve fee token to pBorrowToken
      let tx13 = await send(borrowToken, 'harnessSetBalance', [accounts[1], "1000000000000000000000"], {from: accounts[1]}); // $1000
      let tx14 = await send(borrowToken, 'approve', [pBorrowTokenAddress, "1000000000000000000000000000000000000"], {from: accounts[1]});
      expect(tx13).toSucceed();
      expect(tx14).toSucceed();

      // 4. User1 mint pBorrowToken
      let pBorrowToken = await saddle.getContractAt('PErc20DelegateHarness', pBorrowTokenAddress);
      amount = '1000000000000000000000'; // $1000 = 1000e18
      let tx15 = await send(pBorrowToken, 'mint', [amount], {from: accounts[1]});
      expect(tx15).toSucceed();

      let markets = [pBorrowTokenAddress, pPIEAddress];
      let tx16 = await send(controller, 'enterMarkets', [markets], {from: accounts[0]});
      expect(tx16).toSucceed();

      // 3. User0 borrow pBorrowToken token (collateral simple pToken)
      // try borrow with under max amount
      let borrowAmount = '57692307692307692307'; //10% borrow

      block = await web3.eth.getBlock(await blockNumber());
      // borrowDelay default is 86400;
      let currentBorrowDelay = startBorrowTimestamp - +block.timestamp;
      await increaseTime(currentBorrowDelay);

      let tx18 = await send(pBorrowToken, 'borrow', [borrowAmount], {from: accounts[0]});
      expect(tx18).toSucceed();

      await increaseTime(1);

      let tx19 = await send(pBorrowToken, 'borrow', [borrowAmount], {from: accounts[0]});
      expect(tx19).toSucceed();

      //start creating locks
      await send(registryProxy, 'addPPIE', [pPIE._address]);

      votingEscrow = await makeVotingEscrow({token: PIE, registryProxy: registryProxy, governor: governor._address})
      await send(controller, 'setVotingEscrow', [votingEscrow._address]);
      expect(await call(controller, 'votingEscrow')).not.toEqual('0x0000000000000000000000000000000000000000');

      await send(votingEscrow, '_setController', [controller._address]);

      expect(await call(PIE, 'balanceOf', [votingEscrow._address])).toEqual('0');
      expect(await call(pPIE, 'balanceOf', [votingEscrow._address])).toEqual('0');

      expect(await call(registryProxy, 'pPIE')).toEqual(pPIE._address);
      expect(await call(votingEscrow, 'registry')).toEqual(registryProxy._address);
      expect(await call(votingEscrow, 'token')).toEqual(PIE._address);

      await send(PIE, 'transfer', [accounts[3], etherUnsigned(1e23)]);
      await send(PIE, 'transfer', [accounts[4], etherUnsigned(1e23)]);

      await send(PIE, 'approve', [votingEscrow._address, '10000000000000000000000'], {from: accounts[3]});
      await send(PIE, 'approve', [votingEscrow._address, '10000000000000000000000'], {from: accounts[4]});

      expect(await call(PIE, 'balanceOf', [accounts[3]])).toEqual('100000000000000000000000');
      expect(await call(PIE, 'balanceOf', [accounts[4]])).toEqual('100000000000000000000000');

      const deposit = new BigNumber('10000000000000000000000');
      await send(votingEscrow, 'createLock', [deposit, '1209602'], {from: accounts[3]});
      await send(votingEscrow, 'createLock', [deposit, '1209602'], {from: accounts[4]});

      expect(await call(votingEscrow, 'balanceOf', [accounts[3]])).not.toEqual('0');
      expect(await call(votingEscrow, 'balanceOf', [accounts[4]])).not.toEqual('0');

      expect(await call(PIE, 'balanceOf', [votingEscrow._address])).toEqual('0');
      expect(await call(pPIE, 'balanceOf', [votingEscrow._address])).toEqual(deposit.multipliedBy(2).div(exchangeRate).toFixed());

      expect(await call(PIE, 'balanceOf', [accounts[3]])).toEqual('90000000000000000000000');
      expect(await call(PIE, 'balanceOf', [accounts[4]])).toEqual('90000000000000000000000');

      expect(await call(pPIE, 'balanceOf', [accounts[3]])).toEqual('0');
      expect(await call(pPIE, 'balanceOf', [accounts[4]])).toEqual('0');

      block = await web3.eth.getBlock(await blockNumber());
      let endTimestamp = +block.timestamp + +1209700;
      mine(endTimestamp);

      //casual withdraw
      let res = await send(votingEscrow, 'withdraw', {from: accounts[3]});

      expect(res).toSucceed();
      expect(res).toHaveLog('Withdraw', {
        provider: accounts[3],
        ts: (await web3.eth.getBlock(await blockNumber())).timestamp,
        value: '10000000000000000000000'
      });

      expect(await call(pPIE, 'balanceOf', [votingEscrow._address])).toEqual(deposit.div(exchangeRate).toFixed());

      //transfer reward
      const reward = '1000000000000000000';
      await send(PIE, 'transfer', [controller._address, reward]);

      expect(await call(PIE, 'balanceOf', [controller._address])).toEqual(reward);
      expect(await call(pPIE, 'balanceOf', [controller._address])).toEqual('0');
      
      const prevVePpieBal = await call(pPIE, 'balanceOf', [votingEscrow._address]);

      await send(controller, 'transferModeratePoolReward');

      expect(await call(PIE, 'balanceOf', [votingEscrow._address])).toEqual('0');

      const expectedPPIE = (new BigNumber(reward)).div(exchangeRate);
      expect(await call(pPIE, 'balanceOf', [votingEscrow._address])).toEqual((expectedPPIE.plus(prevVePpieBal)).toFixed());

      //withdraw now
      res = await send(votingEscrow, 'withdraw', {from: accounts[4]});

      expect(res).toSucceed();
      expect(res).toHaveLog('Withdraw', {
        provider: accounts[4],
        ts: (await web3.eth.getBlock(await blockNumber())).timestamp,
        value: '10000000000000000000000'
      });

      expect(await call(pPIE, 'balanceOf', [votingEscrow._address])).toEqual('0');
      expect(await call(pPIE, 'balanceOf', [accounts[3]])).toEqual(deposit.div(exchangeRate).toFixed());
      expect(await call(pPIE, 'balanceOf', [accounts[4]])).toEqual((expectedPPIE.plus(prevVePpieBal)).toFixed());
    });

    it("controller transfers pool reward to VE and new PPIE mints", async () => {
      let tx5 = await send(pTokenFactory, 'createPToken', [PIE._address]);
      let pPIEAddress = tx5.events['PTokenCreated'].returnValues['newPToken'];
      expect(tx5).toSucceed();

      pPIE = await saddle.getContractAt('PPIEDelegateHarness', pPIEAddress);

      await send(registryProxy, 'addPPIE', [pPIE._address]);

      votingEscrow = await makeVotingEscrow({token: PIE, registryProxy: registryProxy, governor: governor._address})
      await send(controller, 'setVotingEscrow', [votingEscrow._address]);
      await send(votingEscrow, '_setController', [controller._address]);

      expect(await call(PIE, 'balanceOf', [controller._address])).toEqual('0');
      expect(await call(pPIE, 'balanceOf', [controller._address])).toEqual('0');

      expect(await call(registryProxy, 'pPIE')).toEqual(pPIE._address);
      expect(await call(votingEscrow, 'registry')).toEqual(registryProxy._address);
      expect(await call(votingEscrow, 'token')).toEqual(PIE._address);

      await send(PIE, 'transfer', [controller._address, etherUnsigned(1e18)]);

      expect(await call(PIE, 'balanceOf', [controller._address])).toEqual('1000000000000000000');
      expect(await call(pPIE, 'balanceOf', [controller._address])).toEqual('0');
      
      const tx1 = await send(controller, 'transferModeratePoolReward');
      
      expect(tx1).toSucceed();
      expect(tx1).toHaveLog('ModeratePoolReward', {
        poolReward: '1000000000000000000'
      });

      expect(await call(PIE, 'balanceOf', [votingEscrow._address])).toEqual('0');

      const expectedPPIE = (new BigNumber('1000000000000000000')).div(exchangeRate);
      expect(await call(PIE, 'balanceOf', [controller._address])).toEqual('0');

      expect(await call(pPIE, 'balanceOf', [votingEscrow._address])).toEqual(expectedPPIE.toFixed());
    });
  });
  