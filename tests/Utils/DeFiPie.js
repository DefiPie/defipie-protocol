"use strict";

const { dfn } = require('./JS');
const {
  encodeParameters,
  etherBalance,
  etherMantissa,
  etherUnsigned,
  mergeInterface
} = require('./Ethereum');

async function makeController(opts = {}) {
  const {
    root = saddle.account,
    kind = 'unitroller'
  } = opts || {};

  if (kind == 'bool') {
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const controller = await deploy('BoolController', [priceOracle._address]);
    return Object.assign(controller, { priceOracle });
  }

  if (kind == 'false-marker') {
    return await deploy('FalseMarkerMethodController');
  }

  if (kind == 'v1-no-proxy') {
    const controller = await deploy('ControllerHarness');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = etherMantissa(dfn(opts.closeFactor, .051));
    const maxAssets = etherUnsigned(dfn(opts.maxAssets, 10));

    await send(controller, '_setCloseFactor', [closeFactor]);
    await send(controller, '_setMaxAssets', [maxAssets]);
    await send(controller, '_setPriceOracle', [priceOracle._address]);

    return Object.assign(controller, { priceOracle });
  }

  if (kind == 'unitroller-g2') {
    const unitroller = opts.unitroller || await deploy('Unitroller');
    const controller = await deploy('ControllerScenarioG2');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = etherMantissa(dfn(opts.closeFactor, .051));
    const maxAssets = etherUnsigned(dfn(opts.maxAssets, 10));
    const liquidationIncentive = etherMantissa(1);
    const pieRate = etherUnsigned(dfn(opts.pieRate, 1e18));
    const pieMarkets = opts.pieMarkets || [];

    await send(unitroller, '_setPendingImplementation', [controller._address]);
    await send(controller, '_become', [unitroller._address, pieRate, pieMarkets]);
    mergeInterface(unitroller, controller);
    await send(unitroller, '_setLiquidationIncentive', [liquidationIncentive]);
    await send(unitroller, '_setCloseFactor', [closeFactor]);
    await send(unitroller, '_setMaxAssets', [maxAssets]);
    await send(unitroller, '_setPriceOracle', [priceOracle._address]);

    return Object.assign(unitroller, { priceOracle });
  }

  if (kind == 'unitroller-g3') {
    const unitroller = opts.unitroller || await deploy('Unitroller');
    const controller = await deploy('ControllerScenarioG3');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = etherMantissa(dfn(opts.closeFactor, .051));
    const maxAssets = etherUnsigned(dfn(opts.maxAssets, 10));
    const liquidationIncentive = etherMantissa(1);
    const pieRate = etherUnsigned(dfn(opts.pieRate, 1e18));
    const pieMarkets = opts.pieMarkets || [];

    await send(unitroller, '_setPendingImplementation', [controller._address]);
    await send(controller, '_become', [unitroller._address, pieRate, pieMarkets]);
    mergeInterface(unitroller, controller);
    await send(unitroller, '_setLiquidationIncentive', [liquidationIncentive]);
    await send(unitroller, '_setCloseFactor', [closeFactor]);
    await send(unitroller, '_setMaxAssets', [maxAssets]);
    await send(unitroller, '_setPriceOracle', [priceOracle._address]);

    return Object.assign(unitroller, { priceOracle });
  }

  if (kind == 'unitroller') {
    const unitroller = opts.unitroller || await deploy('Unitroller');
    const controller = await deploy('ControllerHarness');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = etherMantissa(dfn(opts.closeFactor, .051));
    const maxAssets = etherUnsigned(dfn(opts.maxAssets, 10));
    const liquidationIncentive = etherMantissa(1);
    const pie = opts.pie || await deploy('Pie', [opts.pieOwner || root]);
    const pieRate = etherUnsigned(dfn(opts.pieRate, 1e18));
    const pieMarkets = opts.pieMarkets || [];

    await send(unitroller, '_setPendingImplementation', [controller._address]);
    await send(controller, '_become', [unitroller._address, pieRate, pieMarkets]);
    mergeInterface(unitroller, controller);
    await send(unitroller, '_setLiquidationIncentive', [liquidationIncentive]);
    await send(unitroller, '_setCloseFactor', [closeFactor]);
    await send(unitroller, '_setMaxAssets', [maxAssets]);
    await send(unitroller, '_setPriceOracle', [priceOracle._address]);
    await send(unitroller, 'setPieAddress', [pie._address]); // harness only
    await send(unitroller, '_setPieRate', [pieRate]);

    return Object.assign(unitroller, { priceOracle, pie });
  }
}

