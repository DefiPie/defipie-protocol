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
    setTime
} = require('../Utils/Ethereum');
const BigNumber = require('bignumber.js');
  
describe('Voting Escrow', () => {
  const name = 'VEPie';
  const symbol = 'VE';

  let root, guardian, user, accounts;
  let governor;
  let registryProxy, ppie, underlying, votingEscrow;
  let minLockAmount, minDuration, maxDuration;
  let oneWeekInSeconds, yearInSec, twoYearsInSec;

  beforeEach(async () => {
    [root, guardian, user, ...accounts] = saddle.accounts;
    await setTime(10);

    maxDuration = '125798400';
    minDuration = '2419200';
    yearInSec = '31449600';
    twoYearsInSec = '62899200';
    minLockAmount = '10000000000000000';
    oneWeekInSeconds = '604800';

    registryProxy = await makeRegistryProxy();
    ppie = await makePToken({registryProxy: registryProxy, kind: 'ppie'});
    underlying = ppie.underlying;

    governor = await deploy('Governor', [address(0), registryProxy._address, guardian, '19710']);
    votingEscrow = await makeVotingEscrow({token: underlying, registryProxy: registryProxy, governor: governor._address, minLockAmount: minLockAmount});
  });

  describe('checkpoint test', () => {
    let amount = '1000000000000000000000';
    let amount2 = '2000000000000000000000';
    let amount3 = '4000000000000000000000';
    let rootPriorVotes, rootPriorVotes2, rootPriorVotes3;

    beforeEach(async () => {
      await send(underlying, 'transfer', [accounts[0], amount2]);
      await send(underlying, 'transfer', [accounts[1], amount3]);

      await send(underlying, 'approve', [votingEscrow._address, amount]);
      await send(underlying, 'approve', [votingEscrow._address, amount2], {from: accounts[0]});
      await send(underlying, 'approve', [votingEscrow._address, amount3], {from: accounts[1]});
    });

    it('max Time', async function () {
      await send(votingEscrow, 'createLock', [amount, maxDuration]);
      await send(votingEscrow, 'createLock', [amount2, twoYearsInSec], {from: accounts[0]});
      let txLock = await send(votingEscrow, 'createLock', [amount3, yearInSec], {from: accounts[1]});

      await increaseTime(0);

      rootPriorVotes = await call(votingEscrow, 'getPriorVotes', [root, txLock.blockNumber]);
      rootPriorVotes2 = await call(votingEscrow, 'getPriorVotes', [accounts[0], txLock.blockNumber]);
      rootPriorVotes3 = await call(votingEscrow, 'getPriorVotes', [accounts[1], txLock.blockNumber]);

      expect(rootPriorVotes.substring(0,6)).toEqual(rootPriorVotes2.substring(0,6));
      expect(rootPriorVotes.substring(0,6)).toEqual(rootPriorVotes3.substring(0,6));
    });
  });
});
     