const {
    etherUnsigned,
    etherMantissa,
    etherExp,
} = require('./Utils/Ethereum');

const {
    makeController,
    makePToken,
    preApprove,
    preSupply,
    quickRedeem,
} = require('./Utils/DeFiPie');

async function pieBalance(controller, user) {
    return etherUnsigned(await call(controller.pie, 'balanceOf', [user]))
}

async function pieAccrued(controller, user) {
    return etherUnsigned(await call(controller, 'pieAccrued', [user]));
}

async function fastForwardPatch(patch, controller, blocks) {
    if (patch == 'unitroller') {
        return await send(controller, 'harnessFastForward', [blocks]);
    } else {
        return await send(controller, 'fastForward', [blocks]);
    }
}

const fs = require('fs');
const util = require('util');
const diffStringsUnified = require('jest-diff').default;


async function preRedeem(
    pToken,
    redeemer,
    redeemTokens,
    redeemAmount,
    exchangeRate
) {
    await preSupply(pToken, redeemer, redeemTokens);
    await send(pToken.underlying, 'harnessSetBalance', [
        pToken._address,
        redeemAmount
    ]);
}

const sortOpcodes = (opcodesMap) => {
    return Object.values(opcodesMap)
        .map(elem => [elem.fee, elem.name])
        .sort((a, b) => b[0] - a[0]);
};

const getGasCostFile = name => {
    try {
        const jsonString = fs.readFileSync(name);
        return JSON.parse(jsonString);
    } catch (err) {
        console.log(err);
        return {};
    }
};

const recordGasCost = (totalFee, key, filename, opcodes = {}) => {
    let fileObj = getGasCostFile(filename);
    const newCost = {fee: totalFee, opcodes: opcodes};
    console.log(diffStringsUnified(fileObj[key], newCost));
    fileObj[key] = newCost;
    fs.writeFileSync(filename, JSON.stringify(fileObj, null, ' '), 'utf-8');
};

async function mint(pToken, minter, mintAmount, exchangeRate) {
    expect(await preApprove(pToken, minter, mintAmount, {})).toSucceed();
    return send(pToken, 'mint', [mintAmount], { from: minter });
}

async function claimComp(controller, holder) {
    return send(controller, 'claimComp', [holder], { from: holder });
}

/// GAS PROFILER: saves a digest of the gas prices of common PToken operations
/// transiently fails, not sure why

