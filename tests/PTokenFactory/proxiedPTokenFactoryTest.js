const { makePToken, makePriceOracle, makeRegistryProxy, makeController, makeInterestRateModel} = require('../Utils/DeFiPie');

describe('PTokenFactory', function() {
  let root, accounts;
  let pTokenFactoryProxy, implementation, registryProxy;
  let controller, interestRateModel, initialExchangeRateMantissa, initialReserveFactorMantissa, minOracleLiquidity;
  let pTokenFactory;

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
    implementation = await deploy('PTokenFactory');
    registryProxy = await makeRegistryProxy();
    controller = await makeController();
    interestRateModel = await makeInterestRateModel();
    initialExchangeRateMantissa = '1';
    initialReserveFactorMantissa = '2';
    minOracleLiquidity = '3';
    pTokenFactoryProxy = await deploy('PTokenFactoryProxy', [
        implementation._address,
        registryProxy._address,
        controller._address,
        interestRateModel._address,
        initialExchangeRateMantissa,
        initialReserveFactorMantissa,
        minOracleLiquidity
    ]);

    pTokenFactory = await saddle.getContractAt('PTokenFactory', pTokenFactoryProxy._address);
  });

  describe("constructor", () => {
    it("gets address of implementation", async () => {
        let implementationAddress = await call(pTokenFactoryProxy, "implementation");
        expect(implementationAddress).toEqual(implementation._address);
    });

    it("gets value of registry", async () => {
        let registryAddress = await call(pTokenFactoryProxy, "registry");
        expect(registryAddress).toEqual(registryProxy._address);
    });
  });

  describe("check v1 storage after init", () => {
    it("gets value of controller", async () => {
      let controllerAddress = await call(pTokenFactory, "controller");
      expect(controllerAddress).toEqual(controller._address);
    });

    it("gets value of interestRateModel", async () => {
      let interestRateModelAddress = await call(pTokenFactory, "interestRateModel");
      expect(interestRateModelAddress).toEqual(interestRateModel._address);
    });

    it("gets value of initialExchangeRateMantissa", async () => {
      let initialExchangeRateMantissaV = await call(pTokenFactory, "initialExchangeRateMantissa");
      expect(initialExchangeRateMantissaV).toEqual(initialExchangeRateMantissa);
    });

    it("gets value of initialReserveFactorMantissa", async () => {
      let initialReserveFactorMantissaV = await call(pTokenFactory, "initialReserveFactorMantissa");
      expect(initialReserveFactorMantissaV).toEqual(initialReserveFactorMantissa);
    });

    it("gets value of minOracleLiquidity", async () => {
      let minOracleLiquidityV = await call(pTokenFactory, "minOracleLiquidity");
      expect(minOracleLiquidityV).toEqual(minOracleLiquidity);
    });

    it("gets value of decimals", async () => {
      let decimalsV = await call(pTokenFactory, "decimals");
      expect(decimalsV).toEqual('8');
    });

    it("gets value of isUnderlyingBlackListed", async () => {
      let isUnderlyingBlackListedV = await call(pTokenFactory, "isUnderlyingBlackListed", [root]);
      expect(isUnderlyingBlackListedV).toEqual(false);
    });

    it("gets value of createPoolFeeAmount", async () => {
      let createPoolFeeAmountV = await call(pTokenFactory, "createPoolFeeAmount");
      expect(createPoolFeeAmountV).toEqual('0');
    });
  });

  describe("implementation address", () => {
    it("set implementation address", async () => {
        let result = await send(pTokenFactoryProxy, '_setImplementation', [accounts[1]]);
        expect(await call(pTokenFactoryProxy, 'implementation')).toEqual(accounts[1]);

        expect(result).toHaveLog('NewImplementation', {
            oldImplementation: implementation._address,
            newImplementation: accounts[1]
        });
    });

    it("set implementation address, not UNAUTHORIZED", async () => {
        let result = await send(pTokenFactoryProxy, '_setImplementation', [accounts[2]], {from: accounts[2]});
        expect(result).toHaveFactoryFailure('UNAUTHORIZED', 'SET_NEW_IMPLEMENTATION');
    });
  });

});
