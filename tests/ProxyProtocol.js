const BigNumber = require('bignumber.js');

const {
    etherBalance,
    etherGasCost
} = require('./Utils/Ethereum');

const {
    makeController,
    makeInterestRateModel,
    makeProxyProtocol,
    makePTokenFactory,
    makePToken,
    makeToken
} = require('./Utils/DeFiPie');

describe('Proxy Protocol tests', () => {
    let root, admin, feeRecipient, accounts;
    let controller, interestRateModel, exchangeRate, reserveFactor, uniswapOracle;
    let pETH, feeToken, proxyProtocol, pTokenFactory, maximillion;
    let feeAmountCreatePool, feePercentMint, feePercentRepayBorrow;
    let oracle, oracleAddr, factoryUniswapAddr, factoryUniswap, registryAddr, registry;
    let underlying, pTokenAddress;

    beforeEach(async () => {
        [root, admin, feeRecipient, ...accounts] = saddle.accounts;

        feeAmountCreatePool = '20000000000000000000'; // 20e18; // 20 tokens
        feePercentMint = '10000000000000000'; // 1e16; // 1%
        feePercentRepayBorrow = '5000000000000000'; // 5e17; // 0,5%

        feeToken = await makeToken();

        controller = await makeController({kind: 'bool'});
        interestRateModel = await makeInterestRateModel();
        exchangeRate = 0.02;
        reserveFactor = 0.1;

        pTokenFactory = await makePTokenFactory({
            controller: controller,
            interestRateModel: interestRateModel,
            exchangeRate:exchangeRate,
            reserveFactor:reserveFactor
        });

        pETH = await makePToken({kind: 'pether', pTokenFactory: pTokenFactory});

        maximillion = await deploy('Maximillion', [pETH._address]);
        expect(await call(maximillion, "pEther")).toEqual(pETH._address);

        proxyProtocol = await makeProxyProtocol({
            pTokenFactory: pTokenFactory,
            pETH: pETH,
            maximillion: maximillion,
            admin: admin,
            feeToken: feeToken,
            feeRecipient: feeRecipient,
            feeAmountCreatePool: feeAmountCreatePool,
            feePercentMint: feePercentMint,
            feePercentRepayBorrow: feePercentRepayBorrow
        });

        oracleAddr = await call(pTokenFactory, "oracle");
        oracle = await saddle.getContractAt('UniswapPriceOracleMock', oracleAddr);
        factoryUniswapAddr = await call(oracle, "uniswapFactory");
        factoryUniswap = await saddle.getContractAt('MockPriceFeed', factoryUniswapAddr);
        registryAddr = await call(pTokenFactory, "registry");
        registry = await saddle.getContractAt('Registry', registryAddr);

        // without proxy
        underlying = await makeToken();
        let tx1 = await send(factoryUniswap, 'setToken0Address', [underlying._address]);
        expect(tx1).toSucceed();
        let tx2 = await send(factoryUniswap, 'setToken1Address', [feeToken._address]);
        expect(tx2).toSucceed();

        let result = await send(pTokenFactory, 'createPToken', [underlying._address]);

        pTokenAddress = result.events['PTokenCreated'].returnValues['newPToken'];

        expect(result).toSucceed();
        expect(result).toHaveLog('PTokenCreated', {newPToken: pTokenAddress});

        let priceInUSD = '12000000000000000000'; // $12
        await send(oracle, 'setUnderlyingPrice', [pTokenAddress, priceInUSD]);

        priceInUSD = '400000000000000000000'; // $400
        await send(oracle, 'setUnderlyingPrice', [pETH._address, priceInUSD]);

        priceInUSD = '600000000000000000'; // $0.60
        await send(oracle, 'setPriceInUSD', [feeToken._address, priceInUSD]);
    });

    describe("constructor", () => {
        it("gets address of pTokenFactory", async () => {
            let pTokenFactoryAddress = await call(proxyProtocol, "pTokenFactory");
            expect(pTokenFactoryAddress).toEqual(pTokenFactory._address);
        });

        it("gets address of pETH", async () => {
            let pETHAddress = await call(proxyProtocol, "pETH");
            expect(pETHAddress).toEqual(pETH._address);
        });

        it("gets address of maximillion", async () => {
            let maximillionAddress = await call(proxyProtocol, "maximillion");
            expect(maximillionAddress).toEqual(maximillion._address);
        });

        it("gets address of admin", async () => {
            let adminAddress = await call(proxyProtocol, "admin");
            expect(adminAddress).toEqual(admin);
        });

        it("gets address of oracle", async () => {
            let oracleAddress = await call(proxyProtocol, "oracle");
            expect(oracleAddress).toEqual(oracle._address);
        });

        it("gets address of feeToken", async () => {
            let feeTokenAddress = await call(proxyProtocol, "feeToken");
            expect(feeTokenAddress).toEqual(feeToken._address);
        });

        it("gets address of feeRecipient", async () => {
            let feeRecipientAddress = await call(proxyProtocol, "feeRecipient");
            expect(feeRecipientAddress).toEqual(feeRecipient);
        });

        it("gets value of feeCreatePool", async () => {
            let feeAmountCreatePoolValue = await call(proxyProtocol, "feeAmountCreatePool");
            expect(feeAmountCreatePoolValue).toEqual(feeAmountCreatePool);
        });

        it("gets value of feeMint", async () => {
            let feePercentMintValue = await call(proxyProtocol, "feePercentMint");
            expect(feePercentMintValue).toEqual(feePercentMint);
        });

        it("gets value of feeRepayBorrow", async () => {
            let feePercentRepayBorrowValue = await call(proxyProtocol, "feePercentRepayBorrow");
            expect(feePercentRepayBorrowValue).toEqual(feePercentRepayBorrow);
        });
    });

    describe("create pool", () => {
        it("create pool", async () => {
            // with proxy
            let newUnderlying = await makeToken();
            let tx = await send(factoryUniswap, 'setToken0Address', [newUnderlying._address]);
            expect(tx).toSucceed();

            let result = await send(feeToken, 'approve', [proxyProtocol._address, feeAmountCreatePool], {from: root});

            let balanceStart = new BigNumber(await call(feeToken, 'balanceOf', [root]));
            let balanceFeeRecipientStart = new BigNumber(await call(feeToken, 'balanceOf', [feeRecipient]));

            let tx1 = await send(proxyProtocol, 'createPToken', [newUnderlying._address], {from: root});
            let tx2 = await call(registry, 'pTokens', [newUnderlying._address]);
            expect(tx1.events[2].address).toEqual(pTokenFactory._address);
            expect((tx1.events[2].raw.data).slice(26)).toEqual(tx2.toLowerCase().slice(2));

            let balanceRootEnd = new BigNumber(await call(feeToken, 'balanceOf', [root]));
            let balanceFeeRecipientEnd = new BigNumber(await call(feeToken, 'balanceOf', [feeRecipient]));

            expect(balanceRootEnd).toEqual(balanceStart.minus(feeAmountCreatePool));
            expect(balanceFeeRecipientEnd).toEqual(balanceFeeRecipientStart.plus(feeAmountCreatePool));
        });
    });

    describe("check mint", () => {
        it("receive tokens for mint and return pTokens to msg.sender", async () => {
            let mintAmount = '1000000000000000000'; // 1 token = $12
            let fee = new BigNumber(await call(proxyProtocol, 'calcFee', [feePercentMint, pTokenAddress, mintAmount]));
            let calcFee = '200000000000000000';  // proxy token decimals is 18 // $12 * 1% = 12 cents / feeToken price (60 cents) = 0.2 feeToken
            expect(fee.toFixed()).toEqual(calcFee);

            let result = await send(feeToken, 'approve', [proxyProtocol._address, fee], {from: root});

            let balanceStart = new BigNumber(await call(feeToken, 'balanceOf', [root]));
            let balanceFeeRecipientStart = new BigNumber(await call(feeToken, 'balanceOf', [feeRecipient]));

            let balanceRootStart = new BigNumber(await call(underlying, 'balanceOf', [root]));
            expect(balanceRootStart.toFixed()).toEqual('10000000000000000000000000');

            let balanceProxyStart = new BigNumber(await call(underlying, 'balanceOf', [proxyProtocol._address]));
            expect(balanceProxyStart.toFixed()).toEqual('0');

            let balancePTokenStart = new BigNumber(await call(underlying, 'balanceOf', [pTokenAddress]));
            expect(balancePTokenStart.toFixed()).toEqual('0');

            let pToken = await saddle.getContractAt('ERC20Harness', pTokenAddress);

            let balanceProxyPTokenStart = new BigNumber(await call(pToken, 'balanceOf', [proxyProtocol._address]));
            expect(balanceProxyPTokenStart.toFixed()).toEqual('0');

            let balancePTokenRootStart = new BigNumber(await call(pToken, 'balanceOf', [root]));
            expect(balancePTokenRootStart.toFixed()).toEqual('0');

            let totalSupplyPTokenStart = new BigNumber(await call(pToken, 'totalSupply'));
            expect(totalSupplyPTokenStart.toFixed()).toEqual('0');

            let tx0 = await send(underlying, 'approve', [proxyProtocol._address, mintAmount], {from: root});
            let tx1 = await send(proxyProtocol, 'mint', [pTokenAddress, mintAmount], {from: root});

            let balanceRootEnd = new BigNumber(await call(underlying, 'balanceOf', [root]));
            expect(balanceRootEnd.toFixed()).toEqual(balanceRootStart.minus(mintAmount).toFixed());

            let balanceProxyEnd = new BigNumber(await call(underlying, 'balanceOf', [proxyProtocol._address]));
            expect(balanceProxyEnd.toFixed()).toEqual('0');

            let balancePTokenEnd = new BigNumber(await call(underlying, 'balanceOf', [pTokenAddress]));
            expect(balancePTokenEnd.toFixed()).toEqual(mintAmount);

            let balanceProxyPTokenEnd = new BigNumber(await call(pToken, 'balanceOf', [proxyProtocol._address]));
            expect(balanceProxyPTokenEnd.toFixed()).toEqual('0');

            let balancePTokenRootEnd = new BigNumber(await call(pToken, 'balanceOf', [root]));
            let totalSupplyPTokenEnd = new BigNumber(await call(pToken, 'totalSupply'));

            expect(balancePTokenRootEnd.toFixed()).toEqual(totalSupplyPTokenEnd.toFixed());

            let balanceProxyRootEnd = new BigNumber(await call(feeToken, 'balanceOf', [root]));
            let balanceFeeRecipientEnd = new BigNumber(await call(feeToken, 'balanceOf', [feeRecipient]));

            expect(balanceProxyRootEnd).toEqual(balanceStart.minus(fee));
            expect(balanceFeeRecipientEnd).toEqual(balanceFeeRecipientStart.plus(fee));
        });
    });

    describe("check repay borrow and repayBorrowBehalf", () => {
        it("borrow tokens and call repayBorrow and repayBorrowBehalf", async () => {
            let balanceProxyStart = new BigNumber(await call(underlying, 'balanceOf', [proxyProtocol._address]));
            expect(balanceProxyStart.toFixed()).toEqual('0');

            let mintAmount = '1000000000000000000';

            let fee = new BigNumber(await call(proxyProtocol, 'calcFee', [feePercentMint, pTokenAddress, mintAmount]));
            let result = await send(feeToken, 'approve', [proxyProtocol._address, fee], {from: root});

            let tx0 = await send(underlying, 'approve', [proxyProtocol._address, mintAmount], {from: root});
            let tx1 = await send(proxyProtocol, 'mint', [pTokenAddress, mintAmount], {from: root});

            let pToken = await saddle.getContractAt('PErc20', pTokenAddress);
            let borrowAmount = '500000000000000000';

            let balanceStart = new BigNumber(await call(feeToken, 'balanceOf', [root]));
            let balanceFeeRecipientStart = new BigNumber(await call(feeToken, 'balanceOf', [feeRecipient]));

            let balanceRootStart = new BigNumber(await call(underlying, 'balanceOf', [root]));
            expect(balanceRootStart.toFixed()).toEqual('9999999000000000000000000');

            let tx2 = await send(pToken, 'borrow', [borrowAmount], {from: root});

            let balanceRootAfterBorrow = new BigNumber(await call(underlying, 'balanceOf', [root]));
            expect(balanceRootAfterBorrow.toFixed()).toEqual('9999999500000000000000000');

            let repayAmount = '250000000000000000'; // $3
            fee = new BigNumber(await call(proxyProtocol, 'calcFee', [feePercentRepayBorrow, pTokenAddress, repayAmount]));
            let calcFee = '25000000000000000';  // proxy token decimals is 18 // $3 * 0,5% = 1,5 cents / feeToken price (60 cents) = 0.025 feeToken
            expect(fee.toFixed()).toEqual(calcFee);

            result = await send(feeToken, 'approve', [proxyProtocol._address, fee], {from: root});

            let tx4 = await send(underlying, 'approve', [proxyProtocol._address, repayAmount], {from: root});
            let tx5 = await send(proxyProtocol, 'repayBorrow', [pTokenAddress, repayAmount], {from: root});

            let balanceRootAfterRepay = new BigNumber(await call(underlying, 'balanceOf', [root]));
            expect(balanceRootAfterRepay.toFixed()).toEqual('9999999250000000000000000');

            let balanceProxyRootAfterRepay = new BigNumber(await call(feeToken, 'balanceOf', [root]));
            let balanceFeeRecipientAfterRepay = new BigNumber(await call(feeToken, 'balanceOf', [feeRecipient]));

            expect(balanceProxyRootAfterRepay).toEqual(balanceStart.minus(fee));
            expect(balanceFeeRecipientAfterRepay).toEqual(balanceFeeRecipientStart.plus(fee));

            result = await send(feeToken, 'approve', [proxyProtocol._address, fee], {from: root});

            repayAmount = '350000000000000000'; // 0,25 + extra 0,1
            let tx6 = await send(underlying, 'approve', [proxyProtocol._address, repayAmount], {from: root});
            let tx7 = await send(proxyProtocol, 'repayBorrowBehalf', [pTokenAddress, root, repayAmount], {from: root});

            let balanceProxyPTokenEnd = new BigNumber(await call(pToken, 'balanceOf', [proxyProtocol._address]));
            expect(balanceProxyPTokenEnd.toFixed()).toEqual('0');

            let balanceRootAfterRepayBehalf = new BigNumber(await call(underlying, 'balanceOf', [root]));
            expect(balanceRootAfterRepayBehalf.toFixed()).toEqual('9999999000000000000000000');

            let balanceProxyRootEnd = new BigNumber(await call(feeToken, 'balanceOf', [root]));
            let balanceFeeRecipientEnd = new BigNumber(await call(feeToken, 'balanceOf', [feeRecipient]));

            expect(balanceProxyRootEnd).toEqual(balanceProxyRootAfterRepay.minus(fee));
            expect(balanceFeeRecipientEnd).toEqual(balanceFeeRecipientAfterRepay.plus(fee));
        });
    });

    describe("check fee calc for different decimals", () => {
        it("decimals is 6", async () => {
            let newFeeToken = await makeToken({decimals: 6});
            let newProxyProtocol = await makeProxyProtocol({
                pTokenFactory: pTokenFactory,
                pETH: pETH,
                admin: admin,
                feeToken: newFeeToken,
                feeRecipient: feeRecipient,
                feeAmountCreatePool: feeAmountCreatePool,
                feePercentMint: feePercentMint,
                feePercentRepayBorrow: feePercentRepayBorrow
            });

            let priceInUSD = '600000000000000000'; // $0.60
            await send(oracle, 'setPriceInUSD', [newFeeToken._address, priceInUSD]);

            let mintAmount = '1000000000000000000'; // 1 token = $12
            let fee = new BigNumber(await call(newProxyProtocol, 'calcFee', [feePercentMint, pTokenAddress, mintAmount]));
            let calcFee = '200000';  // proxy token decimals is 6 // $12 * 1% = 12 cents / feeToken price (60 cents) = 0.2 feeToken
            expect(fee.toFixed()).toEqual(calcFee);

            let repayAmount = '250000000000000000'; // $3
            fee = new BigNumber(await call(newProxyProtocol, 'calcFee', [feePercentRepayBorrow, pTokenAddress, repayAmount]));
            calcFee = '25000';  // proxy token decimals is 6 // $3 * 0,5% = 1,5 cents / feeToken price (60 cents) = 0.025 feeToken
            expect(fee.toFixed()).toEqual(calcFee);
        });

        it("decimals is 8", async () => {
            let newFeeToken = await makeToken({decimals: 8});
            let newProxyProtocol = await makeProxyProtocol({
                pTokenFactory: pTokenFactory,
                pETH: pETH,
                admin: admin,
                feeToken: newFeeToken,
                feeRecipient: feeRecipient,
                feeAmountCreatePool: feeAmountCreatePool,
                feePercentMint: feePercentMint,
                feePercentRepayBorrow: feePercentRepayBorrow
            });

            let priceInUSD = '600000000000000000'; // $0.60
            await send(oracle, 'setPriceInUSD', [newFeeToken._address, priceInUSD]);

            let mintAmount = '1000000000000000000'; // 1 token = $12
            let fee = new BigNumber(await call(newProxyProtocol, 'calcFee', [feePercentMint, pTokenAddress, mintAmount]));
            let calcFee = '20000000';  // proxy token decimals is 8 // $12 * 1% = 12 cents / feeToken price (60 cents) = 0.2 feeToken
            expect(fee.toFixed()).toEqual(calcFee);

            let repayAmount = '250000000000000000'; // $3
            fee = new BigNumber(await call(newProxyProtocol, 'calcFee', [feePercentRepayBorrow, pTokenAddress, repayAmount]));
            calcFee = '2500000';  // proxy token decimals is 8 // $3 * 0,5% = 1,5 cents / feeToken price (60 cents) = 0.025 feeToken
            expect(fee.toFixed()).toEqual(calcFee);
        });

        it("decimals is 22", async () => {
            let newFeeToken = await makeToken({decimals: 22});
            let newProxyProtocol = await makeProxyProtocol({
                pTokenFactory: pTokenFactory,
                pETH: pETH,
                admin: admin,
                feeToken: newFeeToken,
                feeRecipient: feeRecipient,
                feeAmountCreatePool: feeAmountCreatePool,
                feePercentMint: feePercentMint,
                feePercentRepayBorrow: feePercentRepayBorrow
            });

            let priceInUSD = '600000000000000000'; // $0.60
            await send(oracle, 'setPriceInUSD', [newFeeToken._address, priceInUSD]);

            let mintAmount = '1000000000000000000'; // 1 token = $12
            let fee = new BigNumber(await call(newProxyProtocol, 'calcFee', [feePercentMint, pTokenAddress, mintAmount]));
            let calcFee = '2000000000000000000000';  // proxy token decimals is 22 // $12 * 1% = 12 cents / feeToken price (60 cents) = 0.2 feeToken
            expect(fee.toFixed()).toEqual(calcFee);

            let repayAmount = '250000000000000000'; // $3
            fee = new BigNumber(await call(newProxyProtocol, 'calcFee', [feePercentRepayBorrow, pTokenAddress, repayAmount]));
            calcFee = '250000000000000000000';  // proxy token decimals is 22 // $3 * 0,5% = 1,5 cents / feeToken price (60 cents) = 0.025 feeToken
            expect(fee.toFixed()).toEqual(calcFee);
        });
    });

    describe("check mint for pETH", () => {
        it("receive ethers for mint and return pEth's to msg.sender", async () => {
            let mintAmount = '1000000000000000000'; // 1 token = $400 // 1 ether = $400
            let fee = new BigNumber(await call(proxyProtocol, 'calcFee', [feePercentMint, pETH._address, mintAmount]));
            let calcFee = '6666666666666666666';  // proxy token decimals is 18 // $400 * 1% = $4 // feeToken price (60 cents) = 6,6 feeToken
            expect(fee.toFixed()).toEqual(calcFee);

            let result = await send(feeToken, 'approve', [proxyProtocol._address, fee], {from: root});

            let balanceStart = new BigNumber(await call(feeToken, 'balanceOf', [root]));
            let balanceFeeRecipientStart = new BigNumber(await call(feeToken, 'balanceOf', [feeRecipient]));

            let balanceRootStart = new BigNumber(await etherBalance(root));

            let balanceProxyStart = new BigNumber(await etherBalance(proxyProtocol._address));
            expect(balanceProxyStart.toFixed()).toEqual('0');

            let balancePETHStart = new BigNumber(await etherBalance(pETH._address));
            expect(balancePETHStart.toFixed()).toEqual('0');

            let balanceProxyPETHStart = new BigNumber(await call(pETH, 'balanceOf', [proxyProtocol._address]));
            expect(balanceProxyPETHStart.toFixed()).toEqual('0');

            let balancePETHRootStart = new BigNumber(await call(pETH, 'balanceOf', [root]));
            expect(balancePETHRootStart.toFixed()).toEqual('0');

            let totalSupplyPETHStart = new BigNumber(await call(pETH, 'totalSupply'));
            expect(totalSupplyPETHStart.toFixed()).toEqual('0');

            let tx1 = await send(proxyProtocol, 'mint', {from: root, value: mintAmount});
            const gasCost1 = await etherGasCost(tx1);

            let balanceRootEnd = new BigNumber(await etherBalance(root));
            expect(balanceRootEnd.toFixed()).toEqual(balanceRootStart.minus(gasCost1).minus(mintAmount).toFixed());

            let balanceProxyEnd = new BigNumber(await etherBalance(proxyProtocol._address));
            expect(balanceProxyEnd.toFixed()).toEqual('0');

            let balancePETHEnd = new BigNumber(await etherBalance(pETH._address));
            expect(balancePETHEnd.toFixed()).toEqual(mintAmount);

            let balanceProxyPETHEnd = new BigNumber(await call(pETH, 'balanceOf', [proxyProtocol._address]));
            expect(balanceProxyPETHEnd.toFixed()).toEqual('0');

            let balancePETHRootEnd = new BigNumber(await call(pETH, 'balanceOf', [root]));
            let totalSupplyPETHEnd = new BigNumber(await call(pETH, 'totalSupply'));

            expect(balancePETHRootEnd.toFixed()).toEqual(totalSupplyPETHEnd.toFixed());

            let balanceProxyRootEnd = new BigNumber(await call(feeToken, 'balanceOf', [root]));
            let balanceFeeRecipientEnd = new BigNumber(await call(feeToken, 'balanceOf', [feeRecipient]));

            expect(balanceProxyRootEnd).toEqual(balanceStart.minus(fee));
            expect(balanceFeeRecipientEnd).toEqual(balanceFeeRecipientStart.plus(fee));
        });
    });

    describe("check repay borrow and repayBorrowBehalf for pETH", () => {
        it("repay borrow for pETH", async () => {
            let balanceProxyStart = new BigNumber(await etherBalance(proxyProtocol._address));
            expect(balanceProxyStart.toFixed()).toEqual('0');

            let mintAmount = '100000000000000000'; // 0.1 ether - $40

            let fee = new BigNumber(await call(proxyProtocol, 'calcFee', [feePercentMint, pETH._address, mintAmount]));
            let calcFee = '666666666666666666';  // proxy token decimals is 18 // $40 * 1% = $0.4 // feeToken price (60 cents) = 0,6 feeToken
            expect(fee.toFixed()).toEqual(calcFee);

            let result = await send(feeToken, 'approve', [proxyProtocol._address, fee], {from: root});
            let tx1 = await send(proxyProtocol, 'mint', {from: root, value: mintAmount});

            let balanceStart = new BigNumber(await call(feeToken, 'balanceOf', [root]));
            let balanceFeeRecipientStart = new BigNumber(await call(feeToken, 'balanceOf', [feeRecipient]));

            let borrowAmount = '20000000000000000'; // 0.02 ether
            let tx2 = await send(pETH, 'borrow', [borrowAmount], {from: root});

            let repayAmount = '5000000000000000'; // 0.005 ether
            fee = new BigNumber(await call(proxyProtocol, 'calcFee', [feePercentRepayBorrow, pETH._address, repayAmount]));
            calcFee = '16666666666666666';  // proxy token decimals is 18 // $2 * 0,5% = 1 cents / feeToken price (60 cents) = 0.016 feeToken
            expect(fee.toFixed()).toEqual(calcFee);

            result = await send(feeToken, 'approve', [proxyProtocol._address, fee], {from: root});

            let balanceRootStart = new BigNumber(await etherBalance(root));
            let tx5 = await send(proxyProtocol, 'repayBorrow', {from: root, value: repayAmount});
            const gasCost5 = await etherGasCost(tx5);

            let balanceRootEnd = new BigNumber(await etherBalance(root));
            expect(balanceRootEnd.toFixed()).toEqual(balanceRootStart.minus(gasCost5).minus(repayAmount).toFixed());

            let balanceProxyRootAfterRepay = new BigNumber(await call(feeToken, 'balanceOf', [root]));
            let balanceFeeRecipientAfterRepay = new BigNumber(await call(feeToken, 'balanceOf', [feeRecipient]));

            let balanceProxy = new BigNumber(await etherBalance(proxyProtocol._address));
            expect(balanceProxy.toFixed()).toEqual('0');

            expect(balanceProxyRootAfterRepay).toEqual(balanceStart.minus(fee));
            expect(balanceFeeRecipientAfterRepay).toEqual(balanceFeeRecipientStart.plus(fee));

            repayAmount = '15000000000000000'; // 0.015 ether - $6
            fee = new BigNumber(await call(proxyProtocol, 'calcFee', [feePercentRepayBorrow, pETH._address, repayAmount]));
            calcFee = '50000000000000000';  // proxy token decimals is 18 // $6 * 0,5% = 3 cents / feeToken price (60 cents) = 0.05 feeToken
            expect(fee.toFixed()).toEqual(calcFee);

            result = await send(feeToken, 'approve', [proxyProtocol._address, fee], {from: root});

            balanceRootStart = new BigNumber(await etherBalance(root));
            let repayAmountWithAddition = '25000000000000000'; // 0.015 ether + 0.01 ether
            let tx7 = await send(proxyProtocol, 'repayBorrowBehalf', [root], {from: root, value: repayAmountWithAddition});
            const gasCost7 = await etherGasCost(tx7);

            balanceRootEnd = new BigNumber(await etherBalance(root));
            expect(balanceRootEnd.toFixed()).toEqual(balanceRootStart.minus(gasCost7).minus(repayAmount).toFixed());

            let balanceProxyPTokenEnd = new BigNumber(await call(pETH, 'balanceOf', [proxyProtocol._address]));
            expect(balanceProxyPTokenEnd.toFixed()).toEqual('0');

            let balancePETHRootEnd = new BigNumber(await call(pETH, 'balanceOf', [root]));
            let totalSupplyPETHEnd = new BigNumber(await call(pETH, 'totalSupply'));

            expect(balancePETHRootEnd.toFixed()).toEqual(totalSupplyPETHEnd.toFixed());

            let balanceProxyRootEnd = new BigNumber(await call(feeToken, 'balanceOf', [root]));
            let balanceFeeRecipientEnd = new BigNumber(await call(feeToken, 'balanceOf', [feeRecipient]));

            expect(balanceProxyRootEnd).toEqual(balanceProxyRootAfterRepay.minus(fee));
            expect(balanceFeeRecipientEnd).toEqual(balanceFeeRecipientAfterRepay.plus(fee));

            let balanceProxyEND = new BigNumber(await etherBalance(proxyProtocol._address));
            expect(balanceProxyEND.toFixed()).toEqual('0');
        });
    });

    describe("check set fee and recipient functions", () => {
        it("set fee function, reverts if not admin", async () => {
            await expect(
                send(proxyProtocol, '_setFee', [0,0,0] , {from: accounts[5]})
            ).rejects.toRevert('revert ProxyProtocol: Only admin can set fee');

            expect(await call(proxyProtocol, 'feeAmountCreatePool')).toEqual(feeAmountCreatePool);
            expect(await call(proxyProtocol, 'feePercentMint')).toEqual(feePercentMint);
            expect(await call(proxyProtocol, 'feePercentRepayBorrow')).toEqual(feePercentRepayBorrow);
        });

        it("set fee function", async () => {
            await send(proxyProtocol, '_setFee', ['0','0','0'] , {from: admin});

            expect(await call(proxyProtocol, 'feeAmountCreatePool')).toEqual('0');
            expect(await call(proxyProtocol, 'feePercentMint')).toEqual('0');
            expect(await call(proxyProtocol, 'feePercentRepayBorrow')).toEqual('0');
        });

        it("set recipient function, reverts if not admin", async () => {
            await expect(
                send(proxyProtocol, '_setRecipient', [accounts[5]] , {from: accounts[5]})
            ).rejects.toRevert('revert ProxyProtocol: Only admin can set fee recipient');

            expect(await call(proxyProtocol, 'feeRecipient')).toEqual(feeRecipient);
        });

        it("set recipient function", async () => {
            await send(proxyProtocol, '_setRecipient', [accounts[5]] , {from: admin});

            expect(await call(proxyProtocol, 'feeRecipient')).toEqual(accounts[5]);
        });

        it("set fee token function, reverts if not admin", async () => {
            await expect(
                send(proxyProtocol, '_setFeeToken', [accounts[5]] , {from: accounts[5]})
            ).rejects.toRevert('revert ProxyProtocol: Only admin can set fee token');

            expect(await call(proxyProtocol, 'feeToken')).toEqual(feeToken._address);
        });

        it("set fee token function", async () => {
            await send(proxyProtocol, '_setFeeToken', [accounts[5]] , {from: admin});

            expect(await call(proxyProtocol, 'feeToken')).toEqual(accounts[5]);
        });

        it("set factory function, reverts if not admin", async () => {
            await expect(
                send(proxyProtocol, '_setFactory', [accounts[5]] , {from: accounts[5]})
            ).rejects.toRevert('revert ProxyProtocol: Only admin can set factory');

            expect(await call(proxyProtocol, 'pTokenFactory')).toEqual(pTokenFactory._address);
        });

        it("set factory function", async () => {
            await send(proxyProtocol, '_setFactory', [accounts[5]] , {from: admin});

            expect(await call(proxyProtocol, 'pTokenFactory')).toEqual(accounts[5]);
        });

        it("set oracle function, reverts if not admin", async () => {
            await expect(
                send(proxyProtocol, '_setOracle', [accounts[5]] , {from: accounts[5]})
            ).rejects.toRevert('revert ProxyProtocol: Only admin can set oracle');

            expect(await call(proxyProtocol, 'oracle')).toEqual(oracle._address);
        });

        it("set oracle function", async () => {
            await send(proxyProtocol, '_setOracle', [accounts[5]] , {from: admin});

            expect(await call(proxyProtocol, 'oracle')).toEqual(accounts[5]);
        });
    });

    describe('_setPendingAdmin()', () => {
        it('should only be callable by admin', async () => {
            expect(
                send(proxyProtocol, '_setPendingAdmin', [accounts[5]], {from: accounts[5]})
            ).rejects.toRevert('revert ProxyProtocol: Only admin can set pending admin');

            expect(await call(proxyProtocol, 'admin')).toEqual(admin);
            expect(await call(proxyProtocol, 'pendingAdmin')).toBeAddressZero();
        });

        it('should properly set pending admin', async () => {
            expect(await send(proxyProtocol, '_setPendingAdmin', [accounts[5]], {from: admin})).toSucceed();

            expect(await call(proxyProtocol, 'admin')).toEqual(admin);
            expect(await call(proxyProtocol, 'pendingAdmin')).toEqual(accounts[5]);
        });

        it('should properly set pending admin twice', async () => {
            expect(await send(proxyProtocol, '_setPendingAdmin', [accounts[0]], {from: admin})).toSucceed();
            expect(await send(proxyProtocol, '_setPendingAdmin', [accounts[1]], {from: admin})).toSucceed();

            expect(await call(proxyProtocol, 'admin')).toEqual(admin);
            expect(await call(proxyProtocol, 'pendingAdmin')).toEqual(accounts[1]);
        });
    });

    describe('_acceptAdmin()', () => {
        it('should fail when pending admin is zero', async () => {
            expect(
                send(proxyProtocol, '_acceptAdmin')
            ).rejects.toRevert('revert ProxyProxyProtocol: Only pendingAdmin can accept admin');

            expect(await call(proxyProtocol, 'admin')).toEqual(admin);
            expect(await call(proxyProtocol, 'pendingAdmin')).toBeAddressZero();
        });

        it('should fail when called by another account (e.g. admin)', async () => {
            expect(await send(proxyProtocol, '_setPendingAdmin', [accounts[5]], {from: admin})).toSucceed();
            expect(
                send(proxyProtocol, '_acceptAdmin')
            ).rejects.toRevert('revert ProxyProxyProtocol: Only pendingAdmin can accept admin');

            expect(await call(proxyProtocol, 'admin')).toEqual(admin);
            expect(await call(proxyProtocol, 'pendingAdmin')).toEqual(accounts[5]);
        });

        it('should succeed and set admin and clear pending admin', async () => {
            expect(await send(proxyProtocol, '_setPendingAdmin', [accounts[5]], {from: admin})).toSucceed();
            expect(await send(proxyProtocol, '_acceptAdmin', [], {from: accounts[5]})).toSucceed();

            expect(await call(proxyProtocol, 'admin')).toEqual(accounts[5]);
            expect(await call(proxyProtocol, 'pendingAdmin')).toBeAddressZero();
        });
    });

    describe("check withdraw functions", () => {
        beforeEach(async () => {
            expect(await send(feeToken, 'transfer', [proxyProtocol._address, 1], {from: root})).toSucceed();
            await web3.eth.sendTransaction({ to: proxyProtocol._address, from: root, value: 1});

            let balanceETHStart = new BigNumber(await etherBalance(proxyProtocol._address));
            expect(balanceETHStart.toFixed()).toEqual('1');
            let balancePTokenStart = new BigNumber(await call(feeToken, 'balanceOf', [proxyProtocol._address]));
            expect(balancePTokenStart.toFixed()).toEqual('1');
        });

        it('should only be callable by admin', async () => {
            expect(
                send(proxyProtocol, 'withdraw', [feeToken._address, accounts[5]], {from: accounts[5]})
            ).rejects.toRevert('revert ProxyProtocol: Only admin can withdraw tokens from contract');

            expect(
                send(proxyProtocol, 'withdraw', [accounts[5]], {from: accounts[5]})
            ).rejects.toRevert('revert ProxyProtocol: Only admin can withdraw ether from contract');

            let balanceETH = new BigNumber(await etherBalance(proxyProtocol._address));
            expect(balanceETH.toFixed()).toEqual('1');
            let balancePToken = new BigNumber(await call(feeToken, 'balanceOf', [proxyProtocol._address]));
            expect(balancePToken.toFixed()).toEqual('1');
        });

        it('should succeed', async () => {
            let balanceETHStartTo = new BigNumber(await etherBalance(accounts[4]));

            expect(await send(proxyProtocol, 'withdraw', [feeToken._address, accounts[4]], {from: admin})).toSucceed();
            expect(await send(proxyProtocol, 'withdraw', [accounts[4]], {from: admin})).toSucceed();

            let balanceETH = new BigNumber(await etherBalance(proxyProtocol._address));
            expect(balanceETH.toFixed()).toEqual('0');
            let balancePToken = new BigNumber(await call(feeToken, 'balanceOf', [proxyProtocol._address]));
            expect(balancePToken.toFixed()).toEqual('0');

            let balanceETHTo = new BigNumber(await etherBalance(accounts[4]));
            expect(balanceETHTo.toFixed()).toEqual(balanceETHStartTo.plus(1).toFixed());
            let balancePTokenTo = new BigNumber(await call(feeToken, 'balanceOf', [accounts[4]]));
            expect(balancePTokenTo.toFixed()).toEqual('1');
        });
    });
});