describe('Gas report', () => {
    let root, minter, redeemer, accounts, pToken;
    const exchangeRate = 50e3;
    const preMintAmount = etherUnsigned(30e4);
    const mintAmount = etherUnsigned(10e4);
    const mintTokens = mintAmount.div(exchangeRate);
    const redeemTokens = etherUnsigned(10e3);
    const redeemAmount = redeemTokens.multipliedBy(exchangeRate);
    const filename = './gasCosts.json';

    describe('PToken', () => {
        beforeEach(async () => {
            [root, minter, redeemer, ...accounts] = saddle.accounts;
            pToken = await makePToken({
                controllerOpts: { kind: 'bool'},
                interestRateModelOpts: { kind: 'white-paper'},
                exchangeRate
            });
        });

        it('first mint', async () => {
            await send(pToken, 'harnessSetAccrualBlockNumber', [40]);
            await send(pToken, 'harnessSetBlockNumber', [41]);

            const trxReceipt = await mint(pToken, minter, mintAmount, exchangeRate);
            recordGasCost(trxReceipt.gasUsed, 'first mint', filename);
        });

        it('second mint', async () => {
            await mint(pToken, minter, mintAmount, exchangeRate);

            await send(pToken, 'harnessSetAccrualBlockNumber', [40]);
            await send(pToken, 'harnessSetBlockNumber', [41]);

            const mint2Receipt = await mint(pToken, minter, mintAmount, exchangeRate);
            expect(Object.keys(mint2Receipt.events)).toEqual(['AccrueInterest', 'Transfer', 'Mint']);

            console.log(mint2Receipt.gasUsed);
            const opcodeCount = {};

            await saddle.trace(mint2Receipt, {
                execLog: log => {
                    if (log.lastLog != undefined) {
                        const key = `${log.op} @ ${log.gasCost}`;
                        opcodeCount[key] = (opcodeCount[key] || 0) + 1;
                    }
                }
            });

            recordGasCost(mint2Receipt.gasUsed, 'second mint', filename, opcodeCount);
        });

        it('second mint, no interest accrued', async () => {
            await mint(pToken, minter, mintAmount, exchangeRate);

            await send(pToken, 'harnessSetAccrualBlockNumber', [40]);
            await send(pToken, 'harnessSetBlockNumber', [40]);

            const mint2Receipt = await mint(pToken, minter, mintAmount, exchangeRate);
            expect(Object.keys(mint2Receipt.events)).toEqual(['Transfer', 'Mint']);
            recordGasCost(mint2Receipt.gasUsed, 'second mint, no interest accrued', filename);

            // console.log("NO ACCRUED");
            // const opcodeCount = {};
            // await saddle.trace(mint2Receipt, {
            //   execLog: log => {
            //     opcodeCount[log.op] = (opcodeCount[log.op] || 0) + 1;
            //   }
            // });
            // console.log(getOpcodeDigest(opcodeCount));
        });

        it('redeem', async () => {
            await preRedeem(pToken, redeemer, redeemTokens, redeemAmount, exchangeRate);
            const trxReceipt = await quickRedeem(pToken, redeemer, redeemTokens);
            recordGasCost(trxReceipt.gasUsed, 'redeem', filename);
        });

        it.skip('print mint opcode list', async () => {
            await preMint(pToken, minter, mintAmount, mintTokens, exchangeRate);
            const trxReceipt = await quickMint(pToken, minter, mintAmount);
            const opcodeCount = {};
            await saddle.trace(trxReceipt, {
                execLog: log => {
                    opcodeCount[log.op] = (opcodeCount[log.op] || 0) + 1;
                }
            });
            console.log(getOpcodeDigest(opcodeCount));
        });
    });

    describe.each([
        ['unitroller-g4'],
        ['unitroller']
    ])('Pie claims %s', (patch) => {
        beforeEach(async () => {
            [root, minter, redeemer, ...accounts] = saddle.accounts;
            controller = await makeController({ kind: patch });
            let interestRateModelOpts = {borrowRate: 0.000001};
            pToken = await makePToken({controller, supportMarket: true, underlyingPrice: 2, interestRateModelOpts});
            if (patch == 'unitroller') {
                await send(controller, '_setPieSpeed', [pToken._address, etherExp(0.05)]);
            } else {
                await send(controller, '_addPieMarkets', [[pToken].map(c => c._address)]);
                await send(controller, 'setPieSpeed', [pToken._address, etherExp(0.05)]);
            }
            await send(controller.pie, 'transfer', [controller._address, etherUnsigned(50e18)], {from: root});
        });

        it(`${patch} second mint with pie accrued`, async () => {
            await mint(pToken, minter, mintAmount, exchangeRate);

            await fastForwardPatch(patch, controller, 10);

            console.log('Pie balance before mint', (await pieBalance(controller, minter)).toString());
            console.log('Pie accrued before mint', (await pieAccrued(controller, minter)).toString());
            const mint2Receipt = await mint(pToken, minter, mintAmount, exchangeRate);
            console.log('Pie balance after mint', (await pieBalance(controller, minter)).toString());
            console.log('Pie accrued after mint', (await pieAccrued(controller, minter)).toString());
            recordGasCost(mint2Receipt.gasUsed, `${patch} second mint with pie accrued`, filename);
        });

        it(`${patch} claim pie`, async () => {
            await mint(pToken, minter, mintAmount, exchangeRate);

            await fastForwardPatch(patch, controller, 10);

            console.log('Pie balance before claim', (await pieBalance(controller, minter)).toString());
            console.log('Pie accrued before claim', (await pieAccrued(controller, minter)).toString());
            const claimReceipt = await claimPie(controller, minter);
            console.log('Pie balance after claim', (await pieBalance(controller, minter)).toString());
            console.log('Pie accrued after claim', (await pieAccrued(controller, minter)).toString());
            recordGasCost(claimReceipt.gasUsed, `${patch} claim pie`, filename);
        });
    });
});