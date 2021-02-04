const {
    makeToken,
    makePTokenFactory,
    makeRegistryProxy
} = require('./Utils/DeFiPie');

describe('PToken Factory tests', () => {
    let root, admin, accounts;
    let pTokenFactory, registryProxy, mockPriceFeed, uniswapOracle;
    let exchangeRate;

    beforeEach(async () => {
        [root, admin, ...accounts] = saddle.accounts;

        exchangeRate = 0.02;
        registryProxy = await makeRegistryProxy();
        mockPriceFeed = await deploy('MockPriceFeed');
        uniswapOracle = await deploy('UniswapPriceOracleMock', [
            registryProxy._address,
            mockPriceFeed._address,
            mockPriceFeed._address,
            mockPriceFeed._address
        ]);
        pTokenFactory = await makePTokenFactory({registryProxy: registryProxy, exchangeRate: exchangeRate, uniswapOracle: uniswapOracle});
    });

    describe("constructor", () => {
        it("gets value of initialExchangeRateMantissa", async () => {
            let initialExchangeRateMantissaValue = await call(pTokenFactory, "initialExchangeRateMantissa");
            expect(+initialExchangeRateMantissaValue).toEqual(0.02e18);
        });
    });

    describe("Create tokens with different decimals ", () => {
        it("create token with diff decimals", async () => {

            let decimals18 = await makeToken({decimals: 18});
            let decimals8 = await makeToken({decimals: 8});
            let decimals6 = await makeToken({decimals: 6});
            let decimals22 = await makeToken({decimals: 22});
            let decimals0 = await makeToken({decimals: 0});

            expect(await call(decimals18, 'decimals')).toEqual('18');
            expect(await call(decimals8, 'decimals')).toEqual('8');
            expect(await call(decimals6, 'decimals')).toEqual('6');
            expect(await call(decimals22, 'decimals')).toEqual('22');
            expect(await call(decimals0, 'decimals')).toEqual('0');

            await send(mockPriceFeed, 'setToken0Address', [decimals18._address]);
            let tx1 = await send(pTokenFactory, 'createPToken', [decimals18._address]);
            await send(mockPriceFeed, 'setToken0Address', [decimals8._address]);
            let tx2 = await send(pTokenFactory, 'createPToken', [decimals8._address]);
            await send(mockPriceFeed, 'setToken0Address', [decimals6._address]);
            let tx3 = await send(pTokenFactory, 'createPToken', [decimals6._address]);
            await send(mockPriceFeed, 'setToken0Address', [decimals22._address]);
            let tx4 = await send(pTokenFactory, 'createPToken', [decimals22._address]);
            await send(mockPriceFeed, 'setToken0Address', [decimals0._address]);
            let tx5 = await send(pTokenFactory, 'createPToken', [decimals0._address]);

            let pTokenAddress1 = tx1.events['PTokenCreated'].returnValues['newPToken'];
            let pTokenAddress2 = tx2.events['PTokenCreated'].returnValues['newPToken'];
            let pTokenAddress3 = tx3.events['PTokenCreated'].returnValues['newPToken'];
            let pTokenAddress4 = tx4.events['PTokenCreated'].returnValues['newPToken'];
            let pTokenAddress5 = tx5.events['PTokenCreated'].returnValues['newPToken'];

            expect(tx1).toSucceed();
            expect(tx1).toHaveLog('PTokenCreated', {newPToken: pTokenAddress1});
            expect(tx2).toSucceed();
            expect(tx2).toHaveLog('PTokenCreated', {newPToken: pTokenAddress2});
            expect(tx3).toSucceed();
            expect(tx3).toHaveLog('PTokenCreated', {newPToken: pTokenAddress3});
            expect(tx4).toSucceed();
            expect(tx4).toHaveLog('PTokenCreated', {newPToken: pTokenAddress4});
            expect(tx5).toSucceed();
            expect(tx5).toHaveLog('PTokenCreated', {newPToken: pTokenAddress5});

            let pToken1 = await saddle.getContractAt('PToken', pTokenAddress1);
            let pToken2 = await saddle.getContractAt('PToken', pTokenAddress2);
            let pToken3 = await saddle.getContractAt('PToken', pTokenAddress3);
            let pToken4 = await saddle.getContractAt('PToken', pTokenAddress4);
            let pToken5 = await saddle.getContractAt('PToken', pTokenAddress5);

            let exchangeRate1 = await call(pToken1, 'exchangeRateStored');
            let exchangeRate2 = await call(pToken2, 'exchangeRateStored');
            let exchangeRate3 = await call(pToken3, 'exchangeRateStored');
            let exchangeRate4 = await call(pToken4, 'exchangeRateStored');
            let exchangeRate5 = await call(pToken5, 'exchangeRateStored');

            expect(exchangeRate1).toEqual('200000000000000000000000000');
            expect(exchangeRate2).toEqual('20000000000000000');
            expect(exchangeRate3).toEqual('200000000000000');
            expect(exchangeRate4).toEqual('2000000000000000000000000000000');
            expect(exchangeRate5).toEqual('200000000');

        });

        it("create token with bad decimals", async () => {
            let decimals100 = await makeToken({decimals: 100});
            expect(await call(decimals100, 'decimals')).toEqual('100');
            await send(mockPriceFeed, 'setToken0Address', [decimals100._address]);

            await expect(
                send(pTokenFactory, 'createPToken', [decimals100._address])
            ).rejects.toRevert('revert SafeMath: multiplication overflow');
        });
    });
});