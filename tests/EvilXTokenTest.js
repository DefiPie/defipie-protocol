const {
    makeToken,
    makeInterestRateModel,
    makeController,
    makePTokenFactory,
    makeRegistryProxy
} = require('./Utils/DeFiPie');

describe('EvilX Token tests', () => {
    let root, admin, accounts;
    let pTokenFactory, oracle, registryProxy;
    let controller, interestRateModel, exchangeRate, reserveFactor;
    let initialAmount, name, symbol, decimals;

    beforeEach(async () => {
        [root, admin, ...accounts] = saddle.accounts;

        oracle = await deploy('FixedPriceOracleV2');
        controller = await makeController({priceOracle: oracle});
        interestRateModel = await makeInterestRateModel();
        exchangeRate = 1;
        reserveFactor = 0.1;

        registryProxy = await makeRegistryProxy();

        pTokenFactory = await makePTokenFactory({
            controller: controller,
            interestRateModel: interestRateModel,
            uniswapOracle: oracle
        });
    });

    describe("constructor", () => {
        it("gets address of controller", async () => {
            let controllerAddress = await call(pTokenFactory, "controller");
            expect(controllerAddress).toEqual(controller._address);
        });

        it("gets address of oracle from factory", async () => {
            let oracleAddress = await call(pTokenFactory, "oracle");
            expect(oracleAddress).toEqual(oracle._address);
        });

        it("gets address of oracle from controller", async () => {
            let oracleAddress = await call(controller, "oracle");
            expect(oracleAddress).toEqual(oracle._address);
        });

    });

    describe("Create simple and evil token", () => {
        it("create token with default data", async () => {
            let underlying = await makeToken();
            let tx1 = await send(oracle, 'setPrice', [underlying._address, '10000000000000000000']);
            let tx2 = await send(oracle, 'setSearchPair', [underlying._address, 1000]);
            expect(tx1).toSucceed();
            expect(tx2).toSucceed();

            let tx3 = await send(pTokenFactory, 'createPToken', [underlying._address]);

            let pTokenAddress = tx3.events['PTokenCreated'].returnValues['newPToken'];

            expect(tx3).toSucceed();
            expect(tx3).toHaveLog('PTokenCreated', {newPToken: pTokenAddress});

            let tx4 = await send(oracle, 'setUnderlyingPrice', [pTokenAddress, '10000000000000000000']);
            let tx4_ = await send(controller, '_setCollateralFactor', [pTokenAddress, '500000000000000000']);

            let evilXToken = await deploy('EvilXToken');

            initialAmount = '100000000000000000000';
            name = 'XToken';
            symbol = 'X';
            decimals = '18';
            let tx5 = await send(evilXToken, 'initialize', [initialAmount, name, symbol, decimals]);
            let tx6 = await send(oracle, 'setPrice', [evilXToken._address, '10000000000000000000']);
            let tx7 = await send(oracle, 'setSearchPair', [evilXToken._address, 1000]);

            let tx8 = await send(pTokenFactory, 'createPToken', [evilXToken._address]);

            let pTokenEvilAddress = tx8.events['PTokenCreated'].returnValues['newPToken'];

            expect(tx8).toSucceed();
            expect(tx8).toHaveLog('PTokenCreated', {newPToken: pTokenEvilAddress});

            let tx9 = await send(oracle, 'setUnderlyingPrice', [pTokenEvilAddress, '10000000000000000000']);

            // Attack steps (Attack acc = evilXToken address)
            // 1. User approve simple token to simple
            // 2. User mint simple pToken
            // 3. evil user allocate XTokens to evilXToken address and simple token to evilXToken address
            // 4. evilXToken address approve XTokens to pXToken and simple tokens to pToken
            // 5. evilXToken address mint pXTokens and simple pTokens
            // 6. evilXToken address enter markets pToken and pXToken
            // 7. evilXToken set true to doBorrow, pTokenBorrow to simple pToken and count to 1
            // 8. evilXToken try get borrow pXToken and pToken

            // 1.
            let tx10 = await send(underlying, 'approve', [pTokenAddress, "1000000000000000000000000000000000000"]);

            // 2.
            let pTokenSimple = await saddle.getContractAt('PErc20DelegateHarness', pTokenAddress);
            let amount = 1000000000000;
            let tx20 = await send(pTokenSimple, 'mint', [amount]);

            // 3.
            amount = 1000000000000;
            let tx30 = await send(evilXToken, 'allocateTo', [evilXToken._address, amount]);
            let tx31 = await send(underlying, 'transfer', [evilXToken._address, amount]);

            // 4.
            let pTokenEvil = await saddle.getContractAt('PErc20DelegateHarness', pTokenEvilAddress);
            let tx40 = await send(evilXToken, 'setAllowance', [evilXToken._address, pTokenEvilAddress, "1000000000000000000000000000000000000"]);
            let tx41 = await send(evilXToken, 'approveToken', [underlying._address, pTokenAddress, "1000000000000000000000000000000000000"]);

            // 5.
            amount = 1000000000000;
            let tx50 = await send(evilXToken, 'setPTokenMint', [pTokenEvil._address]);
            let tx51 = await send(evilXToken, 'mint', [amount]);
            let tx52 = await send(evilXToken, 'setPTokenMint', [pTokenAddress]);
            let tx53 = await send(evilXToken, 'mint', [amount]);

            // 6.
            let tx60 = await send(evilXToken, 'setController', [controller._address]);
            let markets = [pTokenEvilAddress, pTokenAddress];
            let tx61 = await send(evilXToken, 'enterMarkets', [markets]);

            // 7.
            let simpleBorrowAmount = 500000000000;
            let tx70 = await send(evilXToken, 'setDoBorrow', [true]);
            let tx71 = await send(evilXToken, 'setPTokenBorrow', [pTokenAddress]);
            let tx72 = await send(evilXToken, 'setPToken', [pTokenEvilAddress]);
            let tx73 = await send(evilXToken, 'setBorrowAmount', [simpleBorrowAmount]);
            let tx74 = await send(evilXToken, 'setCount', ['1']);

            // 8.
            let xBorrowAmount = 500000000000;
            let accBeforeLiquidity = await call(controller, "getAccountLiquidity", [evilXToken._address]);
            expect(accBeforeLiquidity).toEqual({"0": "0", "1": "5000000000000", "2": "0"});
            let tx82 = await send(evilXToken, 'borrow', [xBorrowAmount]);
            let accAfterLiquidity = await call(controller, "getAccountLiquidity", [evilXToken._address]);
            expect(accAfterLiquidity).toEqual({"0": "0", "1": "0", "2": "0"});
        });
    });
});