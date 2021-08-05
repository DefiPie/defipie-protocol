const {
  advanceBlocks,
  etherUnsigned,
  both,
  encodeParameters,
  etherMantissa,
  mineBlock,
  freezeTime,
  increaseTime
} = require('../../Utils/Ethereum');

const {
    makePToken
} = require('../../Utils/DeFiPie');

const statesInverted = [
    'Pending',   'Active',
    'Canceled',  'Defeated',
    'Succeeded', 'Queued',
    'Expired',   'Executed'
];

const states = Object.entries(statesInverted).reduce((obj, [key, value]) => ({ ...obj, [value]: key }), {});

describe('Governor#state/1', () => {
  let pie, ppie, registryAddress, gov, root, acct, delay, timelock, proposalId;
  let threshold = etherMantissa(15000001);
  let quorum = etherMantissa(150000001);

  beforeAll(async () => {
    await freezeTime(100);
    [root, acct, ...accounts] = accounts;
    pie = await deploy('Pie', [root]);
    delay = etherUnsigned(2 * 24 * 60 * 60).multipliedBy(2);
    timelock = await deploy('TimelockHarness', [root, delay]);
    ppie = await makePToken({ kind: 'ppie', underlying: pie, exchangeRate: 1});
    registryAddress = await call(ppie, 'registry');
    gov = await deploy('Governor', [timelock._address, registryAddress, root]);
    await send(timelock, "harnessSetAdmin", [gov._address]);

    await send(pie, 'transfer', [acct, quorum]);
    await send(pie, 'approve', [ppie._address, threshold]);
    await send(ppie, 'mint', [threshold]);

    await send(pie, 'approve', [ppie._address, quorum], {from: acct});
    await send(ppie, 'mint', [quorum], {from: acct});
    await send(ppie, 'delegate', [acct], { from: acct });
  });

  let trivialProposal, targets, values, signatures, callDatas;

  beforeAll(async () => {
    targets = [root];
    values = ["0"];
    signatures = ["getBalanceOf(address)"];
    callDatas = [encodeParameters(['address'], [acct])];
    await send(ppie, 'delegate', [root]);
    await send(gov, 'propose', [targets, values, signatures, callDatas, "do nothing"]);
    proposalId = await call(gov, 'latestProposalIds', [root]);
    trivialProposal = await call(gov, "proposals", [proposalId]);
  });

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
    await send(pie, 'transfer', [accounts[0], threshold]);
    await send(pie, 'approve', [ppie._address, threshold], {from: accounts[0]});
    await send(ppie, 'mint', [threshold], {from: accounts[0]});
    await send(ppie, 'delegate', [accounts[0]], { from: accounts[0] });

    await mineBlock();
    await send(gov, 'propose', [targets, values, signatures, callDatas, "do nothing"], { from: accounts[0] });
    let newProposalId = await call(gov, 'proposalCount');

    // send away the delegates
    await send(ppie, 'delegate', [root], { from: accounts[0] });
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