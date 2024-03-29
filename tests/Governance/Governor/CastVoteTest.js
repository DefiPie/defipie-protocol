const {
    address,
    etherMantissa,
    encodeParameters,
    mineBlock,
    unlockedAccount,
    setTime
} = require('../../Utils/Ethereum');
const EIP712 = require('../../Utils/EIP712');
const BigNumber = require('bignumber.js');

const {
    makePToken,
    makeVotingEscrow,
    makeRegistryProxy
} = require('../../Utils/DeFiPie');

async function enfranchise(pie, votingEscrow, actor, amount, duration) {
    await send(pie, 'transfer', [actor, amount]);
    await send(pie, 'approve', [votingEscrow._address, amount], {from: actor});
    await send(votingEscrow, 'createLock', [amount, duration], {from: actor});
}

describe("governor#castVote/2", () => {
    let pie, ppie, registryAddress, gov, root, a1, accounts, period;
    let targets, values, signatures, callDatas, proposalId;
    let amount = '8000000000000000000000000';
    let maxDuration = '125798400';
    let registryProxy, votingEscrow;

    beforeAll(async () => {
        [root, a1, ...accounts] = saddle.accounts;

        registryProxy = await makeRegistryProxy();
        registryAddress = registryProxy._address;
        ppie = await makePToken({registryProxy: registryProxy, kind: 'ppie', exchangeRate: 1});
        pie = ppie.underlying;
        gov = await deploy('Governor', [address(0), registryAddress, root, '19710']);
        votingEscrow = await makeVotingEscrow({token: pie, registryProxy: registryProxy, governor: gov._address});
        await send(gov, 'setVotingEscrow', [votingEscrow._address]);

        targets = [a1];
        values = ["0"];
        signatures = ["getBalanceOf(address)"];
        callDatas = [encodeParameters(['address'], [a1])];

        await send(pie, 'approve', [votingEscrow._address, amount]);
        await send(pie, 'transfer', [accounts[4], amount]);
        await send(votingEscrow, 'createLock', [amount, maxDuration]);

        await send(gov, 'propose', [targets, values, signatures, callDatas, "do nothing"]);
        proposalId = await call(gov, 'latestProposalIds', [root]);
    });

    describe("We must revert if:", () => {
        it("There does not exist a proposal with matching proposal id where the current block number is between the proposal's start block (exclusive) and end block (inclusive)", async () => {
            await expect(
                call(gov, 'castVote', [proposalId, true])
            ).rejects.toRevert("revert Governor::_castVote: voting is closed");
        });

        it("Such proposal already has an entry in its voters set matching the sender", async () => {
            await mineBlock();
            await mineBlock();

            await send(gov, 'castVote', [proposalId, true], { from: accounts[4] });
            await expect(
                gov.methods['castVote'](proposalId, true).call({ from: accounts[4] })
            ).rejects.toRevert("revert Governor::_castVote: voter already voted");
        });
    });

    describe("Otherwise", () => {
        it("we add the sender to the proposal's voters set", async () => {
            await expect(call(gov, 'getReceipt', [proposalId, accounts[2]])).resolves.toPartEqual({hasVoted: false});
            await send(gov, 'castVote', [proposalId, true], { from: accounts[2] });
            await expect(call(gov, 'getReceipt', [proposalId, accounts[2]])).resolves.toPartEqual({hasVoted: true});
        });

        describe("and we take the balance returned by GetPriorVotes for the given sender and the proposal's start block, which may be zero,", () => {
            let actor; // an account that will propose, receive tokens, delegate to self, and vote on own proposal

            it("and we add that ForVotes", async () => {
                actor = accounts[1];
                await enfranchise(pie, votingEscrow, actor, amount, maxDuration);

                await send(gov, 'propose', [targets, values, signatures, callDatas, "do nothing"], { from: actor });
                proposalId = await call(gov, 'latestProposalIds', [actor]);

                let beforeFors = (await call(gov, 'proposals', [proposalId])).forVotes;
                await mineBlock();
                let tx = await send(gov, 'castVote', [proposalId, true], { from: actor });
                let votesAmount = tx.events['VoteCast']['returnValues'].votes;

                let afterFors = (await call(gov, 'proposals', [proposalId])).forVotes;
                expect(new BigNumber(afterFors)).toEqual(new BigNumber(beforeFors).plus(votesAmount));
            });

            it("or AgainstVotes corresponding to the caller's support flag.", async () => {
                actor = accounts[3];
                await enfranchise(pie, votingEscrow, actor, amount, maxDuration);

                await send(gov, 'propose', [targets, values, signatures, callDatas, "do nothing"], { from: actor });
                proposalId = await call(gov, 'latestProposalIds', [actor]);

                let beforeAgainsts = (await call(gov, 'proposals', [proposalId])).againstVotes;
                await mineBlock();
                let tx = await send(gov, 'castVote', [proposalId, false], { from: actor });
                let votesAmount = tx.events['VoteCast']['returnValues'].votes;

                let afterAgainsts = (await call(gov, 'proposals', [proposalId])).againstVotes;
                expect(new BigNumber(afterAgainsts)).toEqual(new BigNumber(beforeAgainsts).plus(votesAmount));
            });
        });

        describe('castVoteBySig', () => {
            const Domain = (gov) => ({
                name: 'DeFiPie Governor',
                chainId: 1, // await web3.eth.net.getId(); See: https://github.com/trufflesuite/ganache-core/issues/515
                verifyingContract: gov._address
            });
            const Types = {
                Ballot: [
                    { name: 'proposalId', type: 'uint256' },
                    { name: 'support', type: 'bool' }
                ]
            };

            it('reverts if the signatory is invalid', async () => {
                await expect(send(gov, 'castVoteBySig', [proposalId, false, 0, '0xbad', '0xbad'])).rejects.toRevert("revert Governor::castVoteBySig: invalid signature");
            });

            it('casts vote on behalf of the signatory', async () => {
                await enfranchise(pie, votingEscrow, a1, amount, maxDuration);
                await send(gov, 'propose', [targets, values, signatures, callDatas, "do nothing"], { from: a1 });
                proposalId = await call(gov, 'latestProposalIds', [a1]);

                const { v, r, s } = EIP712.sign(Domain(gov), 'Ballot', { proposalId, support: true }, Types, unlockedAccount(a1).secretKey);

                let beforeFors = (await call(gov, 'proposals', [proposalId])).forVotes;
                await mineBlock();
                const tx = await send(gov, 'castVoteBySig', [proposalId, true, v, r, s]);
                expect(tx.gasUsed < 80000);
                let votesAmount = tx.events['VoteCast']['returnValues'].votes;

                let afterFors = (await call(gov, 'proposals', [proposalId])).forVotes;
                expect(new BigNumber(afterFors)).toEqual((new BigNumber(beforeFors).plus(votesAmount)));
            });
        });

        it("receipt uses one load", async () => {
            let actor1 = accounts[4];
            let actor2 = accounts[5];
            await enfranchise(pie, votingEscrow, actor1, amount, maxDuration);
            await enfranchise(pie, votingEscrow, actor2, amount, maxDuration);
            await send(gov, 'propose', [targets, values, signatures, callDatas, "do nothing"], { from: actor1 });
            proposalId = await call(gov, 'latestProposalIds', [actor1]);

            await mineBlock();
            await mineBlock();
            let tx1 = await send(gov, 'castVote', [proposalId, true], { from: actor1 });
            let tx2 = await send(gov, 'castVote', [proposalId, false], { from: actor2 });
            let votesAmountActor1 = new BigNumber(tx1.events['VoteCast']['returnValues'].votes);
            let votesAmountActor2 = new BigNumber(tx2.events['VoteCast']['returnValues'].votes);

            let trxReceipt = await send(gov, 'getReceipt', [proposalId, actor1]);
            let trxReceipt2 = await send(gov, 'getReceipt', [proposalId, actor2]);

            await saddle.trace(trxReceipt, {
                constants: {
                    "account": actor1
                },
                preFilter: ({op}) => op === 'SLOAD',
                postFilter: ({source}) => !source || source.includes('receipts'),
                execLog: (log) => {
                    let [output] = log.outputs;
                    let prefix = "000000000000000000000000000000000000000";
                    let votes = votesAmountActor1.toString(16);
                    let voted = "01";
                    let support = "01";

                    expect(output).toEqual(
                        `${prefix}${votes}${support}${voted}`
                    );
                },
                exec: (logs) => {
                    expect(logs.length).toEqual(1); // require only one read
                }
            });

            await saddle.trace(trxReceipt2, {
                constants: {
                    "account": actor2
                },
                preFilter: ({op}) => op === 'SLOAD',
                postFilter: ({source}) => !source || source.includes('receipts'),
                execLog: (log) => {
                    let [output] = log.outputs;
                    let prefix = "000000000000000000000000000000000000000";
                    let votes = votesAmountActor2.toString(16);
                    let voted = "01";
                    let support = "00";

                    expect(output).toEqual(
                        `${prefix}${votes}${support}${voted}`
                    );
                }
            });
        });
    });
});