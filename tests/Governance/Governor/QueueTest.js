const {
  both,
  etherMantissa,
  encodeParameters,
  advanceBlocks,
  freezeTime,
  mineBlock
} = require('../../Utils/Ethereum');

const {
    makePToken,
    makeRegistryProxy,
    makeVotingEscrow
} = require('../../Utils/DeFiPie');

async function enfranchise(pie, votingEscrow, actor, amount, duration) {
  await send(pie, 'transfer', [actor, amount]);
  await send(pie, 'approve', [votingEscrow._address, amount], {from: actor});
  await send(votingEscrow, 'createLock', [amount, duration], {from: actor});
}

describe('Governor#queue/1', () => {
  let root, a1, a2, accounts;
  beforeAll(async () => {
    [root, a1, a2, ...accounts] = saddle.accounts;
  });

  describe("overlapping actions", () => {
    it("reverts on queueing overlapping actions in same proposal", async () => {
      let amount = '8000000000000000000000000';
      let maxDuration = '125798400';

      const timelock = await deploy('TimelockHarness', [root, 86400 * 2]);
      registryProxy = await makeRegistryProxy();
      registryAddress = registryProxy._address;
      ppie = await makePToken({registryProxy: registryProxy, kind: 'ppie', exchangeRate: 1});
      pie = ppie.underlying;
      gov = await deploy('Governor', [timelock._address, registryAddress, root, '19710']);
      const txAdmin = await send(timelock, 'harnessSetAdmin', [gov._address]);
      votingEscrow = await makeVotingEscrow({token: pie, registryProxy: registryProxy, governor: gov._address});
      await send(gov, 'setVotingEscrow', [votingEscrow._address]);

      await enfranchise(pie, votingEscrow, a1, amount, maxDuration);
      await mineBlock();

      const targets = [pie._address, pie._address];
      const values = ["0", "0"];
      const signatures = ["getBalanceOf(address)", "getBalanceOf(address)"];
      const calldatas = [encodeParameters(['address'], [root]), encodeParameters(['address'], [root])];
      const {reply: proposalId1} = await both(gov, 'propose', [targets, values, signatures, calldatas, "do nothing"], {from: a1});
      await mineBlock();

      const txVote1 = await send(gov, 'castVote', [proposalId1, true], {from: a1});
      await advanceBlocks(20000);

      await expect(
        send(gov, 'queue', [proposalId1])
      ).rejects.toRevert("revert Governor::_queueOrRevert: proposal action already queued at eta");
    });

    it("reverts on queueing overlapping actions in different proposals, works if waiting", async () => {
      let amount = '8000000000000000000000000';
      let maxDuration = '125798400';

      const timelock = await deploy('TimelockHarness', [root, 86400 * 2]);
      registryProxy = await makeRegistryProxy();
      registryAddress = registryProxy._address;
      ppie = await makePToken({registryProxy: registryProxy, kind: 'ppie', exchangeRate: 1});
      pie = ppie.underlying;
      gov = await deploy('Governor', [timelock._address, registryAddress, root, '19710']);
      const txAdmin = await send(timelock, 'harnessSetAdmin', [gov._address]);
      votingEscrow = await makeVotingEscrow({token: pie, registryProxy: registryProxy, governor: gov._address});
      await send(gov, 'setVotingEscrow', [votingEscrow._address]);

      await enfranchise(pie, votingEscrow, a1, amount, maxDuration);
      await enfranchise(pie, votingEscrow, a2, amount, maxDuration);

      await mineBlock();

      const targets = [pie._address];
      const values = ["0"];
      const signatures = ["getBalanceOf(address)"];
      const calldatas = [encodeParameters(['address'], [root])];
      const {reply: proposalId1} = await both(gov, 'propose', [targets, values, signatures, calldatas, "do nothing"], {from: a1});
      const {reply: proposalId2} = await both(gov, 'propose', [targets, values, signatures, calldatas, "do nothing"], {from: a2});
      await mineBlock();

      const txVote1 = await send(gov, 'castVote', [proposalId1, true], {from: a1});
      const txVote2 = await send(gov, 'castVote', [proposalId2, true], {from: a2});
      await advanceBlocks(20000);
      await freezeTime(100);

      const txQueue1 = await send(gov, 'queue', [proposalId1]);
      await expect(
        send(gov, 'queue', [proposalId2])
      ).rejects.toRevert("revert Governor::_queueOrRevert: proposal action already queued at eta");

      await freezeTime(101);
      const txQueue2 = await send(gov, 'queue', [proposalId2]);
    });
  });
});
