const {
    increaseTime,
    blockNumber
} = require('../Utils/Ethereum');

const {
    makeToken,
    makeInterestRateModel,
    makeController,
    makePTokenFactory,
    makeRegistryProxy
} = require('../Utils/DeFiPie');

describe('Fee Token tests', () => {
    let root, admin, accounts;
    let pTokenFactory, oracle, registryProxy;
    let controller, interestRateModel, closeFactor, liquidationIncentive;

    beforeEach(async () => {
        [root, admin, ...accounts] = saddle.accounts;

        oracle = await deploy('FixedPriceOracleV2');
        registryProxy = await makeRegistryProxy();
        controller = await makeController({priceOracle: oracle, registryProxy: registryProxy});

        closeFactor = '500000000000000000';
        liquidationIncentive = '1100000000000000000';

        let tx01 = await send(controller, '_setCloseFactor', [closeFactor]);
        expect(tx01).toSucceed();
        let tx02 = await send(controller, '_setLiquidationIncentive', [liquidationIncentive]);
        expect(tx02).toSucceed();

        interestRateModel = await makeInterestRateModel();

        pTokenFactory = await makePTokenFactory({
            registryProxy: registryProxy,
            controller: controller,
            interestRateModel: interestRateModel,
            priceOracle: oracle
        });
    });

    describe("Borrow", () => {
        it("simple borrow", async () => {
            let borrowDelay = 86400;
            let mintToken = await makeToken();
            let borrowToken = await makeToken();

            let tx1 = await send(oracle, 'setPrice', [mintToken._address, '1000000000000000000']); // $1
            let tx2 = await send(oracle, 'setSearchPair', [mintToken._address, '1000']);
            expect(tx1).toSucceed();
            expect(tx2).toSucceed();

            let tx3 = await send(oracle, 'setPrice', [borrowToken._address, '25000000000000000000']); // $25
            let tx4 = await send(oracle, 'setSearchPair', [borrowToken._address, '1000']);
            expect(tx3).toSucceed();
            expect(tx4).toSucceed();

            let tx5 = await send(pTokenFactory, 'createPToken', [mintToken._address]);
            let pTokenAddress = tx5.events['PTokenCreated'].returnValues['newPToken'];
            expect(tx5).toSucceed();

            let block = await web3.eth.getBlock(await blockNumber());
            let startBorrowTimestamp = +block.timestamp + +borrowDelay;
            expect(tx5).toHaveLog('PTokenCreated', {
                newPToken: pTokenAddress,
                startBorrowTimestamp: startBorrowTimestamp
            });

            let tx6 = await send(pTokenFactory, 'createPToken', [borrowToken._address]);
            let pBorrowTokenAddress = tx6.events['PTokenCreated'].returnValues['newPToken'];
            expect(tx6).toSucceed();

            block = await web3.eth.getBlock(await blockNumber());
            startBorrowTimestamp = +block.timestamp + +borrowDelay;
            expect(tx6).toHaveLog('PTokenCreated', {
                newPToken: pBorrowTokenAddress,
                startBorrowTimestamp: startBorrowTimestamp
            });

            let tx7 = await send(oracle, 'setUnderlyingPrice', [pTokenAddress, '1000000000000000000']); // $1
            expect(tx7).toSucceed();
            let tx8 = await send(controller, '_setCollateralFactor', [pTokenAddress, '750000000000000000']); // 75%
            expect(tx8).toSucceed();
            let tx9 = await send(oracle, 'setUnderlyingPrice', [pBorrowTokenAddress, '1000000000000000000']); // $1
            expect(tx9).toSucceed();

            // Check data
            // 1. User0 mint and approve simple token to pToken
            // 2. User0 mint simple pToken
            // 3. User1 mint and approve fee token to pBorrowToken
            // 4. User1 mint pBorrowToken

            // 1. User0 mint and approve simple token to pToken
            let tx10 = await send(mintToken, 'harnessSetBalance', [accounts[0], "1000000000000000000000"], {from: accounts[0]}); // $1000
            let tx11 = await send(mintToken, 'approve', [pTokenAddress, "1000000000000000000000000000000000000"], {from: accounts[0]});
            expect(tx10).toSucceed();
            expect(tx11).toSucceed();

            // 2. User0 mint simple pToken (deposit is $1000)
            let pTokenSimple = await saddle.getContractAt('PErc20DelegateHarness', pTokenAddress);
            let amount = '1000000000000000000000'; // $1000 = 1000e18
            let tx12 = await send(pTokenSimple, 'mint', [amount], {from: accounts[0]});
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

            // Get Borrow
            // 1. User0 enter markets simple pToken and pBorrowToken
            // 2. User0 borrow pBorrowToken token (collateral simple pToken)

            // 1. User0 enter markets simple pToken and pBorrowToken
            let markets = [pBorrowTokenAddress, pTokenAddress];
            let tx16 = await send(controller, 'enterMarkets', [markets], {from: accounts[0]});
            expect(tx16).toSucceed();

            // 3. User0 borrow pBorrowToken token (collateral simple pToken)
            // try borrow with under max amount
            let borrowAmount = '57692307692307692307'; //10% borrow
            await expect(
                send(pBorrowToken, 'borrow', [borrowAmount], {from: accounts[0]})
            ).rejects.toRevert('revert PErc20::borrow: borrow is not started');

            block = await web3.eth.getBlock(await blockNumber());

            // borrowDelay default is 86400;
            let currentBorrowDelay = startBorrowTimestamp - +block.timestamp;
            await increaseTime(currentBorrowDelay - 1);

            await expect(
                send(pBorrowToken, 'borrow', [borrowAmount], {from: accounts[0]})
            ).rejects.toRevert('revert PErc20::borrow: borrow is not started');

            await increaseTime(1);

            let tx18 = await send(pBorrowToken, 'borrow', [borrowAmount], {from: accounts[0]});
            expect(tx18).toSucceed();

            await increaseTime(1);

            let tx19 = await send(pBorrowToken, 'borrow', [borrowAmount], {from: accounts[0]});
            expect(tx19).toSucceed();
        });
    });
});