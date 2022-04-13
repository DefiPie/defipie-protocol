const {
    increaseTime,
    blockNumber
} = require('./Utils/Ethereum');

const {
    makeToken,
    makeInterestRateModel,
    makeController,
    makePTokenFactory,
    makeRegistryProxy
} = require('./Utils/DeFiPie');
const {constants} = require("@openzeppelin/test-helpers");

describe('ExchangeRateStored attack test', () => {
    let root, admin, accounts;
    let oracle, registryProxy, controller, interestRateModel, pTokenFactory;
    let token;

    beforeEach(async () => {
        [root, admin, ...accounts] = saddle.accounts;

        oracle = await deploy('FixedPriceOracleV2');
        registryProxy = await makeRegistryProxy();
        controller = await makeController({priceOracle: oracle, registryProxy: registryProxy});
        interestRateModel = await makeInterestRateModel();

        pTokenFactory = await makePTokenFactory({
            registryProxy: registryProxy,
            controller: controller,
            interestRateModel: interestRateModel,
            priceOracle: oracle
        });
    });

    describe("Create simple tokens", () => {
        it("create token #1", async () => {
            // Flow
            // 1. create ptoken pusdt
            // 2. mint from user1 to pusdt
            // 3. redeem from user1 pusdt
            // 4. transfer usdt from user1 to pusdt
            // 5. mint from user2
            // 6. redeem from user1

            // 1. create ptoken pusdt and transfer tokens to user5 and user6
            let underlying = await makeToken({decimals: 6});
            let tx1_1 = await send(oracle, 'setPrice', [underlying._address, '1000000000000000000']);
            let tx1_2 = await send(oracle, 'setSearchPair', [underlying._address, '1000']);
            expect(tx1_1).toSucceed();
            expect(tx1_2).toSucceed();

            let tx1_3_0 = await send(underlying, 'approve', [pTokenFactory._address, "10000000"]);
            expect(tx1_3_0).toSucceed();
            let tx1_3 = await send(pTokenFactory, 'createPToken', [underlying._address]);
            expect(tx1_3).toSucceed();

            let pTokenAddress = tx1_3.events['PTokenCreated'].returnValues['newPToken'];
            expect(tx1_3).toSucceed();
            let tx1_4 = await send(oracle, 'setUnderlyingPrice', [pTokenAddress, '1000000000000000000']);
            expect(tx1_4).toSucceed();

            let tx1_5 = await send(underlying, 'transfer', [accounts[5], "2000000000000"]);
            expect(tx1_5).toSucceed();
            let tx1_6 = await send(underlying, 'transfer', [accounts[6], "1000000000000"]);
            expect(tx1_6).toSucceed();
            expect(await call(underlying, 'balanceOf', [accounts[5]])).toEqual("2000000000000");
            expect(await call(underlying, 'balanceOf', [accounts[6]])).toEqual("1000000000000");

            let pusdt = await saddle.getContractAt('PErc20DelegateHarness', pTokenAddress);
            expect(await call(pusdt, 'exchangeRateCurrent', [])).toEqual("10000000000000000");
            expect(await call(pusdt, 'totalSupply', [])).toEqual("0");

            // 2. mint token by user5
            // approve
            let tx2_1 = await send(underlying, 'approve', [pTokenAddress, "1000000000000000000000000000000000000"], {from: accounts[5]});
            expect(tx2_1).toSucceed();
            let amount = '1000000000000'; // 1,000,000e6
            let tx2_2 = await send(pusdt, 'mint', [amount], {from: accounts[5]});
            expect(tx2_2).toSucceed();

            expect(await call(pusdt, 'balanceOf', [accounts[5]])).toEqual("100000000000000");
            expect(await call(pusdt, 'exchangeRateCurrent', [])).toEqual("10000000000000000");
            expect(await call(pusdt, 'totalSupply', [])).toEqual("100000000000000");

            // 3. redeem tokens by user5
            let redeemAmount = '99999000000100';
            await expect(
                send(pusdt, 'redeem', [redeemAmount], {from: accounts[5]}),
            ).rejects.toRevert('revert PErc20::redeem: underlying balance less than the required balance');

            expect(await call(pusdt, 'calcUnderlyingAmountMin')).toEqual("10000000");

            redeemAmount = '99999000000099';
            let tx3_1 = await send(pusdt, 'redeem', [redeemAmount], {from: accounts[5]});
            expect(tx3_1).toSucceed();

            expect(await call(pusdt, 'balanceOf', [accounts[5]])).toEqual("999999901");
            expect(await call(pusdt, 'exchangeRateCurrent', [])).toEqual("10000000990000098");
            expect(await call(underlying, 'balanceOf', [pusdt._address])).toEqual("10000000");
            expect(await call(pusdt, 'totalSupply', [])).toEqual("999999901");

            // 4. send tokens to pusdt market
            let tx4_1 = await send(underlying, 'transfer', [pTokenAddress, "1000000000000"], {from: accounts[5]});
            expect(tx4_1).toSucceed();

            expect(await call(pusdt, 'exchangeRateCurrent', [])).toEqual("1000010099000999801098");
            expect(await call(pusdt, 'totalSupply', [])).toEqual("999999901");

            // 5. mint tokens by user 6
            let tx5_1 = await send(underlying, 'approve', [pTokenAddress, "1000000000000000000000000000000000000"], {from: accounts[6]});
            expect(tx5_1).toSucceed();
            let amountUser2 = '10000000'; // 10e6
            let tx5_2 = await send(pusdt, 'mint', [amountUser2], {from: accounts[6]});
            expect(tx5_2).toSucceed();

            expect(await call(pusdt, 'balanceOf', [accounts[6]])).toEqual("9999");
            expect(await call(pusdt, 'exchangeRateCurrent', [])).toEqual("1000010099900010989891");
            expect(await call(pusdt, 'totalSupply', [])).toEqual("1000009900");

            // 6. redeem by account 5
            expect(await call(pusdt, 'balanceOf', [accounts[5]])).toEqual("999999901");
            let redeem2 = '999999901';
            await expect(
                send(pusdt, 'redeem', [redeem2], {from: accounts[5]}),
            ).rejects.toRevert('revert PErc20::redeem: underlying balance less than the required balance');

            expect(await call(pusdt, 'calcUnderlyingAmountMin')).toEqual("10000000");

            redeem2 = '999999900';
            let tx6_1 = await send(pusdt, 'redeem', [redeem2], {from: accounts[5]});
            expect(tx6_1).toSucceed();

            expect(await call(underlying, 'balanceOf', [accounts[5]])).toEqual("1999999999899");

            expect(await call(pusdt, 'balanceOf', [accounts[6]])).toEqual("9999");
            await expect(
                send(pusdt, 'redeem', ['1'], {from: accounts[6]}),
            ).rejects.toRevert('revert PErc20::redeem: underlying balance less than the required balance');

            expect(await call(underlying, 'balanceOf', [accounts[6]])).toEqual("999990000000");
        });

        it("create token #2", async () => {
            // Flow
            // 1. create ptoken pwbtc
            // 2. mint from user1 to pwbtc
            // 3. redeem from user1 pwbtc
            // 4. transfer wbtc from user1 to pwbtc
            // 5. mint from user2
            // 6. redeem from user1

            // 1. create ptoken pwbtc and transfer tokens to user5 and user6
            let underlying = await makeToken({decimals: 8});
            let tx1_1 = await send(oracle, 'setPrice', [underlying._address, '1000000000000000000']);
            let tx1_2 = await send(oracle, 'setSearchPair', [underlying._address, '1000']);
            expect(tx1_1).toSucceed();
            expect(tx1_2).toSucceed();

            let tx1_3_0 = await send(underlying, 'approve', [pTokenFactory._address, "10000000"]);
            expect(tx1_3_0).toSucceed();
            let tx1_3 = await send(pTokenFactory, 'createPToken', [underlying._address]);
            expect(tx1_3).toSucceed();

            let pTokenAddress = tx1_3.events['PTokenCreated'].returnValues['newPToken'];
            expect(tx1_3).toSucceed();
            let tx1_4 = await send(oracle, 'setUnderlyingPrice', [pTokenAddress, '1000000000000000000']);
            expect(tx1_4).toSucceed();

            let tx1_5 = await send(underlying, 'transfer', [accounts[5], "200000000000"]);
            expect(tx1_5).toSucceed();
            let tx1_6 = await send(underlying, 'transfer', [accounts[6], "100000000000"]);
            expect(tx1_6).toSucceed();
            expect(await call(underlying, 'balanceOf', [accounts[5]])).toEqual("200000000000");
            expect(await call(underlying, 'balanceOf', [accounts[6]])).toEqual("100000000000");

            let pwbtc = await saddle.getContractAt('PErc20DelegateHarness', pTokenAddress);
            expect(await call(pwbtc, 'exchangeRateCurrent', [])).toEqual("1000000000000000000");
            expect(await call(pwbtc, 'totalSupply', [])).toEqual("0");

            // 2. mint token by user5
            // approve
            let tx2_1 = await send(underlying, 'approve', [pTokenAddress, "1000000000000000000000000000000000000"], {from: accounts[5]});
            expect(tx2_1).toSucceed();
            let amount = '1000000001';
            let tx2_2 = await send(pwbtc, 'mint', [amount], {from: accounts[5]});
            expect(tx2_2).toSucceed();

            expect(await call(pwbtc, 'balanceOf', [accounts[5]])).toEqual("1000000001");
            expect(await call(pwbtc, 'exchangeRateCurrent', [])).toEqual("1000000000000000000");
            expect(await call(pwbtc, 'totalSupply', [])).toEqual("1000000001");

            // 3. redeem tokens by user5
            let redeemAmount = '2';
            await expect(
                send(pwbtc, 'redeem', [redeemAmount], {from: accounts[5]}),
            ).rejects.toRevert('revert PErc20::redeem: underlying balance less than the required balance');

            redeemAmount = '1';
            let tx3_1 = await send(pwbtc, 'redeem', [redeemAmount], {from: accounts[5]});
            expect(tx3_1).toSucceed();

            expect(await call(pwbtc, 'balanceOf', [accounts[5]])).toEqual("1000000000");
            expect(await call(pwbtc, 'exchangeRateCurrent', [])).toEqual("1000000000000000000");
            expect(await call(underlying, 'balanceOf', [pwbtc._address])).toEqual("1000000000");
            expect(await call(pwbtc, 'totalSupply', [])).toEqual("1000000000");

            // 4. send tokens to pwbtc market
            let tx4_1 = await send(underlying, 'transfer', [pTokenAddress, "100000000"], {from: accounts[5]});
            expect(tx4_1).toSucceed();

            expect(await call(pwbtc, 'exchangeRateCurrent', [])).toEqual("1100000000000000000");
            expect(await call(pwbtc, 'totalSupply', [])).toEqual("1000000000");

            // 5. mint tokens by user 6
            let tx5_1 = await send(underlying, 'approve', [pTokenAddress, "1000000000000000000000000000000000000"], {from: accounts[6]});
            expect(tx5_1).toSucceed();
            let amountUser2 = '100000'; // 1e8
            let tx5_2 = await send(pwbtc, 'mint', [amountUser2], {from: accounts[6]});
            expect(tx5_2).toSucceed();

            expect(await call(pwbtc, 'balanceOf', [accounts[6]])).toEqual("90909");
            expect(await call(pwbtc, 'exchangeRateCurrent', [])).toEqual("1100000000099990909");
            expect(await call(pwbtc, 'totalSupply', [])).toEqual("1000090909");

            // 6. redeem by account 5
            expect(await call(underlying, 'balanceOf', [accounts[5]])).toEqual("198900000000");
            expect(await call(pwbtc, 'balanceOf', [accounts[5]])).toEqual("1000000000");
            expect(await call(underlying, 'balanceOf', [pwbtc._address])).toEqual("1100100000");
            let redeem2 = '91000001';
            await expect(
                send(pwbtc, 'redeem', [redeem2], {from: accounts[5]}),
            ).rejects.toRevert('revert PErc20::redeem: underlying balance less than the required balance');

            expect(await call(pwbtc, 'calcUnderlyingAmountMin')).toEqual("1000000000");

            redeem2 = '91000000';
            let tx6_1 = await send(pwbtc, 'redeem', [redeem2], {from: accounts[5]});
            expect(tx6_1).toSucceed();

            expect(await call(underlying, 'balanceOf', [accounts[5]])).toEqual("199000100000");

            expect(await call(pwbtc, 'balanceOf', [accounts[6]])).toEqual("90909");
            await expect(
                send(pwbtc, 'redeem', ['1'], {from: accounts[6]}),
            ).rejects.toRevert('revert PErc20::redeem: underlying balance less than the required balance');

            expect(await call(underlying, 'balanceOf', [accounts[6]])).toEqual("99999900000");
        });

        it("create token #3", async () => {
            // Flow
            // 1. create ptoken pdai
            // 2. mint from user1 to pdai
            // 3. redeem from user1 pdai
            // 4. transfer dai from user1 to pdai
            // 5. mint from user2
            // 6. redeem from user1

            // 1. create ptoken pdai and transfer tokens to user5 and user6
            let underlying = await makeToken({decimals: 18});
            let tx1_1 = await send(oracle, 'setPrice', [underlying._address, '1000000000000000000']);
            let tx1_2 = await send(oracle, 'setSearchPair', [underlying._address, '1000']);
            expect(tx1_1).toSucceed();
            expect(tx1_2).toSucceed();

            let tx1_3_0 = await send(underlying, 'approve', [pTokenFactory._address, "10000000"]);
            expect(tx1_3_0).toSucceed();
            let tx1_3 = await send(pTokenFactory, 'createPToken', [underlying._address]);
            expect(tx1_3).toSucceed();

            let pTokenAddress = tx1_3.events['PTokenCreated'].returnValues['newPToken'];
            expect(tx1_3).toSucceed();
            let tx1_4 = await send(oracle, 'setUnderlyingPrice', [pTokenAddress, '1000000000000000000']);
            expect(tx1_4).toSucceed();

            let tx1_5 = await send(underlying, 'transfer', [accounts[5], "2000000000000000000000000"]);
            expect(tx1_5).toSucceed();
            let tx1_6 = await send(underlying, 'transfer', [accounts[6], "1000000000000000000000000"]);
            expect(tx1_6).toSucceed();
            expect(await call(underlying, 'balanceOf', [accounts[5]])).toEqual("2000000000000000000000000");
            expect(await call(underlying, 'balanceOf', [accounts[6]])).toEqual("1000000000000000000000000");

            let pdai = await saddle.getContractAt('PErc20DelegateHarness', pTokenAddress);
            expect(await call(pdai, 'exchangeRateCurrent', [])).toEqual("10000000000000000000000000000");
            expect(await call(pdai, 'totalSupply', [])).toEqual("0");

            // 2. mint token by user5
            // approve
            let tx2_1 = await send(underlying, 'approve', [pTokenAddress, "1000000000000000000000000000000000000"], {from: accounts[5]});
            expect(tx2_1).toSucceed();
            let amount = '1000000000000000000000000'; // 1,000,000e18
            let tx2_2 = await send(pdai, 'mint', [amount], {from: accounts[5]});
            expect(tx2_2).toSucceed();

            expect(await call(pdai, 'balanceOf', [accounts[5]])).toEqual("100000000000000");
            expect(await call(pdai, 'exchangeRateCurrent', [])).toEqual("10000000000000000000000000000");
            expect(await call(pdai, 'totalSupply', [])).toEqual("100000000000000");

            // 3. redeem tokens by user5
            let redeemAmount = '99999000000001';
            await expect(
                send(pdai, 'redeem', [redeemAmount], {from: accounts[5]}),
            ).rejects.toRevert('revert PErc20::redeem: underlying balance less than the required balance');

            redeemAmount = '99999000000000';
            let tx3_1 = await send(pdai, 'redeem', [redeemAmount], {from: accounts[5]});
            expect(tx3_1).toSucceed();

            expect(await call(pdai, 'balanceOf', [accounts[5]])).toEqual("1000000000");
            expect(await call(pdai, 'exchangeRateCurrent', [])).toEqual("10000000000000000000000000000");
            expect(await call(underlying, 'balanceOf', [pdai._address])).toEqual("10000000000000000000");
            expect(await call(pdai, 'totalSupply', [])).toEqual("1000000000");

            // 4. send tokens to pdai market
            let tx4_1 = await send(underlying, 'transfer', [pTokenAddress, "1000000000000000000000000"], {from: accounts[5]});
            expect(tx4_1).toSucceed();

            expect(await call(pdai, 'exchangeRateCurrent', [])).toEqual("1000010000000000000000000000000000");
            expect(await call(pdai, 'totalSupply', [])).toEqual("1000000000");

            // 5. mint tokens by user 6
            let tx5_1 = await send(underlying, 'approve', [pTokenAddress, "1000000000000000000000000000000000000"], {from: accounts[6]});
            expect(tx5_1).toSucceed();
            let amountUser2 = '1000000000000000000000000'; // 1,000,000e18
            let tx5_2 = await send(pdai, 'mint', [amountUser2], {from: accounts[6]});
            expect(tx5_2).toSucceed();

            expect(await call(pdai, 'balanceOf', [accounts[6]])).toEqual("999990000");
            expect(await call(pdai, 'exchangeRateCurrent', [])).toEqual("1000010000050000250001250006250031");
            expect(await call(pdai, 'totalSupply', [])).toEqual("1999990000");

            // 6. redeem by account 5
            expect(await call(pdai, 'balanceOf', [accounts[5]])).toEqual("1000000000");
            let redeem2 = '1000000000'; // 1
            let tx6_1 = await send(pdai, 'redeem', [redeem2], {from: accounts[5]});
            expect(tx6_1).toSucceed();

            expect(await call(underlying, 'balanceOf', [accounts[5]])).toEqual("2000000000050000250001250");

            expect(await call(pdai, 'balanceOf', [accounts[6]])).toEqual("999990000");
            await expect(
                send(pdai, 'redeem', ['999980001'], {from: accounts[6]}),
            ).rejects.toRevert('revert PErc20::redeem: underlying balance less than the required balance');

            let tx6_2 = await send(pdai, 'redeem', ['999980000'], {from: accounts[6]});
            expect(tx6_2).toSucceed();

            expect(await call(underlying, 'balanceOf', [accounts[6]])).toEqual("999989999849999249996249");
        });
    });
});