async function makePToken(opts = {}) {
  const {
    root = saddle.account,
    kind = 'perc20'
  } = opts || {};

  const controller = opts.controller || await makeController(opts.controllerOpts);
  const interestRateModel = opts.interestRateModel || await makeInterestRateModel(opts.interestRateModelOpts);
  const exchangeRate = etherMantissa(dfn(opts.exchangeRate, 1));
  const reserveFactor = etherMantissa(dfn(opts.reserveFactor, 0.1));
  const symbol = opts.symbol || (kind === 'pether' ? 'pETH' : 'pOMG');
  const name = opts.name || `PToken ${symbol}`;

  const registryProxy = opts.registryProxy || await makeRegistryProxy(opts.registryProxyOpts);
  const mockPriceFeed = opts.mockPriceFeed || await deploy('MockPriceFeed');
  const uniswapOracle = opts.uniswapOracle || await deploy('UniswapPriceOracleHarness', [
      registryProxy._address,
      mockPriceFeed._address,
      mockPriceFeed._address,
      mockPriceFeed._address
  ]);

  let pToken, underlying;
  let pTokenFactory;
  let tokenAddress;
  let tx1, tx2, tx3;

  pTokenFactory = await deploy('PTokenFactoryHarness', [
    registryProxy._address,
    0,
    uniswapOracle._address,
    controller._address,
    interestRateModel._address,
    exchangeRate,
    reserveFactor
  ]);

  tx1 = await send(controller, '_setFactoryContract', [pTokenFactory._address]);
  tx2 = await send(registryProxy, '_setFactoryContract', [pTokenFactory._address]);

  switch (kind) {
    case 'pether':
      let pETHImplementation = await deploy('PEtherDelegateHarness');

      tx3 = await send(pTokenFactory, 'createPETH', [pETHImplementation._address]);

      tokenAddress = tx3.events['PTokenCreated'].returnValues['newPToken'];

      pToken = await saddle.getContractAt('PEtherDelegateHarness', tokenAddress);
      break;

    case 'ppie':
      underlying = opts.underlying || await makeToken(opts.underlyingOpts);
      await send(mockPriceFeed, 'setToken0Address', [underlying._address]);

      let pPIEImplementation = await deploy('PPIEDelegateHarness');

      tx3 = await send(pTokenFactory, 'createPPIE', [underlying._address, pPIEImplementation._address]);

      tokenAddress = tx3.events['PTokenCreated'].returnValues['newPToken'];

      pToken = await saddle.getContractAt('PPIEDelegateHarness', tokenAddress);
      break;

    case 'perc20':
    default:
      underlying = opts.underlying || await makeToken(opts.underlyingOpts);
      await send(mockPriceFeed, 'setToken0Address', [underlying._address]);

      tx3 = await send(pTokenFactory, 'createPToken', [underlying._address]);

      tokenAddress = tx3.events['PTokenCreated'].returnValues['newPToken'];

      pToken = await saddle.getContractAt('PErc20DelegateHarness', tokenAddress);
      break;
  }

  if (opts.supportMarket) {
    await send(controller, '_supportMarket', [pToken._address]);
  }

  if (opts.addPieMarket) {
    await send(controller, '_addPieMarket', [pToken._address]);
  }

  if (opts.underlyingPrice) {
    const price = etherMantissa(opts.underlyingPrice);
    await send(controller.priceOracle, 'setUnderlyingPrice', [pToken._address, price]);
  }

  if (opts.collateralFactor) {
    const factor = etherMantissa(opts.collateralFactor);
    expect(await send(controller, '_setCollateralFactor', [pToken._address, factor])).toSucceed();
  }

  return Object.assign(pToken, { name, symbol, underlying, controller, interestRateModel });
}

async function makeInterestRateModel(opts = {}) {
  const {
    root = saddle.account,
    kind = 'harnessed'
  } = opts || {};

  if (kind == 'harnessed') {
    const borrowRate = etherMantissa(dfn(opts.borrowRate, 0));
    return await deploy('InterestRateModelHarness', [borrowRate]);
  }

  if (kind == 'false-marker') {
    const borrowRate = etherMantissa(dfn(opts.borrowRate, 0));
    return await deploy('FalseMarkerMethodInterestRateModel', [borrowRate]);
  }

  if (kind == 'white-paper') {
    const baseRate = etherMantissa(dfn(opts.baseRate, 0));
    const multiplier = etherMantissa(dfn(opts.multiplier, 1e-18));
    return await deploy('WhitePaperInterestRateModel', [baseRate, multiplier]);
  }

  if (kind == 'jump-rate') {
    const baseRate = etherMantissa(dfn(opts.baseRate, 0));
    const multiplier = etherMantissa(dfn(opts.multiplier, 1e-18));
    const jump = etherMantissa(dfn(opts.jump, 0));
    const kink = etherMantissa(dfn(opts.kink, 0));
    return await deploy('JumpRateModel', [baseRate, multiplier, jump, kink]);
  }
}

