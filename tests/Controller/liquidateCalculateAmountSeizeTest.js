const {etherUnsigned, UInt256Max} = require('../Utils/Ethereum');
const {
  makeController,
  makePToken,
  setOraclePrice
} = require('../Utils/DeFiPie');

const borrowedPrice = 2e10;
const collateralPrice = 1e18;
const repayAmount = etherUnsigned(1e18);

async function calculateSeizeTokens(controller, pTokenBorrowed, pTokenCollateral, repayAmount) {
  return call(controller, 'liquidateCalculateSeizeTokens', [pTokenBorrowed._address, pTokenCollateral._address, repayAmount]);
}

function rando(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

describe('Controller', () => {
  let root, accounts;
  let controller, pTokenBorrowed, pTokenCollateral;

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
    controller = await makeController();
    pTokenBorrowed = await makePToken({controller: controller, uniswapOracle: controller.priceOracle, registryProxy: controller.registryProxy, underlyingPrice: 0});
    pTokenCollateral = await makePToken({controller: controller, uniswapOracle: controller.priceOracle, registryProxy: controller.registryProxy, pTokenFactory: pTokenBorrowed.pTokenFactory, underlyingPrice: 0});
  });

  beforeEach(async () => {
    await setOraclePrice(pTokenBorrowed, borrowedPrice);
    await setOraclePrice(pTokenCollateral, collateralPrice);
    await send(pTokenCollateral, 'harnessExchangeRateDetails', [8e10, 4e10, 0]);
  });

  describe('liquidateCalculateAmountSeize', () => {
    it("fails if either asset price is 0", async () => {
      await setOraclePrice(pTokenBorrowed, 0);
      expect(
        await calculateSeizeTokens(controller, pTokenBorrowed, pTokenCollateral, repayAmount)
      ).toHaveTrollErrorTuple(['PRICE_ERROR', 0]);

      await setOraclePrice(pTokenCollateral, 0);
      expect(
        await calculateSeizeTokens(controller, pTokenBorrowed, pTokenCollateral, repayAmount)
      ).toHaveTrollErrorTuple(['PRICE_ERROR', 0]);
    });

    it("fails if the repayAmount causes overflow ", async () => {
      expect(
        await calculateSeizeTokens(controller, pTokenBorrowed, pTokenCollateral, UInt256Max())
      ).toHaveTrollErrorTuple(['MATH_ERROR', 0]);
    });

    it("fails if the borrowed asset price causes overflow ", async () => {
      await setOraclePrice(pTokenBorrowed, -1);
      expect(
        await calculateSeizeTokens(controller, pTokenBorrowed, pTokenCollateral, repayAmount)
      ).toHaveTrollErrorTuple(['MATH_ERROR', 0]);
    });

    it("reverts if it fails to calculate the exchange rate", async () => {
      await send(pTokenCollateral, 'harnessExchangeRateDetails', [1, 0, 10]); // (1 - 10) -> underflow
      await expect(
        send(controller, 'liquidateCalculateSeizeTokens', [pTokenBorrowed._address, pTokenCollateral._address, repayAmount])
      ).rejects.toRevert("revert exchangeRateStored: exchangeRateStoredInternal failed");
    });

    [
      [1e18, 1e18, 1e18, 1e18, 1e18],
      [2e18, 1e18, 1e18, 1e18, 1e18],
      [2e18, 2e18, 1.42e18, 1.3e18, 2.45e18],
      [2.789e18, 5.230480842e18, 771.32e18, 1.3e18, 10002.45e18],
      [ 7.009232529961056e+24,2.5278726317240445e+24,2.6177112093242585e+23,1179713989619784000,7.790468414639561e+24 ],
      [rando(0, 1e25), rando(0, 1e25), rando(1, 1e25), rando(1e18, 1.5e18), rando(0, 1e25)]
    ].forEach((testCase) => {
      it(`returns the correct value for ${testCase}`, async () => {
        const [exchangeRate, borrowedPrice, collateralPrice, liquidationIncentive, repayAmount] = testCase.map(etherUnsigned);

        await setOraclePrice(pTokenCollateral, collateralPrice);
        await setOraclePrice(pTokenBorrowed, borrowedPrice);
        await send(controller, '_setLiquidationIncentive', [liquidationIncentive]);
        await send(pTokenCollateral, 'harnessSetExchangeRate', [exchangeRate]);

        const seizeAmount = repayAmount.multipliedBy(liquidationIncentive).multipliedBy(borrowedPrice).dividedBy(collateralPrice);
        const seizeTokens = seizeAmount.dividedBy(exchangeRate);

        expect(
          await calculateSeizeTokens(controller, pTokenBorrowed, pTokenCollateral, repayAmount)
        ).toHaveTrollErrorTuple(
          ['NO_ERROR', Number(seizeTokens)],
          (x, y) => Math.abs(x - y) < 1e7
        );
      });
    });
  });
});
