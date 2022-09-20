const {
  constants,    // Common constants, like the zero address and largest integers
} = require('@openzeppelin/test-helpers');

const {
    makePToken,
    makeController,
    makeRegistryProxy,
    makeInterestRateModel,
    balanceOf,
    makeVotingEscrow
} = require('../Utils/DeFiPie');

const {
    address,
    blockNumber,
    increaseTime,
    setTime,
    etherMantissa
} = require('../Utils/Ethereum');
const BigNumber = require('bignumber.js');

describe('Voting Escrow', () => {
  const name = 'VEPie';
  const symbol = 'VE';

  let root, guardian, user, accounts;
  let governor;
  let registryProxy, ppie, underlying, votingEscrow;
  let minLockAmount, minDuration, maxDuration;
  let oneWeekInSeconds;
  
  beforeEach(async () => {
    [root, guardian, user, ...accounts] = saddle.accounts;
    
    maxDuration = '125798400';
    minDuration = '604800';
    minLockAmount = '1000000000000000000000';
    oneWeekInSeconds = '604800';
    exchangeRate = 50;

    registryProxy = await makeRegistryProxy();
    ppie = await makePToken({registryProxy: registryProxy, kind: 'ppie', exchangeRate: (exchangeRate * 0.0000000001).toString()});
    underlying = ppie.underlying;

    governor = await deploy('Governor', [address(0), registryProxy._address, guardian, '19710']);
    votingEscrow = await makeVotingEscrow({token: underlying, registryProxy: registryProxy, governor: governor._address});
  });

  describe('checkpoint test', () => {
    let epoch = -1;
    let pointHistory = -1;
    let userPointHistory = -1;
    let blockNum = -1;
    let amount = '10000000000000000000000';
    let lockTime = '8000000';

    beforeEach(async () => {
      await send(underlying, 'transfer', [accounts[0], amount]);
      await send(underlying, 'transfer', [accounts[1], amount]);

      await send(underlying, 'approve', [votingEscrow._address, '50000000000000000000000']);
      await send(underlying, 'approve', [votingEscrow._address, amount], {from: accounts[0]});
      await send(underlying, 'approve', [votingEscrow._address, amount], {from: accounts[1]});
    });

    it('checkpoints data checkers', async function () {
      epoch = await call(votingEscrow, 'epoch');
      expect(epoch).toEqual('0');

      let txLock = await send(votingEscrow, 'createLock', [amount, lockTime]);
      let txLock0 = await send(votingEscrow, 'createLock', [amount, lockTime], { from: accounts[0]});
      let txLock1 = await send(votingEscrow, 'createLock', [amount, lockTime], { from: accounts[1]});

      let txDepositFor = await send(votingEscrow, 'depositFor', [root, amount]);

      //
      epoch = await call(votingEscrow, 'epoch');
      expect(epoch).toEqual('4'); //static epoch checker. 3 locks + deposit = epoch #4

      userEpoch = await call(votingEscrow, 'userPointEpoch', [root]);
      expect(userEpoch).toEqual('2'); //static userEpoch checker. lock+deposit = epoch #2

      userPointHistory = await call(votingEscrow, 'userPointHistory', [root, userEpoch]);
      rootPriorVotes = await call(votingEscrow, 'getPriorVotes', [root, '53']);

      expect(rootPriorVotes).toBeTruthy();
      expect(userPointHistory['bias']).toBeTruthy();

      pointHistory = await call(votingEscrow, 'pointHistory', [epoch]);
      expect(pointHistory['bias']).toBeTruthy();
      //

      increaseTime(parseInt(lockTime));

      let txWithdraw = await send(votingEscrow, 'withdraw');

      //
      epoch = await call(votingEscrow, 'epoch'); //first epoch after withdraw
      expect(parseInt(epoch)).toBeGreaterThan(3); //must be increased w/ time

      userEpoch = await call(votingEscrow, 'userPointEpoch', [root]);
      expect(userEpoch).toEqual('3'); //static userEpoch checker. lock+deposit+withdraw = epoch #3

      userPointHistory = await call(votingEscrow, 'userPointHistory', [root, userEpoch]);
      expect(userPointHistory['bias']).toEqual('0'); //no weight after exceeding time

      pointHistory = await call(votingEscrow, 'pointHistory', [epoch]);
      expect(userPointHistory['bias']).toEqual('0');
      //

      expect(txWithdraw).toHaveLog('Supply', {
        prevSupply: '40000000000000000000000',
        supply: '20000000000000000000000',
      });
    });

    it('delegate => timeIncrease => checkVotes', async function () {
      let txLock = await send(votingEscrow, 'createLock', [amount, lockTime]);
      let txLock0 = await send(votingEscrow, 'createLock', [amount, lockTime], { from: accounts[0]});
      let txDelegate = await send(votingEscrow, 'delegate', [root], {from: accounts[0]});

      const votes = await call(votingEscrow, 'balanceOf', [root]);
      const votes0 = await call(votingEscrow, 'balanceOf', [accounts[0]]);
      const sumVotes = (Number(votes) + Number(votes0)).toString().replace('.', '');

      await increaseTime(0);
      blockNum = await blockNumber();

      const startDelegatedVotes = await call(votingEscrow, 'getPriorVotes', [root, (blockNum-1).toString()]);

      expect(startDelegatedVotes.substring(0,6)).toEqual(sumVotes.substring(0,6));

      await increaseTime(parseInt(lockTime) * 2);
      await increaseTime(0);

      blockNum = await blockNumber();

      const endDelegatedVotes = await call(votingEscrow, 'getPriorVotes', [root, (blockNum-1).toString()]);

      expect(endDelegatedVotes).toEqual('0');
    });

    it('delegateFromUser1, delegateFromUser2 => timeIncrease => checkVotes', async function () {
      let txLock = await send(votingEscrow, 'createLock', [amount, lockTime]);
      let txLock0 = await send(votingEscrow, 'createLock', [amount, lockTime], { from: accounts[0]});
      let txLock1 = await send(votingEscrow, 'createLock', [amount, lockTime], { from: accounts[1]});

      const votes = await call(votingEscrow, 'balanceOf', [root]);
      const votes0 = await call(votingEscrow, 'balanceOf', [accounts[0]]);
      const votes1 = await call(votingEscrow, 'balanceOf', [accounts[1]]);
      const sumVotes = (Number(votes) + Number(votes0) + Number(votes1)).toString().replace('.', '');

      let txDelegate0 = await send(votingEscrow, 'delegate', [root], {from: accounts[0]});
      let txDelegate1 = await send(votingEscrow, 'delegate', [root], {from: accounts[1]});

      await increaseTime(0);
      blockNum = await blockNumber();

      const startDelegatedVotes = await call(votingEscrow, 'getPriorVotes', [root, (blockNum-1).toString()]);

      expect(startDelegatedVotes.substring(0,12)).toEqual(sumVotes.substring(0,12));

      await increaseTime(parseInt(lockTime) * 2);
      await increaseTime(0);
      blockNum = await blockNumber();

      const endDelegatedVotes = await call(votingEscrow, 'getPriorVotes', [root, (blockNum-1).toString()]);

      expect(endDelegatedVotes).toEqual('0');
    });

    it('delegateFromUser1 => timeIncrease => checkVotes => delegateFromUser2 => timeIncrease => checkVotes', async function () {
      let txLock = await send(votingEscrow, 'createLock', [amount, lockTime]);
      let txLock0 = await send(votingEscrow, 'createLock', [amount, lockTime], { from: accounts[0]});

      const votes = await call(votingEscrow, 'balanceOf', [root]);
      const votes0 = await call(votingEscrow, 'balanceOf', [accounts[0]]);
      const sumVotes2 = (Number(votes) + Number(votes0)).toString().replace('.', '');

      let txDelegate0 = await send(votingEscrow, 'delegate', [root], {from: accounts[0]});

      await increaseTime(0);
      blockNum = await blockNumber();

      const startDelegatedVotes = await call(votingEscrow, 'getPriorVotes', [root, (blockNum-1).toString()]);

      expect(startDelegatedVotes.substring(0,12)).toEqual(sumVotes2.substring(0,12)); //double votes value

      await increaseTime(parseInt(lockTime));

      const votesRR = await call(votingEscrow, 'balanceOf', [root]);
      const votes00 = await call(votingEscrow, 'balanceOf', [accounts[0]]);
      expect(votesRR).toEqual('0');
      expect(votes00).toEqual('0');

      let txLock1 = await send(votingEscrow, 'createLock', [amount, lockTime], { from: accounts[1]});
      let txDelegate1 = await send(votingEscrow, 'delegate', [root], {from: accounts[1]});
      const votes1 = await call(votingEscrow, 'balanceOf', [accounts[1]]);

      await increaseTime(0);

      let balanceDelegate = await call(votingEscrow, 'getPriorVotes', [root, txDelegate1.blockNumber.toString()]);
      expect(balanceDelegate.substring(0,5)).toEqual((Number(votes1).toString()).substring(0,5)); //votes for only one deposit, others exceeded

      let txRmDelegate = await send(votingEscrow, 'removeDelegator', {from: accounts[1]});

      await increaseTime(0);

      balanceDelegate = await call(votingEscrow, 'getPriorVotes', [root, txRmDelegate.blockNumber.toString()]);
      expect(balanceDelegate).toEqual('0'); //balance after removal of delegation

      await increaseTime(parseInt(lockTime));
      await increaseTime(0);
      blockNum = await blockNumber();

      let user1Weight = await call(votingEscrow, 'getPriorVotes', [root, (blockNum-1).toString()]);
      expect(user1Weight).toEqual('0'); //votes of last user exceeded
    });
  });

  describe('Voting Escrow tests',  () =>  {
    it('Proxy complete test', async function () {
      let veImpl = await deploy('VotingEscrow');
      let veProxy = await deploy('VotingEscrowProxy', [veImpl._address, registryProxy._address, underlying._address, name, symbol, oneWeekInSeconds, minDuration, maxDuration, minLockAmount, governor._address]);

      expect(veProxy._address).not.toEqual(undefined);
      expect(veProxy._address).not.toEqual(constants.ZERO_ADDRESS);

      let votingEscrowProxy = await saddle.getContractAt('VotingEscrow', veProxy._address);

      expect(await call(votingEscrowProxy, 'implementation')).toEqual(veImpl._address);
      expect(await call(votingEscrowProxy, 'name')).toEqual(name);
      expect(await call(votingEscrowProxy, 'symbol')).toEqual(symbol);
      expect(await call(votingEscrowProxy, 'maxDuration')).toEqual(maxDuration.toString());
      expect(await call(votingEscrowProxy, 'minDuration')).toEqual(minDuration.toString());
      expect(await call(votingEscrowProxy, 'minLockAmount')).toEqual(minLockAmount.toString());
      expect(await call(votingEscrowProxy, 'interval')).toEqual(oneWeekInSeconds.toString());
      expect(await call(votingEscrowProxy, 'registry')).toEqual(registryProxy._address);
      expect(await call(votingEscrowProxy, 'governor')).toEqual(governor._address);
      expect(await call(votingEscrowProxy, 'supply')).toEqual("0");
      expect(await call(votingEscrowProxy, 'token')).toEqual(underlying._address);

      //change impl
      let newImpl = await deploy('VotingEscrow');

      expect(
        await send(veProxy, '_setImplementation', [newImpl._address], {from: accounts[0]})
      ).toHaveVotingEscrowFailure('UNAUTHORIZED', 'SET_NEW_IMPLEMENTATION');

      const result = await send(veProxy, '_setImplementation', [newImpl._address]);
      expect(result).toHaveLog('NewImplementation', {
        oldImplementation: veImpl._address,
        newImplementation: newImpl._address
      });

      expect(await call(votingEscrowProxy, 'implementation')).toEqual(newImpl._address);
      expect(await call(votingEscrowProxy, 'name')).toEqual(name);
      expect(await call(votingEscrowProxy, 'symbol')).toEqual(symbol);
      expect(await call(votingEscrowProxy, 'maxDuration')).toEqual(maxDuration.toString());
      expect(await call(votingEscrowProxy, 'minDuration')).toEqual(minDuration.toString());
      expect(await call(votingEscrowProxy, 'minLockAmount')).toEqual(minLockAmount.toString());
      expect(await call(votingEscrowProxy, 'interval')).toEqual(oneWeekInSeconds.toString());
      expect(await call(votingEscrowProxy, 'registry')).toEqual(registryProxy._address);
      expect(await call(votingEscrowProxy, 'governor')).toEqual(governor._address);
      expect(await call(votingEscrowProxy, 'supply')).toEqual("0");
      expect(await call(votingEscrowProxy, 'token')).toEqual(underlying._address);
    });
  });

  describe('Lock test',  () =>  {
    it('revert if create lock with little amount', async function () {
      let amount = '10000000000000000000000';
      await send(underlying, 'approve', [votingEscrow._address, amount]);

      await expect(send(votingEscrow, 'createLock', ['999999999999999999999', '604801'])).rejects.toRevert("revert VE: INVALID_VALUE");
    });

    it('revert if create lock with big time', async function () {
      let amount = '10000000000000000000000';
      await send(underlying, 'approve', [votingEscrow._address, amount]);

      await expect(send(votingEscrow, 'createLock', [amount, "9999999999999999999"])).rejects.toRevert("revert VE: UNLOCK_TIME_TOO_LATE");
    });

    it('revert if create lock with little time', async function () {
      let amount = '10000000000000000000000';
      await send(underlying, 'approve', [votingEscrow._address, amount]);

      await expect(send(votingEscrow, 'createLock', [amount, '604799'])).rejects.toRevert("revert VE: UNLOCK_TIME_TOO_EARLY");
    });

    it('successful create lock', async function () {
      let amount = '10000000000000000000000';
      await send(underlying, 'approve', [votingEscrow._address, amount]);
      let tx = await send(votingEscrow, 'createLock', [amount, maxDuration]);
      let block = await web3.eth.getBlock(tx.blockNumber);

      let timestampBN = new BigNumber(block.timestamp);
      let maxDurationBN = new BigNumber(maxDuration);
      let oneWeekInSecondsBN = new BigNumber(oneWeekInSeconds);

      const endTime = new BigNumber((timestampBN.plus(maxDurationBN)).dividedBy(oneWeekInSeconds)
          .decimalPlaces(0, BigNumber.ROUND_DOWN)).multipliedBy(oneWeekInSecondsBN);

      expect(await call(votingEscrow, 'supply')).toEqual(amount);
      expect(await call(ppie, 'balanceOf', [votingEscrow._address])).toEqual((amount/exchangeRate).toString());
      expect(await call(votingEscrow, 'getAmount', [root])).toEqual(amount);
      expect(await call(votingEscrow, 'getStartTime', [root])).toEqual((block.timestamp).toString());
      expect(await call(votingEscrow, 'getUnlockTime', [root])).toEqual(endTime.toString());

      expect(tx).toHaveLog('Deposit', {
        provider: root,
        value: amount,
        unlockTime: endTime.toString(),
        depositType: "1",
        ts: (block.timestamp).toString()
      });

      expect(tx).toHaveLog('Supply', {
        prevSupply: '0',
        supply: amount,
      });
    });

    it('revert if contract call create lock', async function () {
      let lockContract = await deploy('LockCreatorHarness');

      await expect(send(lockContract, 'create_lock', [votingEscrow._address])).rejects.toRevert("revert Smart contract depositors not allowed");
    });

    it('revert if user twice called create lock', async function () {
      let amount = '10000000000000000000000';
      await send(underlying, 'approve', [votingEscrow._address, amount]);
      await send(votingEscrow, 'createLock', [amount, maxDuration]);

      await expect(send(votingEscrow, 'createLock', [amount, maxDuration])).rejects.toRevert("revert VE: EXISTING_LOCK_FOUND");
    });
  });

  describe('Delegate test',  () =>  {
    it('successful create lock', async function () {
      let amount = '10000000000000000000000';
      await send(underlying, 'approve', [votingEscrow._address, amount], { from: root });
      await send(votingEscrow, 'createLock', [amount, maxDuration], { from: root });

      await send(votingEscrow, 'delegate', [accounts[0]], {from: root});
      await send(votingEscrow, 'delegate', [accounts[0]], {from: accounts[1]});

      const delegators = await call(votingEscrow, 'getDelegators', [accounts[0]]);

      await expect(delegators[0]).toEqual(root);
      await expect(delegators[1]).toEqual(accounts[1]);

      const firstDelegatee = await call(votingEscrow, 'getDelegate', [root]);

      await expect(firstDelegatee).toEqual(accounts[0]);

      const secondDelegatee = await call(votingEscrow, 'getDelegate', [accounts[1]]);

      await expect(secondDelegatee).toEqual(accounts[0]);
    });

    it('revert if delegate twice', async function () {
      let amount = '10000000000000000000000';
      await send(underlying, 'approve', [votingEscrow._address, amount], { from: root });
      await send(votingEscrow, 'createLock', [amount, maxDuration], { from: root });

      await send(votingEscrow, 'delegate', [accounts[0]]);
      await expect(send(votingEscrow, 'delegate', [accounts[0]])).rejects.toRevert("revert VE: Old delegator found");
    });

    it('revert if delegate twice', async function () {
      let amount = '10000000000000000000000';
      await send(underlying, 'approve', [votingEscrow._address, amount], { from: root });
      await send(votingEscrow, 'createLock', [amount, maxDuration], { from: root });

      await expect(send(votingEscrow, 'delegate', [constants.ZERO_ADDRESS])).rejects.toRevert("revert VE: delegatee must not be zero address");
    });

    it('succesful change delegate', async function () {
      let amount = '10000000000000000000000';
      await send(underlying, 'approve', [votingEscrow._address, amount], { from: root });
      await send(votingEscrow, 'createLock', [amount, maxDuration], { from: root });

      await send(votingEscrow, 'delegate', [accounts[0]], {from: root});

      await send(votingEscrow, 'changeDelegator', [accounts[1]], {from: root});

      const delegators = await call(votingEscrow, 'getDelegators',  [accounts[1]]);

      await expect(delegators[0]).toEqual(root);

      const delegatee = await call(votingEscrow, 'getDelegate', [root]);

      await expect(delegatee).toEqual(accounts[1]);
    });

    it('change delegate fail (without delegate)', async function () {
      let amount = '10000000000000000000000';
      await send(underlying, 'approve', [votingEscrow._address, amount], { from: root });
      await send(votingEscrow, 'createLock', [amount, maxDuration], { from: root });

      await expect(send(votingEscrow, 'changeDelegator', [accounts[1]], {from: root})).rejects.toRevert("revert VE: Old delegator is not found");
    });

    it('change delegate fail with zero address', async function () {
      let amount = '10000000000000000000000';
      await send(underlying, 'approve', [votingEscrow._address, amount], { from: root });
      await send(votingEscrow, 'createLock', [amount, maxDuration], { from: root });

      await send(votingEscrow, 'delegate', [accounts[0]], {from: root});

      await expect(send(votingEscrow, 'changeDelegator', [constants.ZERO_ADDRESS], {from: root})).rejects.toRevert("revert VE: delegatee must not be zero address");
    });

    it('succesful remove delegate', async function () {
      let amount = '10000000000000000000000';
      await send(underlying, 'approve', [votingEscrow._address, amount], { from: root });
      await send(votingEscrow, 'createLock', [amount, maxDuration], { from: root });

      await send(votingEscrow, 'delegate', [accounts[0]], {from: root});

      await send(votingEscrow, 'removeDelegator', {from: root});

      expect(await call(votingEscrow, 'delegateLength', [root])).toEqual('0');

    });

    it('remove delegate fail (without delegate)', async function () {
      let amount = '10000000000000000000000';
      await send(underlying, 'approve', [votingEscrow._address, amount], { from: root });
      await send(votingEscrow, 'createLock', [amount, maxDuration], { from: root });

      await expect(send(votingEscrow, 'removeDelegator', {from: root})).rejects.toRevert("revert VE: Old delegator is not found");
    });

    it('check votes after delegate', async function () {
      let amount = '10000000000000000000000';
      await send(underlying, 'transfer', [accounts[0], amount]);

      await send(underlying, 'approve', [votingEscrow._address, amount]);
      await send(underlying, 'approve', [votingEscrow._address, amount], {from: accounts[0]});
      
      await send(votingEscrow, 'createLock', [amount, '2000000'], {from: accounts[0]});
      await send(votingEscrow, 'createLock', [amount, '2000000']);

      const votes1 = await call(votingEscrow, 'balanceOf', [accounts[0]]);
      const votes2 = await call(votingEscrow, 'balanceOf', [root]);

      await send(votingEscrow, 'delegate', [accounts[0]], {from: root});
      let tx = await send(votingEscrow, 'delegate', [accounts[1]], {from: accounts[0]});

      await increaseTime(0);

      const startDelegatedVotes1 = await call(votingEscrow, 'getPriorVotes', [root, tx.blockNumber]);
      const startDelegatedVotes2 = await call(votingEscrow, 'getPriorVotes', [accounts[0], tx.blockNumber]);
      const startDelegatedVotes3 = await call(votingEscrow, 'getPriorVotes', [accounts[1], tx.blockNumber]);

      expect(startDelegatedVotes1.substring(0,12)).toEqual('0');
      expect(startDelegatedVotes2.substring(0,12)).toEqual(votes2.substring(0,12));
      expect(startDelegatedVotes3.substring(0,12)).toEqual(votes1.substring(0,12));
    });
  });

  describe('Admin tests', () => {
    it('check getAdmin function', async function () {
      const admin = await call(votingEscrow, 'getAdmin');

      expect(admin).toEqual(root);
    });

    it('should only be callable by admin (setMaxDuration)', async () => {
      await expect(
        send(votingEscrow, 'setMaxDuration', ['1'], { from: accounts[0] })
      ).rejects.toRevert("revert VE: Only admin");

      expect(await call(votingEscrow, 'maxDuration')).toEqual(maxDuration);
    });

    it('should only be callable by admin (setMinDuration)', async () => {
      await expect(
        send(votingEscrow, 'setMinDuration', ['1'], { from: accounts[0] })
      ).rejects.toRevert("revert VE: Only admin");

      expect(await call(votingEscrow, 'minDuration')).toEqual(minDuration);
    });

    it('should only be callable by admin (setMinLockAmount)', async () => {
      await expect(
        send(votingEscrow, 'setMinLockAmount', ['1'], { from: accounts[0] })
      ).rejects.toRevert("revert VE: Only admin");

      expect(await call(votingEscrow, 'minLockAmount')).toEqual(minLockAmount);
    });

    it('should emit event and check state (setMaxDuration)', async () => {
      let result = await send(votingEscrow, 'setMaxDuration', ['125798109'])
      let newMaxDurationContract = '125193600';
      expect(result).toHaveLog('NewMaxDuration', {
        oldMaxDuration: maxDuration,
        newMaxDuration: newMaxDurationContract,
      });

      expect(await call(votingEscrow, 'maxDuration')).toEqual(newMaxDurationContract);
    });

    it('should emit event and check state (setMinDuration)', async () => {
      let result = await send(votingEscrow, 'setMinDuration', ['12'])

      let newMinDurationContract = '0';
      expect(result).toHaveLog('NewMinDuration', {
        oldMinDuration: minDuration,
        newMinDuration: newMinDurationContract,
      });

      expect(await call(votingEscrow, 'minDuration')).toEqual(newMinDurationContract);
    });

    it('should emit event and check state (setMinLockAmount)', async () => {
      let newMinLockAmount = '1';
      let result = await send(votingEscrow, 'setMinLockAmount', [newMinLockAmount])

      expect(result).toHaveLog('NewMinLockAmount', {
          oldMinLockAmount: minLockAmount,
          newMinLockAmount: newMinLockAmount,
      });

      expect(await call(votingEscrow, 'minLockAmount')).toEqual(newMinLockAmount);
    });
  });

  describe('DepositFor test',  () =>  {
    it('revets if depositFor', async function () {
      let amount = '10000000000000000000000';

      await send(underlying, 'approve', [votingEscrow._address, amount]);
      await send(votingEscrow, 'createLock', [amount, "125798400"]);

      await expect(send(votingEscrow, 'depositFor', [root, '1'])).rejects.toRevert("revert VE: INVALID_VALUE");

      expect(await call(votingEscrow, 'getAmount', [root])).toEqual(amount);
    });

    it('reverts if depositFor user with empty lock', async function () {
      let amount = '10000000000000000000000';

      await expect(send(votingEscrow, 'depositFor', [root, amount])).rejects.toRevert("revert VE: LOCK_NOT_FOUND");

      expect(await call(votingEscrow, 'getAmount', [root])).toEqual('0');
    });

    it('reverts if depositFor user with expired lock', async function () {
      let amount = '10000000000000000000000';
      let lockTime = "125798400";
      await send(underlying, 'approve', [votingEscrow._address, amount]);
      await send(votingEscrow, 'createLock', [amount, lockTime]);

      await increaseTime(parseInt(lockTime));

      await expect(send(votingEscrow, 'depositFor', [root, amount])).rejects.toRevert("revert VE: LOCK_EXPIRED");

      expect(await call(votingEscrow, 'getAmount', [root])).toEqual(amount);
    });

    it('successfull depositFor', async function () {
      let amount = '10000000000000000000000';
      let totalAmount = '20000000000000000000000';
      let lockTime = '125798400';

      await send(underlying, 'approve', [votingEscrow._address, totalAmount]);
      let tx0 = await send(votingEscrow, 'createLock', [amount, lockTime]);

      let block0 = await web3.eth.getBlock(tx0.blockNumber);
      let timestampBN = new BigNumber(block0.timestamp);
      let lockTimeBN = new BigNumber(lockTime);
      let oneWeekInSecondsBN = new BigNumber(oneWeekInSeconds);
      const endTime = new BigNumber((timestampBN.plus(lockTimeBN)).dividedBy(oneWeekInSeconds)
          .decimalPlaces(0, BigNumber.ROUND_DOWN)).multipliedBy(oneWeekInSecondsBN);

      let tx = await send(votingEscrow, 'depositFor', [root, amount]);
      let block = await web3.eth.getBlock(tx.blockNumber);

      expect(tx).toHaveLog('Deposit', {
        provider: root,
        value: amount,
        unlockTime: endTime.toString(),
        depositType: "0",
        ts: (block.timestamp).toString()
      });
      expect(tx).toHaveLog('Supply', {
        prevSupply: amount,
        supply: totalAmount,
      });

      expect(await call(ppie, 'balanceOf', [votingEscrow._address])).toEqual((totalAmount/exchangeRate).toString());
      expect(await call(votingEscrow, 'getAmount', [root])).toEqual(totalAmount);
    });

    it('successfull depositFor from another user', async function () {
      let amount = '10000000000000000000000';
      let totalAmount = '20000000000000000000000';
      let lockTime = '125798400';

      await send(underlying, 'approve', [votingEscrow._address, amount]);
      await send(votingEscrow, 'createLock', [amount, lockTime]);

      await send(underlying, 'transfer', [accounts[0], amount]);
      await send(underlying, 'approve', [votingEscrow._address, amount], { from: accounts[0] });

      await send(votingEscrow, 'depositFor', [root, amount], { from: accounts[0] });

      expect(await call(votingEscrow, 'getAmount', [root])).toEqual(totalAmount);
      expect(await call(votingEscrow, 'getAmount', [accounts[0]])).toEqual('0');
    });

    it('successfull depositFor from contract', async function () {
      let amount = '10000000000000000000000';
      let totalAmount = '20000000000000000000000';
      let lockTime = '125798400';

      await send(underlying, 'approve', [votingEscrow._address, amount]);
      await send(votingEscrow, 'createLock', [amount, lockTime]);

      let lockContract = await deploy('LockCreatorHarness');
      await send(underlying, 'transfer', [lockContract._address, amount]);
      await send(lockContract, 'approve', [underlying._address, votingEscrow._address, amount]);
      await send(lockContract, 'deposit_for', [votingEscrow._address, root, amount]);

      expect(await call(votingEscrow, 'getAmount', [root])).toEqual(totalAmount);
      expect(await call(underlying, 'balanceOf', [lockContract._address])).toEqual('0');
    });
  });

  describe('IncreaseUnlockTime tests',  () =>  {
    it('reverts IncreaseUnlockTime - empty lock', async function () {
      let lockTime = "125798400";

      await expect(send(votingEscrow, 'increaseUnlockTime', [lockTime])).rejects.toRevert("revert VE: LOCK_NOT_FOUND");
    });

    it('reverts IncreaseUnlockTime - lock expired', async function () {
      let amount = '10000000000000000000000';
      let lockTime = "125798400";

      await send(underlying, 'approve', [votingEscrow._address, amount]);
      await send(votingEscrow, 'createLock', [amount, lockTime]);

      increaseTime(parseInt(lockTime));

      await expect(send(votingEscrow, 'increaseUnlockTime', [lockTime])).rejects.toRevert("revert VE: LOCK_EXPIRED");

      expect(await call(votingEscrow, 'getAmount', [root])).toEqual(amount);
    });

    it('reverts IncreaseUnlockTime - small result time', async function () {
      let amount = '10000000000000000000000';
      let lockTime = "125798400";

      await send(underlying, 'approve', [votingEscrow._address, amount]);
      await send(votingEscrow, 'createLock', [amount, lockTime]);

      await expect(send(votingEscrow, 'increaseUnlockTime', ['1'])).rejects.toRevert("revert VE: UNLOCK_TIME_TOO_EARLY");
    });

    it('reverts IncreaseUnlockTime - too big result time', async function () {
      let amount = '10000000000000000000000';
      let lockTime = "125798400";

      await send(underlying, 'approve', [votingEscrow._address, amount]);
      await send(votingEscrow, 'createLock', [amount, lockTime]);

      await expect(send(votingEscrow, 'increaseUnlockTime', ['999999999999999'])).rejects.toRevert("revert VE: UNLOCK_TIME_TOO_LATE");
    });

    it('successfull create lock, increaseTime, check stats after', async function () {
      let amount = '10000000000000000000000';
      let lockTime = "1209600";

      await send(underlying, 'approve', [votingEscrow._address, amount]);
      let tx = await send(votingEscrow, 'createLock', [amount, lockTime]);

      let block = await web3.eth.getBlock(tx.blockNumber);
      let timestampBN = new BigNumber(block.timestamp);
      await send(votingEscrow, 'increaseUnlockTime', [lockTime]);

      let lockTimeBN = new BigNumber(lockTime);
      let unlockTime = new BigNumber(((lockTimeBN.multipliedBy(2)).plus(timestampBN)).dividedBy(10000000))
        .decimalPlaces(0, BigNumber.ROUND_DOWN);
      let unlockTimeReal = await call(votingEscrow, 'getUnlockTime', [root]);

      expect(parseInt(unlockTimeReal)).toBeGreaterThanOrEqual(parseInt(unlockTime));
      expect(unlockTimeReal.slice(0, 3)).toEqual(unlockTime.toString());
      expect(await call(votingEscrow, 'getAmount', [root])).toEqual(amount);
    });
  });

  describe('Whitelist test', () => {
    it('createLockFor', async function () {
      let lockContract = await deploy('LockCreatorHarness');

      await send(underlying, 'transfer', [lockContract._address, '10000000000000000000000']);

      expect(
        send(lockContract, 'create_lock_for', [user, votingEscrow._address, underlying._address])
      ).rejects.toRevert("revert Smart contract depositors not allowed");

      await send(votingEscrow, 'addWhiteList', [lockContract._address]);
      await send(lockContract, 'create_lock_for', [user, votingEscrow._address, underlying._address]);

      expect(await call(votingEscrow, 'supply')).toEqual('10000000000000000000000');

      await send(votingEscrow, 'removeWhiteList', [lockContract._address]);

      expect(
        send(lockContract, 'create_lock_for', [user, votingEscrow._address, underlying._address])
      ).rejects.toRevert("revert Smart contract depositors not allowed");
    });

    it('add whitelist (owner), check list', async function () {
      await send(votingEscrow, 'addWhiteList', [user]);

      expect(await call(votingEscrow, 'getWhiteListStatus', [user])).toEqual(true);
    });

    it('add whitelist (guardian), check list', async function () {
      await send(votingEscrow, 'addWhiteList', [user], { from: governor.guardian });

      expect(await call(votingEscrow, 'getWhiteListStatus', [user])).toEqual(true);
    });

    it('add whitelist (false)', async function () {
      expect(
        send(votingEscrow, 'addWhiteList', [user], { from: accounts[0] })
      ).rejects.toRevert("revert VE: Only admin or governance guardian");

      expect(await call(votingEscrow, 'getWhiteListStatus', [user])).toEqual(false);
    });

    it('remove from whitelist (owner), check list', async function () {
      await send(votingEscrow, 'addWhiteList', [user]);

      expect(await call(votingEscrow, 'getWhiteListStatus', [user])).toEqual(true);

      await send(votingEscrow, 'removeWhiteList', [user]);

      expect(await call(votingEscrow, 'getWhiteListStatus', [user])).toEqual(false);
    });

    it('remove from whitelist (governor), check list', async function () {
      await send(votingEscrow, 'addWhiteList', [user], { from: governor.guardian });

      expect(await call(votingEscrow, 'getWhiteListStatus', [user])).toEqual(true);

      await send(votingEscrow, 'removeWhiteList', [user], { from: governor.guardian });

      expect(await call(votingEscrow, 'getWhiteListStatus', [user])).toEqual(false);
    });

    it('remove from whitelist (false)', async function () {
      await send(votingEscrow, 'addWhiteList', [user]);

      expect(
        send(votingEscrow, 'removeWhiteList', [user], { from: accounts[0] })
      ).rejects.toRevert("revert VE: Only admin or governance guardian");

      expect(await call(votingEscrow, 'getWhiteListStatus', [user])).toEqual(true);
    });

    it('twice add to whitelist, check list', async function () {
      await send(votingEscrow, 'addWhiteList', [user]);

      expect(await call(votingEscrow, 'getWhiteListStatus', [user])).toEqual(true);

      await send(votingEscrow, 'addWhiteList', [user], { from: governor.guardian });

      expect(await call(votingEscrow, 'getWhiteListStatus', [user])).toEqual(true);
    });

    it('add to whitelist two contracts, check list, add create lockFor from contracts', async function () {
      let lockContract_a = await deploy('LockCreatorHarness');
      let lockContract_b = await deploy('LockCreatorHarness');

      await send(underlying, 'transfer', [lockContract_a._address, '10000000000000000000000']);
      await send(underlying, 'transfer', [lockContract_b._address, '10000000000000000000000']);

      await send(votingEscrow, 'addWhiteList', [lockContract_a._address]);
      await send(votingEscrow, 'addWhiteList', [lockContract_b._address]);

      expect(await call(votingEscrow, 'getWhiteListStatus', [lockContract_a._address])).toEqual(true);
      expect(await call(votingEscrow, 'getWhiteListStatus', [lockContract_b._address])).toEqual(true);

      await send(lockContract_a, 'create_lock_for', [user, votingEscrow._address, underlying._address]);
      await send(lockContract_b, 'create_lock_for', [accounts[0], votingEscrow._address, underlying._address]);

      expect(await call(votingEscrow, 'supply')).toEqual('20000000000000000000000');
    });
  });

  describe('Increase amount test', () => {
    it('increaseAmount (small amount), revert', async function () {
      let amount = '0';

      await expect(
        send(votingEscrow, 'increaseAmount', [amount])
      ).rejects.toRevert('revert VE: INVALID_VALUE');

      expect(await call(votingEscrow, 'getAmount', [root])).toEqual('0');
    });

    it('increaseAmount, but empty lock', async function () {
      let amount = '10000000000000000000000';

      await expect(
        send(votingEscrow, 'increaseAmount', [amount])
      ).rejects.toRevert('revert VE: LOCK_NOT_FOUND');

      expect(await call(votingEscrow, 'getAmount', [root])).toEqual('0');
    });

    it('increaseAmount, but empty expired', async function () {
      let amount = '10000000000000000000000';
      let lockTime = '125798400';

      await send(underlying, 'approve', [votingEscrow._address, amount]);
      await send(votingEscrow, 'createLock', [amount, lockTime]);

      await increaseTime(parseInt(lockTime));

      await expect(
        send(votingEscrow, 'increaseAmount', [amount])
      ).rejects.toRevert('revert VE: LOCK_EXPIRED');

      expect(await call(votingEscrow, 'getAmount', [root])).toEqual(amount);
    });

    it('add deposit for user from user, check lock', async function () {
      let amount = '10000000000000000000000';
      let totalAmount = '20000000000000000000000';
      let lockTime = '125798400';

      await send(underlying, 'transfer', [accounts[0], amount]);

      await send(underlying, 'approve', [votingEscrow._address, amount], { from: accounts[0] });
      await send(votingEscrow, 'createLock', [amount, lockTime], { from: accounts[0] });

      await send(underlying, 'transfer', [accounts[1], amount]);
      await send(underlying, 'approve', [votingEscrow._address, amount], { from: accounts[1] });

      await send(votingEscrow, 'depositFor', [accounts[0], amount], { from: accounts[1] });

      expect(await call(votingEscrow, 'getAmount', [accounts[0]])).toEqual(totalAmount);
      expect(await call(votingEscrow, 'getAmount', [accounts[1]])).toEqual('0');
      });
    });

    describe('Withdraw test',  () =>  {
      it('revert if lock not expired', async function () {
        let amount = '10000000000000000000000';
        await send(underlying, 'approve', [votingEscrow._address, amount]);

        await send(votingEscrow, 'createLock', [amount, maxDuration]);

        await expect(send(votingEscrow, 'withdraw')).rejects.toRevert('revert VE: LOCK_NOT_EXPIRED');
      });

      it('successfull withrdraw', async function () {
        let amount = '10000000000000000000000';
        await send(underlying, 'approve', [votingEscrow._address, amount]);

        await send(votingEscrow, 'createLock', [amount, '2000000']);

        await increaseTime(2000000);

        let tx = await send(votingEscrow, 'withdraw');
        let block = await web3.eth.getBlock(tx.blockNumber);

        expect(await call(ppie, "balanceOfUnderlying", [root])).toEqual(amount);

        expect(tx).toHaveLog('Withdraw', {
          provider: root,
          value: amount,
          ts: (block.timestamp).toString()
        });
        expect(tx).toHaveLog('Supply', {
          prevSupply: amount,
          supply: '0',
        });
      });

      it('successfull withrdraw and delegate', async function () {
        let amount = '10000000000000000000000';
        await send(underlying, 'transfer', [accounts[0], amount]);
        await send(underlying, 'transfer', [accounts[1], amount]);

        await send(underlying, 'approve', [votingEscrow._address, amount]);
        await send(underlying, 'approve', [votingEscrow._address, amount], {from: accounts[0]});
        await send(underlying, 'approve', [votingEscrow._address, amount], {from: accounts[1]});
        
        await send(votingEscrow, 'createLock', [amount, '2000000'], {from: accounts[0]});
        await send(votingEscrow, 'createLock', [amount, '2000000'], {from: accounts[1]});
        await send(votingEscrow, 'createLock', [amount, '2000000']);

        const votes1 = await call(votingEscrow, 'balanceOf', [accounts[0]]);
        const votes2 = await call(votingEscrow, 'balanceOf', [accounts[1]]);
        const votes3 = await call(votingEscrow, 'balanceOf', [root]);
        const sumVotes = (Number(votes1) + Number(votes2) + Number(votes3)).toString();

        await send(votingEscrow, 'delegate', [root], {from: accounts[0]});
        let tx = await send(votingEscrow, 'delegate', [root], {from: accounts[1]});

        await increaseTime(0);

        const startDelegatedVotes = await call(votingEscrow, 'getPriorVotes', [root, tx.blockNumber]);

        expect(startDelegatedVotes.substring(0,12)).toEqual(sumVotes.substring(0,12));

        await increaseTime(2000000);

        let txWithdraw = await send(votingEscrow, 'withdraw');

        await increaseTime(0);

        const endDelegatedVotes = await call(votingEscrow, 'getPriorVotes', [root, txWithdraw.blockNumber]);

        expect(endDelegatedVotes).toEqual('0');
      
        expect(await call(votingEscrow, 'delegateLength', [root])).toEqual('0');
      });
    });
  
    describe('IncreaseAmountFor test', () => {
      it('increaseAmountFor user (small amount), revert', async function () {
        let amount = '0';
  
        await expect(
          send(votingEscrow, 'increaseAmountFor', [accounts[0], amount])
        ).rejects.toRevert('revert VE: INVALID_VALUE');
  
        expect(await call(votingEscrow, 'getAmount', [root])).toEqual('0');
      });
  
      it('increaseAmountFor user, but empty lock', async function () {
        let amount = '10000000000000000000000';
  
        await expect(
          send(votingEscrow, 'increaseAmountFor', [accounts[0], amount])
        ).rejects.toRevert('revert VE: LOCK_NOT_FOUND');
  
        expect(await call(votingEscrow, 'getAmount', [root])).toEqual('0');
      });
  
      it('increaseAmountFor user, but lock expired', async function () {
        let amount = '10000000000000000000000';
        let lockTime = '125798400';
  
        await send(underlying, 'approve', [votingEscrow._address, amount]);
        await send(votingEscrow, 'createLock', [amount, lockTime]);
  
        await increaseTime(parseInt(lockTime));
  
        await expect(
          send(votingEscrow, 'increaseAmountFor', [accounts[0], amount])
        ).rejects.toRevert('revert VE: LOCK_EXPIRED');
  
        expect(await call(votingEscrow, 'getAmount', [root])).toEqual(amount);
      });
  
      it('increaseAmountFor user from user, check lock, check user balances', async function () {
        let amount = '20000000000000000000000';
        let halfAmount = '10000000000000000000000';
        let lockTime = '125798400';
  
        await send(underlying, 'transfer', [accounts[0], amount]);
  
        await send(underlying, 'approve', [votingEscrow._address, amount], { from: accounts[0] });
        await send(votingEscrow, 'createLock', [halfAmount, lockTime], { from: accounts[0] });
        await send(votingEscrow, 'depositFor', [accounts[0], halfAmount], { from: accounts[0] });
  
        expect(await call(ppie, 'balanceOf', [votingEscrow._address])).toEqual((amount/exchangeRate).toString());
        expect(await call(votingEscrow, 'getAmount', [accounts[0]])).toEqual(amount);
      });
  
      it('increaseAmountFor user from another user, check lock, check user balances', async function () {
        let amount = '20000000000000000000000';
        let halfAmount = '10000000000000000000000';
        let afterDepositFor = (BigInt(parseInt(amount) + parseInt(halfAmount))).toString();
        let totalAmount = '40000000000000000000000';
        let lockTime = '125798400';
  
        await send(underlying, 'transfer', [accounts[0], amount]);
  
        await send(underlying, 'approve', [votingEscrow._address, amount], { from: accounts[0] });
        await send(votingEscrow, 'createLock', [amount, lockTime], { from: accounts[0] });
  
        await send(underlying, 'transfer', [accounts[1], amount]);
  
        await send(underlying, 'approve', [votingEscrow._address, amount], { from: accounts[1] });
        await send(votingEscrow, 'createLock', [halfAmount, lockTime], { from: accounts[1] });
  
        await send(votingEscrow, 'depositFor', [accounts[0], halfAmount], { from: accounts[1] });
  
        expect(await call(ppie, 'balanceOf', [votingEscrow._address])).toEqual((totalAmount/exchangeRate).toString());
  
        expect(await call(votingEscrow, 'getAmount', [accounts[0]])).toEqual(afterDepositFor);
        expect(await call(votingEscrow, 'getAmount', [accounts[1]])).toEqual(halfAmount);
      });
    });
  });