async function makePriceOracle(opts = {}) {
  const {
    root = saddle.account,
    kind = 'simple'
  } = opts || {};

  if (kind == 'simple') {
    return await deploy('SimplePriceOracle');
  }
}

async function makeToken(opts = {}) {
  const {
    root = saddle.account,
    kind = 'erc20'
  } = opts || {};

  if (kind == 'erc20') {
    const quantity = etherUnsigned(dfn(opts.quantity, 1e25));
    const decimals = etherUnsigned(dfn(opts.decimals, 18));
    const symbol = opts.symbol || 'OMG';
    const name = opts.name || `Erc20 ${symbol}`;
    return await deploy('ERC20Harness', [quantity, name, decimals, symbol]);
  }
}

async function makePTokenFactory(opts = {}) {
    const {
        root = saddle.account
    } = opts || {};

    const controller = opts.controller || await makeController(opts.controllerOpts);
    const interestRateModel = opts.interestRateModel || await makeInterestRateModel(opts.interestRateModelOpts);
    const exchangeRate = etherMantissa(dfn(opts.exchangeRate, 1));
    const reserveFactor = etherMantissa(dfn(opts.reserveFactor, 0.1));

    let pTokenFactory;
    const registryProxy = opts.registryProxy || await makeRegistryProxy(opts.registryProxyOpts);
    const mockPriceFeed = opts.mockPriceFeed || await deploy('MockPriceFeed');
    const uniswapOracle = opts.uniswapOracle || await deploy('UniswapPriceOracleMock', [
        registryProxy._address,
        mockPriceFeed._address,
        mockPriceFeed._address,
        mockPriceFeed._address
    ]);

    pTokenFactory = await deploy('PTokenFactoryHarness', [
        registryProxy._address,
        0,
        uniswapOracle._address,
        controller._address,
        interestRateModel._address,
        exchangeRate,
        reserveFactor
    ]);

    let tx1 = await send(controller, '_setFactoryContract', [pTokenFactory._address]);
    let tx2 = await send(registryProxy, '_setFactoryContract', [pTokenFactory._address]);

    pTokenFactory = await saddle.getContractAt('PTokenFactoryHarness', pTokenFactory._address);

    return pTokenFactory;
}

async function makeRegistryProxy(opts = {}) {
    const {
        root = saddle.account,
        kind = ''
    } = opts || {};

    const pDelegatee = opts.implementation || await deploy('PErc20DelegateHarness');

    let registry, registryProxy;
    registry = await deploy('RegistryHarness', [
        pDelegatee._address || pDelegatee
    ]);

    registryProxy = await deploy('RegistryProxyHarness', [
        registry._address,
        pDelegatee._address || pDelegatee
    ]);

    registryProxy = await saddle.getContractAt('RegistryProxyHarness', registryProxy._address);

    return registryProxy;
}

async function balanceOf(token, account) {
  return etherUnsigned(await call(token, 'balanceOf', [account]));
}

async function totalSupply(token) {
  return etherUnsigned(await call(token, 'totalSupply'));
}

async function borrowSnapshot(pToken, account) {
  const { principal, interestIndex } = await call(pToken, 'harnessAccountBorrows', [account]);
  return { principal: etherUnsigned(principal), interestIndex: etherUnsigned(interestIndex) };
}

async function totalBorrows(pToken) {
  return etherUnsigned(await call(pToken, 'totalBorrows'));
}

async function totalReserves(pToken) {
  return etherUnsigned(await call(pToken, 'totalReserves'));
}

async function enterMarkets(pTokens, from) {
  return await send(pTokens[0].controller, 'enterMarkets', [pTokens.map(c => c._address)], { from });
}

async function fastForward(pToken, blocks = 5) {
  return await send(pToken, 'harnessFastForward', [blocks]);
}

async function setBalance(pToken, account, balance) {
  return await send(pToken, 'harnessSetBalance', [account, balance]);
}

async function setEtherBalance(pEther, balance) {
  const current = await etherBalance(pEther._address);
  const root = saddle.account;
  expect(await send(pEther, 'harnessDoTransferOut', [root, current])).toSucceed();
  expect(await send(pEther, 'harnessDoTransferIn', [root, balance], { value: balance })).toSucceed();
}

async function getBalances(pTokens, accounts) {
  const balances = {};
  for (let pToken of pTokens) {
    const cBalances = balances[pToken._address] = {};
    for (let account of accounts) {
      cBalances[account] = {
        eth: await etherBalance(account),
        cash: pToken.underlying && await balanceOf(pToken.underlying, account),
        tokens: await balanceOf(pToken, account),
        borrows: (await borrowSnapshot(pToken, account)).principal
      };
    }
    cBalances[pToken._address] = {
      eth: await etherBalance(pToken._address),
      cash: pToken.underlying && await balanceOf(pToken.underlying, pToken._address),
      tokens: await totalSupply(pToken),
      borrows: await totalBorrows(pToken),
      reserves: await totalReserves(pToken)
    };
  }
  return balances;
}

