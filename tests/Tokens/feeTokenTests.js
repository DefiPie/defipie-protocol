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
            uniswapOracle: oracle
        });
    });

    describe("Create fee token", () => {
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
            expect(tx5).toHaveLog('PTokenCreated', {newPToken: pTokenAddress});

            let tx6 = await send(pTokenFactory, 'createPToken', [feeToken._address]);
            let pFeeTokenAddress = tx6.events['PTokenCreated'].returnValues['newPToken'];
            expect(tx6).toSucceed();
            expect(tx6).toHaveLog('PTokenCreated', {newPToken: pFeeTokenAddress});

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
            let borrowAmount = '625000000000000000001'; // max amount is $625
            let tx17 = await send(pFeeToken, 'borrow', [borrowAmount], { from: accounts[0] });
            expect(tx17).toHaveLog('Failure', {
                error: 3,
                info: 11,
                detail: 4
            });

            borrowAmount = '625000000000000000000'; // max amount is $625
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
            let sumBorrowUser0 = borrowAmountUser0BN.dividedBy('0.9').multipliedBy('1.2').multipliedBy('1.1'); // get 625, receive 562,5, thus 562,5/0.9 * 1,2 (feeAddition * 2) * 1,1 (price)
            expect(sumBorrowUser0.toFixed()).toEqual('825000000000000000000');

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
            let liquidateBorrowAmount0 = '312500000000000000001';
            let tx22 = await send(pFeeToken, 'liquidateBorrow', [accounts[0], liquidateBorrowAmount0, pTokenSimple._address], { from: accounts[3] });
            expect(tx22).toHaveLog('Failure', {
                error: 3,
                info: 15,
                detail: 17
            });

            let balanceCollateralTokenBeforeLiquidation = await call(pTokenSimple, 'balanceOf', [accounts[3]]);
            expect(balanceCollateralTokenBeforeLiquidation).toEqual('0');

            let liquidateBorrowAmount1 = '312500000000000000000';
            let tx23 = await send(pFeeToken, 'liquidateBorrow', [accounts[0], liquidateBorrowAmount1, pTokenSimple._address], { from: accounts[3] });
            expect(tx23).toSucceed();

            let balanceCollateralTokenAfterFirstLiquidation = await call(pTokenSimple, 'balanceOf', [accounts[3]]);
            expect(balanceCollateralTokenAfterFirstLiquidation).toEqual('42013888888');

            // 4. Check User0 getAccountLiquidity
            let accLiquidityAfterFirstLiquidate = await call(controller, "getAccountLiquidity", [accounts[0]]);
            expect(accLiquidityAfterFirstLiquidate).toEqual({"0": "0", "1": "0", "2": "18854166660000000000"}); //

            let borrowAmountBN = new bn(borrowAmount);
            let liquidateBorrowAmount1BN = new bn(liquidateBorrowAmount1);
            let sumBorrowUser0AfterLiquidation = borrowAmountBN.minus((liquidateBorrowAmount1BN.multipliedBy('0.9'))).multipliedBy('1.32'); // 1.1 * 1.2 (20% is feeAddition * 2)
            expect(sumBorrowUser0AfterLiquidation.toFixed()).toEqual('453750000000000000000');

            let balanceSimplePTokenAfterFirstLiquidationBN = new bn(await call(pTokenSimple, "balanceOf", [accounts[0]]));
            expect(balanceSimplePTokenAfterFirstLiquidationBN.toFixed()).toEqual('57986111112'); // deposit 579,87

            let sumCollateralAfterFirstLiquidation = balanceSimplePTokenAfterFirstLiquidationBN.multipliedBy(1e18).multipliedBy(0.75).dividedBy(1e8); // 1e18 is normalize, 1e8 is pToken decimals, 0.75 is collateralFactor, $434,9
            expect(sumCollateralAfterFirstLiquidation.toFixed()).toEqual('434895833340000000000'); // collateral 434,9

            let loanAfterFirstLiquidation = sumBorrowUser0AfterLiquidation.dividedBy(sumCollateralAfterFirstLiquidation);
            expect(loanAfterFirstLiquidation.toFixed()).toEqual('1.04335329339717973395'); // is 104,33%

            // 5. Second liquidate user0 by user3
            let liquidateBorrowAmount2 = '171875000000000000000';
            let tx24 = await send(pFeeToken, 'liquidateBorrow', [accounts[0], liquidateBorrowAmount2, pTokenSimple._address], { from: accounts[3] });
            expect(tx24).toSucceed();

            let balanceCollateralTokenAfterSecondLiquidation = await call(pTokenSimple, 'balanceOf', [accounts[3]]);
            expect(balanceCollateralTokenAfterSecondLiquidation).toEqual('65121527776');

            // 6. Check User0 getAccountLiquidity
            let accLiquidityAfterSecondLiquidate = await call(controller, "getAccountLiquidity", [accounts[0]]);
            expect(accLiquidityAfterSecondLiquidate).toEqual({"0": "0", "1": "12026041680000000000", "2": "0"});

            let liquidateBorrowAmount2BN = new bn(liquidateBorrowAmount2);
            let borrowAmountBeforeSecondLiquidationBN = sumBorrowUser0AfterLiquidation.dividedBy(1.32);
            expect(borrowAmountBeforeSecondLiquidationBN.toFixed()).toEqual('343750000000000000000'); // is 343,75

            let sumBorrowUser0AfterSecondLiquidation = borrowAmountBeforeSecondLiquidationBN.minus((liquidateBorrowAmount2BN.multipliedBy('0.9'))).multipliedBy('1.32'); // 1.1 * 1.2 (20% is feeAddition * 2)
            expect(sumBorrowUser0AfterSecondLiquidation.toFixed()).toEqual('249562500000000000000');

            let balanceSimplePTokenAfterSecondLiquidationBN = new bn(await call(pTokenSimple, "balanceOf", [accounts[0]]));
            expect(balanceSimplePTokenAfterSecondLiquidationBN.toFixed()).toEqual('34878472224'); // deposit 348,78

            let sumCollateralAfterSecondLiquidation = balanceSimplePTokenAfterSecondLiquidationBN.multipliedBy(1e18).multipliedBy(0.75).dividedBy(1e8); // 1e18 is normalize, 1e8 is pToken decimals, 0.75 is collateralFactor, $434,9
            expect(sumCollateralAfterSecondLiquidation.toFixed()).toEqual('261588541680000000000'); // collateral 261,59

            let loanAfterSecondLiquidation = sumBorrowUser0AfterSecondLiquidation.dividedBy(sumCollateralAfterSecondLiquidation);
            expect(loanAfterSecondLiquidation.toFixed()).toEqual('0.95402687899567329397'); // is 95.4%
        });

        it("revert for token with big % fee ", async () => {
            let feeToken = await makeToken({kind: 'fee', basisPointFee: '9000'}); // 90% fee

            let tx1 = await send(oracle, 'setPrice', [feeToken._address, '25000000000000000000']); // $25
            let tx2 = await send(oracle, 'setSearchPair', [feeToken._address, '1000']);
            expect(tx1).toSucceed();
            expect(tx2).toSucceed();

            let tx3 = await send(pTokenFactory, 'createPToken', [feeToken._address]);
            let pFeeTokenAddress = tx3.events['PTokenCreated'].returnValues['newPToken'];
            expect(tx3).toSucceed();
            expect(tx3).toHaveLog('PTokenCreated', {newPToken: pFeeTokenAddress});

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
            expect(tx0).toHaveLog('PTokenCreated', {newPToken: pFeeTokenAddress0});

            let tx1 = await send(pTokenFactory, 'createPToken', [feeToken1._address]);
            let pFeeTokenAddress1 = tx1.events['PTokenCreated'].returnValues['newPToken'];
            expect(tx1).toSucceed();
            expect(tx1).toHaveLog('PTokenCreated', {newPToken: pFeeTokenAddress1});

            let tx2 = await send(pTokenFactory, 'createPToken', [feeToken2._address]);
            let pFeeTokenAddress2 = tx2.events['PTokenCreated'].returnValues['newPToken'];
            expect(tx2).toSucceed();
            expect(tx2).toHaveLog('PTokenCreated', {newPToken: pFeeTokenAddress2});

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

            let tx6 = await send(controller, 'setFeeFactor', [pFeeTokenAddress0, "1"], { from: accounts[1] });
            expect(tx6).toHaveLog('Failure', {
                error: 1,
                info: 18,
                detail: 0
            });

            let tx7 = await send(controller, 'setFeeFactor', [accounts[0], "1"], { from: accounts[0] });
            expect(tx7).toHaveLog('Failure', {
                error: 1,
                info: 18,
                detail: 0
            });

            let tx8 = await send(controller, 'setFeeFactor', [pFeeTokenAddress0, "1"]);
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

            let tx9 = await send(controller, 'setFeeFactors', [tokenArray, feeFactorArray], { from: accounts[1] });
            expect(tx9).toHaveLog('Failure', {
                error: 13,
                info: 18,
                detail: 0
            });

            let tx10 = await send(controller, 'setFeeFactors', [tokenArray, feeFactorArray]);
            expect(tx10).toSucceed();

            await expect(
                send(controller, 'setFeeFactors', [tokenArray, ['1','100000000000000001','1']])
            ).rejects.toRevert('revert SET_FEE_FACTOR_FAILED');

            await expect(
                send(controller, 'setFeeFactors', [[pFeeTokenAddress1, pFeeTokenAddress2], ['1']])
            ).rejects.toRevert('revert invalid input');

            await expect(
                send(controller, 'setFeeFactors', [[pFeeTokenAddress0, accounts[0], pFeeTokenAddress2], ['1','1','1']])
            ).rejects.toRevert('revert market is not listed');
        });
    });
});