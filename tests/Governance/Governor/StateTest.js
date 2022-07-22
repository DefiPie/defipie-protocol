const {
  advanceBlocks,
  etherUnsigned,
  both,
  encodeParameters,
  etherMantissa,
  mineBlock,
  freezeTime,
  increaseTime,
  blockNumber,
  setTime
} = require('../../Utils/Ethereum');
const BigNumber = require('bignumber.js');

const {
    makePToken,
    makeRegistryProxy,
    makeVotingEscrow
} = require('../../Utils/DeFiPie');

const statesInverted = [
    'Pending',   'Active',
    'Canceled',  'Defeated',
    'Succeeded', 'Queued',
    'Expired',   'Executed'
];

const states = Object.entries(statesInverted).reduce((obj, [key, value]) => ({ ...obj, [value]: key }), {});

describe('Governor#state/1', () => {
  let pie, ppie, registryAddress, gov, root, acct, delay, timelock, proposalId, period;
  let amount = '8000000000000000000000000';
  let maxDuration = '125798400';
  
  beforeAll(async () => {
    await setTime(10);
    await freezeTime(100);
    [root, acct, ...accounts] = accounts;

    delay = etherUnsigned(2 * 24 * 60 * 60).multipliedBy(2);
    timelock = await deploy('TimelockHarness', [root, delay]);
    registryProxy = await makeRegistryProxy();
    registryAddress = registryProxy._address;
    ppie = await makePToken({registryProxy: registryProxy, kind: 'ppie', exchangeRate: 1});
    pie = ppie.underlying;
    gov = await deploy('Governor', [timelock._address, registryAddress, root, '19710']);
    votingEscrow = await makeVotingEscrow({token: pie, registryProxy: registryProxy, governor: gov._address});
    await send(gov, 'setVotingEscrow', [votingEscrow._address]);
    await send(timelock, "harnessSetAdmin", [gov._address]);

    await send(pie, 'transfer', [acct, amount]);
    await send(pie, 'approve', [votingEscrow._address, amount], {from: acct});
    await send(votingEscrow, 'createLock', [amount, maxDuration], {from: acct});
  });

  let trivialProposal, targets, values, signatures, callDatas;

  beforeAll(async () => {
    targets = [root];
    values = ["0"];
    signatures = ["getBalanceOf(address)"];
    callDatas = [encodeParameters(['address'], [acct])];

    await send(pie, 'approve', [votingEscrow._address, amount]);
    await send(votingEscrow, 'createLock', [amount, maxDuration]);

    await send(gov, 'propose', [targets, values, signatures, callDatas, "do nothing"]);
    proposalId = await call(gov, 'latestProposalIds', [root]);
    trivialProposal = await call(gov, "proposals", [proposalId]);
  });

  describe("state tests", () => {
    it("Invalid for proposal not found", async () => {
      await expect(call(gov, 'state', ["5"])).rejects.toRevert("revert Governor::state: invalid proposal id")
    });

    it("Pending", async () => {
      expect(await call(gov, 'state', [trivialProposal.id], {})).toEqual(states["Pending"]);
    });

    it("Active", async () => {
      await mineBlock();
      await mineBlock();
      expect(await call(gov, 'state', [trivialProposal.id], {})).toEqual(states["Active"]);
    });

    it("Canceled", async () => {
      await send(pie, 'transfer', [accounts[0], amount]);
      await send(pie, 'approve', [votingEscrow._address, amount], {from: accounts[0]});
      await send(votingEscrow, 'createLock', [amount, maxDuration], {from: accounts[0]});

      await mineBlock();
      await send(gov, 'propose', [targets, values, signatures, callDatas, "do nothing"], { from: accounts[0] });
      let newProposalId = await call(gov, 'proposalCount');

      // send away the delegates
      await send(votingEscrow, 'delegate', [root], { from: accounts[0] });
      await send(gov, 'cancel', [newProposalId]);

      expect(await call(gov, 'state', [+newProposalId])).toEqual(states["Canceled"]);
    });

    it("Defeated", async () => {
      // travel to end block
      await advanceBlocks(20000);

      expect(await call(gov, 'state', [trivialProposal.id])).toEqual(states["Defeated"]);
    });

    it("Succeeded", async () => {
      await mineBlock();
      const { reply: newProposalId } = await both(gov, 'propose', [targets, values, signatures, callDatas, "do nothing"], { from: acct });
      await mineBlock();
      await send(gov, 'castVote', [newProposalId, true], {from: acct});
      await advanceBlocks(20000);

      expect(await call(gov, 'state', [newProposalId])).toEqual(states["Succeeded"]);
    });

    it("Queued", async () => {
      await mineBlock();
      const { reply: newProposalId } = await both(gov, 'propose', [targets, values, signatures, callDatas, "do nothing"], { from: acct });
      await mineBlock();
      await send(gov, 'castVote', [newProposalId, true], {from: acct});
      await advanceBlocks(20000);

      await send(gov, 'queue', [newProposalId], { from: acct });
      expect(await call(gov, 'state', [newProposalId])).toEqual(states["Queued"]);
    });

    it("Expired", async () => {
      await mineBlock();
      const { reply: newProposalId } = await both(gov, 'propose', [targets, values, signatures, callDatas, "do nothing"], { from: acct });
      await mineBlock();
      await send(gov, 'castVote', [newProposalId, true], {from: acct});
      await advanceBlocks(20000);

      await increaseTime(1);
      await send(gov, 'queue', [newProposalId], { from: acct });

      let gracePeriod = await call(timelock, 'GRACE_PERIOD');
      let p = await call(gov, "proposals", [newProposalId]);
      let eta = etherUnsigned(p.eta);

      await freezeTime(eta.plus(gracePeriod).minus(1).toNumber());

      expect(await call(gov, 'state', [newProposalId])).toEqual(states["Queued"]);

      await freezeTime(eta.plus(gracePeriod).toNumber());

      expect(await call(gov, 'state', [newProposalId])).toEqual(states["Expired"]);
    });

    it("Executed", async () => {
      await mineBlock();
      const { reply: newProposalId } = await both(gov, 'propose', [targets, values, signatures, callDatas, "do nothing"], { from: acct });
      await mineBlock();
      await send(gov, 'castVote', [newProposalId, true], {from: acct});
      await advanceBlocks(20000);

      await increaseTime(1);
      await send(gov, 'queue', [newProposalId], { from: acct });

      let gracePeriod = await call(timelock, 'GRACE_PERIOD');
      let p = await call(gov, "proposals", [newProposalId]);
      let eta = etherUnsigned(p.eta);

      await freezeTime(eta.plus(gracePeriod).minus(1).toNumber());

      expect(await call(gov, 'state', [newProposalId])).toEqual(states["Queued"]);
      await send(gov, 'execute', [newProposalId], { from: acct });

      expect(await call(gov, 'state', [newProposalId])).toEqual(states["Executed"]);

      // still executed even though would be expired
      await freezeTime(eta.plus(gracePeriod).toNumber());

      expect(await call(gov, 'state', [newProposalId])).toEqual(states["Executed"]);
    });
  });
});
