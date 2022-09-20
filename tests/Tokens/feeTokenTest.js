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
const bn = require('bignumber.js');

describe('Fee Token tests', () => {
    let root, admin, accounts;
    let pTokenFactory, oracle, registryProxy;
    let controller, interestRateModel, closeFactor, liquidationIncentive;
    let borrowDelay = 86400;

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

    describe("Liquidation", () => {
        it("simple liquidation", async () => {
            let simpleToken = await makeToken(); // BUSD
            let feeToken = await makeToken({kind: 'fee', basisPointFee: '1000'});  // fee = 10%

            let tx1 = await send(oracle, 'setPrice', [simpleToken._address, '1000000000000000000']); // $1
            let tx2 = await send(oracle, 'setSearchPair', [simpleToken._address, '1000']);
            expect(tx1).toSucceed();
            expect(tx2).toSucceed();

            let tx3 = await send(oracle, 'setPrice', [feeToken._address, '25000000000000000000']); // $25
            let tx4 = await send(oracle, 'setSearchPair', [feeToken._address, '1000']);
            expect(tx3).toSucceed();
            expect(tx4).toSucceed();

            let tx5 = await send(pTokenFactory, 'createPToken', [simpleToken._address]);
            let pTokenAddress = tx5.events['PTokenCreated'].returnValues['newPToken'];
            expect(tx5).toSucceed();

            let block = await web3.eth.getBlock(await blockNumber());
            let startBorrowTimestamp = +block.timestamp + +borrowDelay;
            expect(tx5).toHaveLog('PTokenCreated', {newPToken: pTokenAddress, startBorrowTimestamp: startBorrowTimestamp});

            let tx6 = await send(pTokenFactory, 'createPToken', [feeToken._address]);
            let pFeeTokenAddress = tx6.events['PTokenCreated'].returnValues['newPToken'];
            expect(tx6).toSucceed();

            block = await web3.eth.getBlock(await blockNumber());
            startBorrowTimestamp = +block.timestamp + +borrowDelay;
            expect(tx6).toHaveLog('PTokenCreated', {newPToken: pFeeTokenAddress, startBorrowTimestamp: startBorrowTimestamp});

            let tx7 = await send(oracle, 'setUnderlyingPrice', [pTokenAddress, '1000000000000000000']); // $1
            expect(tx7).toSucceed();
            let tx8 = await send(controller, '_setCollateralFactor', [pTokenAddress, '750000000000000000']); // 75%
            expect(tx8).toSucceed();
            let tx9 = await send(oracle, 'setUnderlyingPrice', [pFeeTokenAddress, '1000000000000000000']); // $1
            expect(tx9).toSucceed();

            // Check data
            // 1. User0 mint and approve simple token to pToken
            // 2. User0 mint simple pToken
            // 3. Check feeFactorMantissa for simple pToken is 0
            // 4. User1 mint and approve fee token to pFeeToken
            // 5. User1 mint pFeeToken
            // 6. Check feeFactorMantissa for pFeeToken is 0.1e18

            // 1. User0 mint and approve simple token to pToken
            let tx10 = await send(simpleToken, 'harnessSetBalance', [accounts[0], "1000000000000000000000"], { from: accounts[0] }); // $1000
            let tx11 = await send(simpleToken, 'approve', [pTokenAddress, "1000000000000000000000000000000000000"], { from: accounts[0] });
            expect(tx10).toSucceed();
            expect(tx11).toSucceed();

            // 2. User0 mint simple pToken (deposit is $1000)
            let pTokenSimple = await saddle.getContractAt('PErc20DelegateHarness', pTokenAddress);
            let amount = '1000000000000000000000'; // $1000 = 1000e18
            let tx12 = await send(pTokenSimple, 'mint', [amount], { from: accounts[0] });
            expect(tx12).toSucceed();

            // 3. Check feeFactorMantissa for simple pToken is 0
            let pTokenFeeFactor = await call(controller, "feeFactorMantissa", [pTokenSimple._address]);
            expect(pTokenFeeFactor).toEqual('0');

            // 4. User1 mint and approve fee token to pFeeToken
            let tx13 = await send(feeToken, 'allocateTo', [accounts[1], "1000000000000000000000"], { from: accounts[1] }); // $1000
            let tx14 = await send(feeToken, 'approve', [pFeeTokenAddress, "1000000000000000000000000000000000000"], { from: accounts[1] });
            expect(tx13).toSucceed();
            expect(tx14).toSucceed();

            // 5. User1 mint pFeeToken
            let pFeeToken = await saddle.getContractAt('PErc20DelegateHarness', pFeeTokenAddress);
            amount = '1000000000000000000000'; // $1000 = 1000e18
            let tx15 = await send(pFeeToken, 'mint', [amount], { from: accounts[1] });
            expect(tx15).toSucceed();

            // 6. Check feeFactorMantissa for pFeeToken is 0.1e18
            let pFeeTokenFeeFactor = await call(controller, "feeFactorMantissa", [pFeeToken._address]);
            expect(pFeeTokenFeeFactor).toEqual('100000000000000000');

            // Get Borrow
            // 1. User0 enter markets simple pToken and pFeeToken
            // 2. Check User0 getAccountLiquidity
            // 3. User0 borrow pFeeToken token (collateral simple pToken)
            // 4. Check User0 getAccountLiquidity

            // 1. User0 enter markets simple pToken and pFeeToken
            let markets = [pFeeTokenAddress, pTokenAddress];
            let tx16 = await send(controller, 'enterMarkets', [markets], { from: accounts[0] });
            expect(tx16).toSucceed();

            // 2. Check User0 getAccountLiquidity
            let accBeforeLiquidity = await call(controller, "getAccountLiquidity", [accounts[0]]);
            expect(accBeforeLiquidity).toEqual({"0": "0", "1": "750000000000000000000", "2": "0"}); // collateral is $750

            // 3. User0 borrow pFeeToken token (collateral simple pToken)
            // try borrow with under max amount
            await increaseTime(borrowDelay);
            let borrowAmount = '576923076923076923078'; // max amount is $576,92 (750 / 1.3)
            let tx17 = await send(pFeeToken, 'borrow', [borrowAmount], { from: accounts[0] });
            expect(tx17).toHaveLog('Failure', {
                error: 3,
                info: 11,
                detail: 4
            });

            borrowAmount = '576923076923076923077'; // max amount is $576,92
            let tx18 = await send(pFeeToken, 'borrow', [borrowAmount], { from: accounts[0] });
            expect(tx18).toSucceed();

            // 4. Check User0 getAccountLiquidity
            let accLiquidityAfterBorrow = await call(controller, "getAccountLiquidity", [accounts[0]]);
            expect(accLiquidityAfterBorrow).toEqual({"0": "0", "1": "0", "2": "0"}); // $0

            // Change price and liquidate
            // 1. Change price feeToken (up)
            // 2. Check User1 getAccountLiquidity
            // 3. Allocate, approve and liquidate user0 by user3
            // 4. Check User0 getAccountLiquidity
            // 5. Second liquidate user0 by user3
            // 6. Check User0 getAccountLiquidity

            // 1. Change price feeToken (up)
            let tx19 = await send(oracle, 'setUnderlyingPrice', [pFeeTokenAddress, '1100000000000000000']); // $1,1
            expect(tx19).toSucceed();

            // check data
            let borrowAmountUser0 = await call(feeToken, "balanceOf", [accounts[0]]);
            let borrowAmountUser0BN = new bn(borrowAmountUser0);
            let sumBorrowUser0 = borrowAmountUser0BN.dividedBy('0.9').multipliedBy('1.3').multipliedBy('1.1'); // get 576,92, receive 519,22 thus 519,22/0.9 * 1,3 (feeAddition * 3) * 1,1 (price)
            expect(sumBorrowUser0.toFixed()).toEqual('825000000000000000001.2222222222222222222254'); // is 825

            // 2. Check User0 getAccountLiquidity
            let accLiquidityBeforeLiquidate = await call(controller, "getAccountLiquidity", [accounts[0]]);
            expect(accLiquidityBeforeLiquidate).toEqual({"0": "0", "1": "0", "2": "75000000000000000000"}); // $75 (825(sumBorrow) - 750(liquidity))

            let balanceSimplePToken = await call(pTokenSimple, "balanceOf", [accounts[0]]);
            let balanceSimplePTokenBN = new bn(balanceSimplePToken);
            let sumCollateral = balanceSimplePTokenBN.multipliedBy(1e18).multipliedBy(0.75).dividedBy(1e8); // 1e18 is normalize, 1e8 is pToken decimals, 0.75 is collateralFactor, $750
            let loan = sumBorrowUser0.dividedBy(sumCollateral);
            expect(loan.toFixed()).toEqual('1.1'); // is 110%

            // 3. Allocate, approve and liquidate user0 by user3
            let tx20 = await send(feeToken, 'allocateTo', [accounts[3], "1000000000000000000000"], { from: accounts[3] }); // $1000
            let tx21 = await send(feeToken, 'approve', [pFeeTokenAddress, "1000000000000000000000000000000000000"], { from: accounts[3] });
            expect(tx20).toSucceed();
            expect(tx21).toSucceed();

            // try liquidate with under max borrow amount
            let liquidateBorrowAmount0 = '288461538461538461539';
            let tx22 = await send(pFeeToken, 'liquidateBorrow', [accounts[0], liquidateBorrowAmount0, pTokenSimple._address], { from: accounts[3] });
            expect(tx22).toHaveLog('Failure', {
                error: 3,
                info: 15,
                detail: 17
            });

            let balanceCollateralTokenBeforeLiquidation = await call(pTokenSimple, 'balanceOf', [accounts[3]]);
            expect(balanceCollateralTokenBeforeLiquidation).toEqual('0');

            let liquidateBorrowAmount1 = '288461538461538461538';
            let tx23 = await send(pFeeToken, 'liquidateBorrow', [accounts[0], liquidateBorrowAmount1, pTokenSimple._address], { from: accounts[3] });
            expect(tx23).toSucceed();

            let balanceCollateralTokenAfterFirstLiquidation = await call(pTokenSimple, 'balanceOf', [accounts[3]]);
            expect(balanceCollateralTokenAfterFirstLiquidation).toEqual('38782051281');

            // 4. Check User0 getAccountLiquidity
            let accLiquidityAfterFirstLiquidate = await call(controller, "getAccountLiquidity", [accounts[0]]);
            expect(accLiquidityAfterFirstLiquidate).toEqual({"0": "0", "1": "5384615392500000001", "2": "0"}); //

            let borrowAmountBN = new bn(borrowAmount);
            let liquidateBorrowAmount1BN = new bn(liquidateBorrowAmount1);
            let sumBorrowUser0AfterLiquidation = borrowAmountBN.minus((liquidateBorrowAmount1BN.multipliedBy('0.9'))).multipliedBy('1.43'); // 1.1 * 1.3 (20% is feeAddition * 3)
            expect(sumBorrowUser0AfterLiquidation.toFixed()).toEqual('453750000000000000000.704');

            let balanceSimplePTokenAfterFirstLiquidationBN = new bn(await call(pTokenSimple, "balanceOf", [accounts[0]]));
            expect(balanceSimplePTokenAfterFirstLiquidationBN.toFixed()).toEqual('61217948719'); // deposit 612,17

            let sumCollateralAfterFirstLiquidation = balanceSimplePTokenAfterFirstLiquidationBN.multipliedBy(1e18).multipliedBy(0.75).dividedBy(1e8); // 1e18 is normalize, 1e8 is pToken decimals, 0.75 is collateralFactor, $434,9
            expect(sumCollateralAfterFirstLiquidation.toFixed()).toEqual('459134615392500000000'); // collateral 459,13

            let loanAfterFirstLiquidation = sumBorrowUser0AfterLiquidation.dividedBy(sumCollateralAfterFirstLiquidation);
            expect(loanAfterFirstLiquidation.toFixed()).toEqual('0.98827225129192914668'); // is 98,82%
        });
    });

    describe("Repay", () => {
        let simpleToken, feeToken, pFeeToken;

        beforeEach(async () => {
            simpleToken = await makeToken(); // BUSD
            feeToken = await makeToken({kind: 'fee', basisPointFee: '200'});  // fee = 2%

            let tx1 = await send(oracle, 'setPrice', [simpleToken._address, '1000000000000000000']); // $1
            let tx2 = await send(oracle, 'setSearchPair', [simpleToken._address, '1000']);
            expect(tx1).toSucceed();
            expect(tx2).toSucceed();

            let tx3 = await send(oracle, 'setPrice', [feeToken._address, '1000000000000000000']); // $1
            let tx4 = await send(oracle, 'setSearchPair', [feeToken._address, '1000']);
            expect(tx3).toSucceed();
            expect(tx4).toSucceed();

            let tx5 = await send(pTokenFactory, 'createPToken', [simpleToken._address]);
            let pTokenAddress = tx5.events['PTokenCreated'].returnValues['newPToken'];
            expect(tx5).toSucceed();

            let block = await web3.eth.getBlock(await blockNumber());
            let startBorrowTimestamp = +block.timestamp + +borrowDelay;
            expect(tx5).toHaveLog('PTokenCreated', {newPToken: pTokenAddress, startBorrowTimestamp: startBorrowTimestamp});

            let tx6 = await send(pTokenFactory, 'createPToken', [feeToken._address]);
            let pFeeTokenAddress = tx6.events['PTokenCreated'].returnValues['newPToken'];
            expect(tx6).toSucceed();

            block = await web3.eth.getBlock(await blockNumber());
            startBorrowTimestamp = +block.timestamp + +borrowDelay;
            expect(tx6).toHaveLog('PTokenCreated', {newPToken: pFeeTokenAddress, startBorrowTimestamp: startBorrowTimestamp});

            let tx7 = await send(oracle, 'setUnderlyingPrice', [pTokenAddress, '1000000000000000000']); // $1
            expect(tx7).toSucceed();
            let tx8 = await send(controller, '_setCollateralFactor', [pTokenAddress, '750000000000000000']); // 75%
            expect(tx8).toSucceed();
            let tx9 = await send(oracle, 'setUnderlyingPrice', [pFeeTokenAddress, '1000000000000000000']); // $1
            expect(tx9).toSucceed();

            // Check data
            // 1. User0 mint and approve simple token to pToken
            // 2. User0 mint simple pToken
            // 3. Check feeFactorMantissa for simple pToken is 0
            // 4. User1 mint and approve fee token to pFeeToken
            // 5. User1 mint pFeeToken
            // 6. Check feeFactorMantissa for pFeeToken is 0.02e18

            // 1. User0 mint and approve simple token to pToken
            let tx10 = await send(simpleToken, 'harnessSetBalance', [accounts[0], "1000000000000000000000"], { from: accounts[0] }); // $1000
            let tx11 = await send(simpleToken, 'approve', [pTokenAddress, "1000000000000000000000000000000000000"], { from: accounts[0] });
            expect(tx10).toSucceed();
            expect(tx11).toSucceed();

            // 2. User0 mint simple pToken (deposit is $1000)
            let pTokenSimple = await saddle.getContractAt('PErc20DelegateHarness', pTokenAddress);
            let amount = '1000000000000000000000'; // $1000 = 1000e18
            let tx12 = await send(pTokenSimple, 'mint', [amount], { from: accounts[0] });
            expect(tx12).toSucceed();

            // 3. Check feeFactorMantissa for simple pToken is 0
            let pTokenFeeFactor = await call(controller, "feeFactorMantissa", [pTokenSimple._address]);
            expect(pTokenFeeFactor).toEqual('0');

            // 4. User1 mint and approve fee token to pFeeToken
            let tx13 = await send(feeToken, 'allocateTo', [accounts[1], "1000000000000000000000"], { from: accounts[1] }); // $1000
            let tx14 = await send(feeToken, 'approve', [pFeeTokenAddress, "1000000000000000000000000000000000000"], { from: accounts[1] });
            expect(tx13).toSucceed();
            expect(tx14).toSucceed();

            // 5. User1 mint pFeeToken
            pFeeToken = await saddle.getContractAt('PErc20DelegateHarness', pFeeTokenAddress);
            amount = '1000000000000000000000'; // $1000 = 1000e18
            let tx15 = await send(pFeeToken, 'mint', [amount], { from: accounts[1] });
            expect(tx15).toSucceed();

            // 6. Check feeFactorMantissa for pFeeToken is 0.02e18
            let pFeeTokenFeeFactor = await call(controller, "feeFactorMantissa", [pFeeToken._address]);
            expect(pFeeTokenFeeFactor).toEqual('20000000000000000');

            // Get Borrow
            // 1. User0 enter markets simple pToken and pFeeToken
            // 2. Check User0 getAccountLiquidity
            // 3. User0 borrow pFeeToken token (collateral simple pToken)
            // 4. Check User0 getAccountLiquidity
            // 5. Mint and approve token for repay

            // 1. User0 enter markets simple pToken and pFeeToken
            let markets = [pFeeTokenAddress, pTokenAddress];
            let tx16 = await send(controller, 'enterMarkets', [markets], { from: accounts[0] });
            expect(tx16).toSucceed();

            // 2. Check User0 getAccountLiquidity
            let accBeforeLiquidity = await call(controller, "getAccountLiquidity", [accounts[0]]);
            expect(accBeforeLiquidity).toEqual({"0": "0", "1": "750000000000000000000", "2": "0"}); // collateral is $750

            // 3. User0 borrow pFeeToken token (collateral simple pToken)
            // try borrow with under max amount
            await increaseTime(borrowDelay);
            let borrowAmount = '707547169811320754718'; // max amount + 1
            let tx17 = await send(pFeeToken, 'borrow', [borrowAmount], { from: accounts[0] });
            expect(tx17).toHaveLog('Failure', {
                error: 3,
                info: 11,
                detail: 4
            });

            borrowAmount = '707547169811320754717'; // max amount
            let tx18 = await send(pFeeToken, 'borrow', [borrowAmount], { from: accounts[0] });
            expect(tx18).toSucceed();
            expect(tx18).toHaveLog('Borrow', {
                borrower: accounts[0],
                borrowAmount: '707547169811320754717',
                accountBorrows: '707547169811320754717',
                totalBorrows: '707547169811320754717'
            });

            // 4. Check User0 getAccountLiquidity
            // let accLiquidityAfterBorrow = await call(controller, "getAccountLiquidity", [accounts[0]]);
            // expect(accLiquidityAfterBorrow).toEqual({"0": "0", "1": "0", "2": "0"}); // $0

            // 5. Mint and approve token for repay
            let tx19 = await send(feeToken, 'allocateTo', [accounts[0], "1000000000000000000000"], { from: accounts[0] }); // $1000
            let tx20 = await send(feeToken, 'approve', [pFeeTokenAddress, "1000000000000000000000000000000000000"], { from: accounts[0] });
            expect(tx19).toSucceed();
            expect(tx20).toSucceed();
        });

        it("simple repay (less than accountBorrows)", async () => {
            let accLiquidityBeforeRepay = await call(controller, "getAccountLiquidity", [accounts[0]]);
            expect(accLiquidityBeforeRepay).toEqual({"0": "0", "1": "0", "2": "0"}); // $0

            let borrowBalanceStoredBeforeRepay = await call(pFeeToken, "borrowBalanceStored", [accounts[0]]);
            expect(borrowBalanceStoredBeforeRepay).toEqual("707547169811320754717");

            let repayAmount = '55';
            let tx18 = await send(pFeeToken, 'repayBorrow', [repayAmount], { from: accounts[0] });
            expect(tx18).toSucceed();
            expect(tx18).toHaveLog('RepayBorrow', {
                payer: accounts[0],
                borrower: accounts[0],
                repayAmount: 54,
                accountBorrows: '707547169811320754663',
                totalBorrows: '707547169811320754663'
            });

            let borrowBalanceStoredAfterRepay = await call(pFeeToken, "borrowBalanceStored", [accounts[0]]);
            expect(borrowBalanceStoredAfterRepay).toEqual("707547169811320754663");

            let pFeeTokenFeeFactor = await call(controller, "feeFactorMantissa", [pFeeToken._address]);
            expect(pFeeTokenFeeFactor).toEqual('20000000000000000');

            let accLiquidityAfterBorrow = await call(controller, "getAccountLiquidity", [accounts[0]]);
            expect(accLiquidityAfterBorrow).toEqual({"0": "0", "1": "58", "2": "0"}); // $0

            let borrowAmount = '55'; // max amount

            let tx19 = await send(pFeeToken, 'borrow', [borrowAmount], { from: accounts[0] });
            expect(tx19).toSucceed();
            expect(tx19).toHaveLog('Borrow', {
                borrower: accounts[0],
                borrowAmount: '55',
                accountBorrows: '707547169811320754718',
                totalBorrows: '707547169811320754718'
            });

            borrowBalanceStoredAfterRepay = await call(pFeeToken, "borrowBalanceStored", [accounts[0]]);
            expect(borrowBalanceStoredAfterRepay).toEqual("707547169811320754718");

            let accLiquidityAfterRepay = await call(controller, "getAccountLiquidity", [accounts[0]]);
            expect(accLiquidityAfterRepay).toEqual({"0": "0", "1": "0", "2": "1"}); // $0

            pFeeTokenFeeFactor = await call(controller, "feeFactorMantissa", [pFeeToken._address]);
            expect(pFeeTokenFeeFactor).toEqual('20000000000000000');
        });

        it("simple repay (equal accountBorrows)", async () => {
            let accLiquidityBeforeRepay = await call(controller, "getAccountLiquidity", [accounts[0]]);
            expect(accLiquidityBeforeRepay).toEqual({"0": "0", "1": "0", "2": "0"}); // $0

            let borrowBalanceStoredBeforeRepay = await call(pFeeToken, "borrowBalanceStored", [accounts[0]]);
            expect(borrowBalanceStoredBeforeRepay).toEqual("707547169811320754717");

            let repayAmount = '707547169811320754717';
            let tx18 = await send(pFeeToken, 'repayBorrow', [repayAmount], { from: accounts[0] });
            expect(tx18).toSucceed();

            let borrowBalanceStoredAfterRepay = await call(pFeeToken, "borrowBalanceStored", [accounts[0]]);
            expect(borrowBalanceStoredAfterRepay).toEqual("14150943396226415094");

            let accLiquidityAfterRepay = await call(controller, "getAccountLiquidity", [accounts[0]]);
            expect(accLiquidityAfterRepay).toEqual({"0": "0", "1": "735000000000000000001", "2": "0"}); // $0

        });

        it("over repay (more than accountBorrows, bun less than accountBorrows + fee factor)", async () => {
            let accLiquidityBeforeRepay = await call(controller, "getAccountLiquidity", [accounts[0]]);
            expect(accLiquidityBeforeRepay).toEqual({"0": "0", "1": "0", "2": "0"}); // $0

            let borrowBalanceStoredBeforeRepay = await call(pFeeToken, "borrowBalanceStored", [accounts[0]]);
            expect(borrowBalanceStoredBeforeRepay).toEqual("707547169811320754717");
            let repayAmount = '721986907970735463995';
            let tx18 = await send(pFeeToken, 'repayBorrow', [repayAmount], { from: accounts[0] });
            expect(tx18).toSucceed();

            let borrowBalanceStoredAfterRepay = await call(pFeeToken, "borrowBalanceStored", [accounts[0]]);
            expect(borrowBalanceStoredAfterRepay).toEqual("1");

            let accLiquidityAfterRepay = await call(controller, "getAccountLiquidity", [accounts[0]]);
            expect(accLiquidityAfterRepay).toEqual({"0": "0", "1": "749999999999999999999", "2": "0"}); // $0
        });

        it("over repay (equal accountBorrows + fee factor", async () => {
            let accLiquidityBeforeRepay = await call(controller, "getAccountLiquidity", [accounts[0]]);
            expect(accLiquidityBeforeRepay).toEqual({"0": "0", "1": "0", "2": "0"}); // $0

            let borrowBalanceStoredBeforeRepay = await call(pFeeToken, "borrowBalanceStored", [accounts[0]]);
            expect(borrowBalanceStoredBeforeRepay).toEqual("707547169811320754717");

            let repayAmount = '721986907970735463997';
            let tx18 = await send(pFeeToken, 'repayBorrow', [repayAmount], { from: accounts[0] });
            expect(tx18).toSucceed();

            let borrowBalanceStoredAfterRepay = await call(pFeeToken, "borrowBalanceStored", [accounts[0]]);
            expect(borrowBalanceStoredAfterRepay).toEqual("0");

            let accLiquidityAfterRepay = await call(controller, "getAccountLiquidity", [accounts[0]]);
            expect(accLiquidityAfterRepay).toEqual({"0": "0", "1": "750000000000000000000", "2": "0"}); // $0
        });

        it("over repay (more than accountBorrows + fee factor", async () => {
            let accLiquidityBeforeRepay = await call(controller, "getAccountLiquidity", [accounts[0]]);
            expect(accLiquidityBeforeRepay).toEqual({"0": "0", "1": "0", "2": "0"}); // $0

            let borrowBalanceStoredBeforeRepay = await call(pFeeToken, "borrowBalanceStored", [accounts[0]]);
            expect(borrowBalanceStoredBeforeRepay).toEqual("707547169811320754717");

            let repayAmount = '821698113207547169812';
            let tx18 = await send(pFeeToken, 'repayBorrow', [repayAmount], { from: accounts[0] });
            expect(tx18).toSucceed();

            let borrowBalanceStoredAfterRepay = await call(pFeeToken, "borrowBalanceStored", [accounts[0]]);
            expect(borrowBalanceStoredAfterRepay).toEqual("0");

            let accLiquidityAfterRepay = await call(controller, "getAccountLiquidity", [accounts[0]]);
            expect(accLiquidityAfterRepay).toEqual({"0": "0", "1": "750000000000000000000", "2": "0"}); // $0
        });
    });

    describe("Other functions", () => {
        it("revert for token with big % fee ", async () => {
            let feeToken = await makeToken({kind: 'fee', basisPointFee: '9000'}); // 90% fee

            let tx1 = await send(oracle, 'setPrice', [feeToken._address, '25000000000000000000']); // $25
            let tx2 = await send(oracle, 'setSearchPair', [feeToken._address, '1000']);
            expect(tx1).toSucceed();
            expect(tx2).toSucceed();

            let tx3 = await send(pTokenFactory, 'createPToken', [feeToken._address]);
            let pFeeTokenAddress = tx3.events['PTokenCreated'].returnValues['newPToken'];
            expect(tx3).toSucceed();

            let block = await web3.eth.getBlock(await blockNumber());
            let startBorrowTimestamp = +block.timestamp + +borrowDelay;
            expect(tx3).toHaveLog('PTokenCreated', {newPToken: pFeeTokenAddress, startBorrowTimestamp: startBorrowTimestamp});

            let tx4 = await send(oracle, 'setUnderlyingPrice', [pFeeTokenAddress, '1000000000000000000']); // $1
            expect(tx4).toSucceed();

            // 4. User1 mint and approve fee token to pFeeToken
            let tx5 = await send(feeToken, 'allocateTo', [accounts[1], "10000000000000000000000"], { from: accounts[1] }); // $10000
            let tx6 = await send(feeToken, 'approve', [pFeeTokenAddress, "1000000000000000000000000000000000000"], { from: accounts[1] });
            expect(tx5).toSucceed();
            expect(tx6).toSucceed();

            // 5. User1 mint pFeeToken
            let pFeeToken = await saddle.getContractAt('PErc20DelegateHarness', pFeeTokenAddress);
            let amount = '10000000000000000000000'; // $10000 = 10000e18, but on contract will be 1000 (90% is fee)
            await expect(
                send(pFeeToken, 'mint', [amount], { from: accounts[1] })
            ).rejects.toRevert('revert SET_FEE_FACTOR_FAILED');
        });

        it("set fee factor in controller", async () => {
            let borrowDelay = 86400;
            let feeToken0 = await makeToken({kind: 'fee', basisPointFee: '0'}); // 0% fee
            let feeToken1 = await makeToken({kind: 'fee', basisPointFee: '500'}); // 5% fee
            let feeToken2 = await makeToken({kind: 'fee', basisPointFee: '1000'}); // 10% fee

            await send(oracle, 'setPrice', [feeToken0._address, '25000000000000000000']); // $25
            await send(oracle, 'setSearchPair', [feeToken0._address, '1000']);
            await send(oracle, 'setPrice', [feeToken1._address, '25000000000000000000']); // $25
            await send(oracle, 'setSearchPair', [feeToken1._address, '1000']);
            await send(oracle, 'setPrice', [feeToken2._address, '25000000000000000000']); // $25
            await send(oracle, 'setSearchPair', [feeToken2._address, '1000']);

            let tx0 = await send(pTokenFactory, 'createPToken', [feeToken0._address]);
            let pFeeTokenAddress0 = tx0.events['PTokenCreated'].returnValues['newPToken'];
            expect(tx0).toSucceed();

            let block = await web3.eth.getBlock(await blockNumber());
            let startBorrowTimestamp = +block.timestamp + +borrowDelay;
            expect(tx0).toHaveLog('PTokenCreated', {newPToken: pFeeTokenAddress0, startBorrowTimestamp: startBorrowTimestamp});

            let tx1 = await send(pTokenFactory, 'createPToken', [feeToken1._address]);
            let pFeeTokenAddress1 = tx1.events['PTokenCreated'].returnValues['newPToken'];
            expect(tx1).toSucceed();

            block = await web3.eth.getBlock(await blockNumber());
            startBorrowTimestamp = +block.timestamp + +borrowDelay;
            expect(tx1).toHaveLog('PTokenCreated', {newPToken: pFeeTokenAddress1, startBorrowTimestamp: startBorrowTimestamp});

            let tx2 = await send(pTokenFactory, 'createPToken', [feeToken2._address]);
            let pFeeTokenAddress2 = tx2.events['PTokenCreated'].returnValues['newPToken'];
            expect(tx2).toSucceed();

            block = await web3.eth.getBlock(await blockNumber());
            startBorrowTimestamp = +block.timestamp + +borrowDelay;
            expect(tx2).toHaveLog('PTokenCreated', {newPToken: pFeeTokenAddress2, startBorrowTimestamp: startBorrowTimestamp});

            await send(oracle, 'setUnderlyingPrice', [pFeeTokenAddress0, '1000000000000000000']); // $1
            await send(oracle, 'setUnderlyingPrice', [pFeeTokenAddress1, '1000000000000000000']); // $1
            await send(oracle, 'setUnderlyingPrice', [pFeeTokenAddress2, '1000000000000000000']); // $1

            // 4. User1 mint and approve fee token to pFeeToken
            await send(feeToken0, 'allocateTo', [accounts[1], "10000000000000000000000"], { from: accounts[1] });
            await send(feeToken0, 'approve', [pFeeTokenAddress0, "1000000000000000000000000000000000000"], { from: accounts[1] });
            await send(feeToken1, 'allocateTo', [accounts[1], "10000000000000000000000"], { from: accounts[1] });
            await send(feeToken1, 'approve', [pFeeTokenAddress1, "1000000000000000000000000000000000000"], { from: accounts[1] });
            await send(feeToken2, 'allocateTo', [accounts[1], "10000000000000000000000"], { from: accounts[1] });
            await send(feeToken2, 'approve', [pFeeTokenAddress2, "1000000000000000000000000000000000000"], { from: accounts[1] });

            // 5. User1 mint pFeeToken
            let pFeeToken0 = await saddle.getContractAt('PErc20DelegateHarness', pFeeTokenAddress0);
            let amount = '1000000000000000000000';
            let tx3 = await send(pFeeToken0, 'mint', [amount], { from: accounts[1] });
            expect(tx3).toSucceed();

            let pFeeToken1 = await saddle.getContractAt('PErc20DelegateHarness', pFeeTokenAddress1);
            amount = '1000000000000000000000';
            let tx4 = await send(pFeeToken1, 'mint', [amount], { from: accounts[1] });
            expect(tx4).toSucceed();

            let pFeeToken2 = await saddle.getContractAt('PErc20DelegateHarness', pFeeTokenAddress2);
            amount = '1000000000000000000000';
            let tx5 = await send(pFeeToken2, 'mint', [amount], { from: accounts[1] });
            expect(tx5).toSucceed();

            let pTokenFeeFactor0 = await call(controller, "feeFactorMantissa", [pFeeToken0._address]);
            expect(pTokenFeeFactor0).toEqual('0');
            let pTokenFeeFactor1 = await call(controller, "feeFactorMantissa", [pFeeToken1._address]);
            expect(pTokenFeeFactor1).toEqual('50000000000000000');
            let pTokenFeeFactor2 = await call(controller, "feeFactorMantissa", [pFeeToken2._address]);
            expect(pTokenFeeFactor2).toEqual('100000000000000000');

            let tx6 = await send(controller, '_setFeeFactor', [pFeeTokenAddress0, "1"], { from: accounts[1] });
            expect(tx6).toHaveLog('Failure', {
                error: 1,
                info: 18,
                detail: 0
            });

            let tx7 = await send(controller, '_setFeeFactor', [accounts[0], "1"], { from: accounts[0] });
            expect(tx7).toHaveLog('Failure', {
                error: 1,
                info: 18,
                detail: 0
            });

            let tx8 = await send(controller, '_setFeeFactor', [pFeeTokenAddress0, "1"]);
            expect(tx8).toSucceed();
            pTokenFeeFactor0 = await call(controller, "feeFactorMantissa", [pFeeToken0._address]);
            expect(pTokenFeeFactor0).toEqual('1');

            let tokenArray = [];
            tokenArray[0] = pFeeTokenAddress0;
            tokenArray[1] = pFeeTokenAddress1;
            tokenArray[2] = pFeeTokenAddress2;

            let feeFactorArray = [];
            feeFactorArray[0] = 3;
            feeFactorArray[1] = 3;
            feeFactorArray[2] = 3;

            let tx9 = await send(controller, '_setFeeFactors', [tokenArray, feeFactorArray], { from: accounts[1] });
            expect(tx9).toHaveLog('Failure', {
                error: 13,
                info: 18,
                detail: 0
            });

            let tx10 = await send(controller, '_setFeeFactors', [tokenArray, feeFactorArray]);
            expect(tx10).toSucceed();

            await expect(
                send(controller, '_setFeeFactors', [tokenArray, ['1','100000000000000001','1']])
            ).rejects.toRevert('revert SET_FEE_FACTOR_FAILED');

            await expect(
                send(controller, '_setFeeFactors', [[pFeeTokenAddress1, pFeeTokenAddress2], ['1']])
            ).rejects.toRevert('revert invalid input');

            await expect(
                send(controller, '_setFeeFactors', [[pFeeTokenAddress0, accounts[0], pFeeTokenAddress2], ['1','1','1']])
            ).rejects.toRevert('revert market is not listed');
        });
    });

    describe("Update fee factor checks", () => {
        it("Fee factor", async () => {
            let feeToken18 = await makeToken({decimals: '18', kind: 'fee', basisPointFee: '0'});  // fee = 0%
            let feeFactorMax = '30000000000000000000';
            await send(controller, '_setFeeFactorMaxMantissa', [feeFactorMax]);

            let tx1 = await send(oracle, 'setPrice', [feeToken18._address, '1000000000000000000']);
            let tx2 = await send(oracle, 'setSearchPair', [feeToken18._address, '1000']);
            expect(tx1).toSucceed();
            expect(tx2).toSucceed();

            let tx3 = await send(pTokenFactory, 'createPToken', [feeToken18._address]);
            let pFeeTokenAddress = tx3.events['PTokenCreated'].returnValues['newPToken'];
            expect(tx3).toSucceed();

            let block = await web3.eth.getBlock(await blockNumber());
            let startBorrowTimestamp = +block.timestamp + +borrowDelay;
            expect(tx3).toHaveLog('PTokenCreated', {newPToken: pFeeTokenAddress, startBorrowTimestamp: startBorrowTimestamp});

            let tx4 = await send(oracle, 'setUnderlyingPrice', [pFeeTokenAddress, '1000000000000000000']);
            expect(tx4).toSucceed();

            // Get fee token
            let tx5 = await send(feeToken18, 'allocateTo', [accounts[0], "1000000000000000000000000000000"], { from: accounts[0] });
            let tx6 = await send(feeToken18, 'approve', [pFeeTokenAddress, "1000000000000000000000000000000000000"], { from: accounts[0] });
            expect(tx5).toSucceed();
            expect(tx6).toSucceed();

            // 5. User1 mint pFeeToken
            let pFeeToken = await saddle.getContractAt('PErc20DelegateHarness', pFeeTokenAddress);
            let amount = '1000000000000000000000'; // $1000 = 1000e18
            let tx7 = await send(pFeeToken, 'mint', [amount], { from: accounts[0] });
            expect(tx7).toSucceed();
            expect(tx7).toHaveLog('Mint', {
                minter: accounts[0],
                mintAmount: '1000000000000000000000',
                mintTokens: "100000000000",
            });

            // Check feeFactorMantissa for pFeeToken is 0e18
            let pFeeTokenFeeFactor = await call(controller, "feeFactorMantissa", [pFeeToken._address]);
            expect(pFeeTokenFeeFactor).toEqual('0');

            let tx8 = await send(feeToken18, 'setBasisPointFee', ["100"], { from: root }); // 1%
            expect(tx8).toSucceed();

            amount = '222';
            let tx9 = await send(pFeeToken, 'mint', [amount], { from: accounts[0] });
            expect(tx9).toSucceed();
            expect(tx9).toHaveLog('Mint', {
                minter: accounts[0],
                mintAmount: 220,
                mintTokens: "0",
            });

            // Check feeFactorMantissa for pFeeToken
            pFeeTokenFeeFactor = await call(controller, "feeFactorMantissa", [pFeeToken._address]);
            expect(pFeeTokenFeeFactor).toEqual('9009009009009010');

            let tx10 = await send(feeToken18, 'setBasisPointFee', ["2000"], { from: root }); // 20%
            expect(tx10).toSucceed();

            amount = '1000';
            let tx11 = await send(pFeeToken, 'mint', [amount], { from: accounts[0] });
            expect(tx11).toSucceed();
            expect(tx11).toHaveLog('Mint', {
                minter: accounts[0],
                mintAmount: 800,
                mintTokens: "0",
            });

            // Check feeFactorMantissa for pFeeToken
            pFeeTokenFeeFactor = await call(controller, "feeFactorMantissa", [pFeeToken._address]);
            expect(pFeeTokenFeeFactor).toEqual('200000000000000000');

            let tx12 = await send(feeToken18, 'setBasisPointFee', ["12"], { from: root }); // 0,12%
            expect(tx12).toSucceed();

            amount = '22222';
            let tx13 = await send(pFeeToken, 'mint', [amount], { from: accounts[0] });
            expect(tx13).toSucceed();
            expect(tx13).toHaveLog('Mint', {
                minter: accounts[0],
                mintAmount: 22196,
                mintTokens: "0",
            });
        });
    });
});