async function adjustBalances(balances, deltas) {
  for (let delta of deltas) {
    let pToken, account, key, diff;
    if (delta.length == 4) {
      ([pToken, account, key, diff] = delta);
    } else {
      ([pToken, key, diff] = delta);
      account = pToken._address;
    }
    balances[pToken._address][account][key] = balances[pToken._address][account][key].add(diff);
  }
  return balances;
}

async function preApprove(pToken, from, amount, opts = {}) {
  if (dfn(opts.faucet, true)) {
    expect(await send(pToken.underlying, 'harnessSetBalance', [from, amount], { from })).toSucceed();
  }

  return send(pToken.underlying, 'approve', [pToken._address, amount], { from });
}

async function quickMint(pToken, minter, mintAmount, opts = {}) {
  // make sure to accrue interest
  await fastForward(pToken, 1);

  if (dfn(opts.approve, true)) {
    expect(await preApprove(pToken, minter, mintAmount, opts)).toSucceed();
  }
  if (dfn(opts.exchangeRate)) {
    expect(await send(pToken, 'harnessSetExchangeRate', [etherMantissa(opts.exchangeRate)])).toSucceed();
  }
  return send(pToken, 'mint', [mintAmount], { from: minter });
}

async function preSupply(pToken, account, tokens, opts = {}) {
  if (dfn(opts.total, true)) {
    expect(await send(pToken, 'harnessSetTotalSupply', [tokens])).toSucceed();
  }
  return send(pToken, 'harnessSetBalance', [account, tokens]);
}

async function quickRedeem(pToken, redeemer, redeemTokens, opts = {}) {
  await fastForward(pToken, 1);

  if (dfn(opts.supply, true)) {
    expect(await preSupply(pToken, redeemer, redeemTokens, opts)).toSucceed();
  }
  if (dfn(opts.exchangeRate)) {
    expect(await send(pToken, 'harnessSetExchangeRate', [etherMantissa(opts.exchangeRate)])).toSucceed();
  }
  return send(pToken, 'redeem', [redeemTokens], { from: redeemer });
}

async function quickRedeemUnderlying(pToken, redeemer, redeemAmount, opts = {}) {
  await fastForward(pToken, 1);

  if (dfn(opts.exchangeRate)) {
    expect(await send(pToken, 'harnessSetExchangeRate', [etherMantissa(opts.exchangeRate)])).toSucceed();
  }
  return send(pToken, 'redeemUnderlying', [redeemAmount], { from: redeemer });
}

async function setOraclePrice(pToken, price) {
  return send(pToken.controller.priceOracle, 'setUnderlyingPrice', [pToken._address, etherMantissa(price)]);
}

async function setBorrowRate(pToken, rate) {
  return send(pToken.interestRateModel, 'setBorrowRate', [etherMantissa(rate)]);
}

async function getBorrowRate(interestRateModel, cash, borrows, reserves) {
  return call(interestRateModel, 'getBorrowRate', [cash, borrows, reserves].map(etherUnsigned));
}

async function getSupplyRate(interestRateModel, cash, borrows, reserves, reserveFactor) {
  return call(interestRateModel, 'getSupplyRate', [cash, borrows, reserves, reserveFactor].map(etherUnsigned));
}

async function pretendBorrow(pToken, borrower, accountIndex, marketIndex, principalRaw, blockNumber = 2e7) {
  await send(pToken, 'harnessSetTotalBorrows', [etherUnsigned(principalRaw)]);
  await send(pToken, 'harnessSetAccountBorrows', [borrower, etherUnsigned(principalRaw), etherMantissa(accountIndex)]);
  await send(pToken, 'harnessSetBorrowIndex', [etherMantissa(marketIndex)]);
  await send(pToken, 'harnessSetAccrualBlockNumber', [etherUnsigned(blockNumber)]);
  await send(pToken, 'harnessSetBlockNumber', [etherUnsigned(blockNumber)]);
}

module.exports = {
  makeController,
  makePToken,
  makeInterestRateModel,
  makePriceOracle,
  makeToken,
  makePTokenFactory,
  makeRegistryProxy,

  balanceOf,
  totalSupply,
  borrowSnapshot,
  totalBorrows,
  totalReserves,
  enterMarkets,
  fastForward,
  setBalance,
  setEtherBalance,
  getBalances,
  adjustBalances,

  preApprove,
  quickMint,

  preSupply,
  quickRedeem,
  quickRedeemUnderlying,

  setOraclePrice,
  setBorrowRate,
  getBorrowRate,
  getSupplyRate,
  pretendBorrow
};
