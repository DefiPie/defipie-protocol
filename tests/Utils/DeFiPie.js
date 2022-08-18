"use strict";

const { dfn } = require('./JS');
const {
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
    const controller = await deploy('ControllerHarnessWithAdmin');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = etherMantissa(dfn(opts.closeFactor, .051));
    const feeFactorMax = etherMantissa(dfn(opts.feeFactorMax, 0.1));
    const maxAssets = etherUnsigned(dfn(opts.maxAssets, 10));
    await send(controller, '_setCloseFactor', [closeFactor]);
    await send(controller, '_setFeeFactorMaxMantissa', [feeFactorMax]);
    await send(controller, '_setMaxAssets', [maxAssets]);
    return Object.assign(controller, { priceOracle });
  }

  if (kind == 'unitroller-g2') {
    const registryProxy = opts.registryProxy || await makeRegistryProxy(opts.registryProxyOpts);
    const unitroller = opts.unitroller || await deploy('Unitroller', [registryProxy._address]);
    const controller = await deploy('ControllerScenarioG2');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = etherMantissa(dfn(opts.closeFactor, .051));
    const feeFactorMax = etherMantissa(dfn(opts.feeFactorMax, 0.1));
    const maxAssets = etherUnsigned(dfn(opts.maxAssets, 10));
    const borrowDelay = etherUnsigned(dfn(opts.borrowDelay, 86400));
    const liquidationIncentive = etherMantissa(1);

    await send(unitroller, '_setPendingImplementation', [controller._address]);
    await send(controller, '_become', [unitroller._address]);
    mergeInterface(unitroller, controller);
    await send(unitroller, '_setLiquidationIncentive', [liquidationIncentive]);
    await send(unitroller, '_setCloseFactor', [closeFactor]);
    await send(unitroller, '_setFeeFactorMaxMantissa', [feeFactorMax]);
    await send(unitroller, '_setMaxAssets', [maxAssets]);
    await send(unitroller, '_setBorrowDelay', [borrowDelay]);

    return Object.assign(unitroller, { priceOracle, registryProxy });
  }

  if (kind == 'unitroller-g3') {
    const registryProxy = opts.registryProxy || await makeRegistryProxy(opts.registryProxyOpts);
    const unitroller = opts.unitroller || await deploy('Unitroller', [registryProxy._address]);
    const controller = await deploy('ControllerScenarioG3');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = etherMantissa(dfn(opts.closeFactor, .051));
    const feeFactorMax = etherMantissa(dfn(opts.feeFactorMax, 0.1));
    const maxAssets = etherUnsigned(dfn(opts.maxAssets, 10));
    const borrowDelay = etherUnsigned(dfn(opts.borrowDelay, 86400));
    const liquidationIncentive = etherMantissa(1);

    await send(unitroller, '_setPendingImplementation', [controller._address]);
    await send(controller, '_become', [unitroller._address]);
    mergeInterface(unitroller, controller);
    await send(unitroller, '_setLiquidationIncentive', [liquidationIncentive]);
    await send(unitroller, '_setCloseFactor', [closeFactor]);
    await send(unitroller, '_setFeeFactorMaxMantissa', [feeFactorMax]);
    await send(unitroller, '_setMaxAssets', [maxAssets]);
    await send(unitroller, '_setBorrowDelay', [borrowDelay]);

    return Object.assign(unitroller, { priceOracle, registryProxy });
  }

  if (kind == 'unitroller-g4') {
    const registryProxy = opts.registryProxy || await makeRegistryProxy(opts.registryProxyOpts);
    const unitroller = opts.unitroller || await deploy('Unitroller', [registryProxy._address]);
    const controller = await deploy('ControllerScenarioG4');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = etherMantissa(dfn(opts.closeFactor, .051));
    const maxAssets = etherUnsigned(dfn(opts.maxAssets, 10));
    const borrowDelay = etherUnsigned(dfn(opts.borrowDelay, 86400));
    const feeFactorMax = etherMantissa(dfn(opts.feeFactorMax, 0.1));
    const liquidationIncentive = etherMantissa(1);
    const pie = opts.pie || await deploy('Pie', [opts.pieOwner || root]);
    const pieRate = etherUnsigned(dfn(opts.pieRate, 1e18));

    await send(unitroller, '_setPendingImplementation', [controller._address]);
    await send(controller, '_become', [unitroller._address]);
    mergeInterface(unitroller, controller);
    await send(unitroller, '_setLiquidationIncentive', [liquidationIncentive]);
    await send(unitroller, '_setCloseFactor', [closeFactor]);
    await send(unitroller, '_setMaxAssets', [maxAssets]);
    await send(unitroller, '_setBorrowDelay', [borrowDelay]);
    await send(unitroller, '_setFeeFactorMaxMantissa', [feeFactorMax]);

    if (opts.distributorOpts === 'isNotSet') {
        return Object.assign(unitroller, { priceOracle, pie, registryProxy });
    }

    if (opts.distributorOpts === undefined) {
      opts.distributorOpts = {
          registryProxy: registryProxy,
          controller: unitroller
      }
    }

    const distributor = opts.distributor || await makeDistributor(opts.distributorOpts);

    await send(distributor, 'harnessSetPieRate', [pieRate]);
    await send(distributor, 'setPieAddress', [pie._address]); // harness only
    await send(unitroller, '_setDistributor', [distributor._address]);

    return Object.assign(unitroller, { priceOracle, pie, registryProxy, distributor });
  }

  if (kind == 'unitroller') {
    const registryProxy = opts.registryProxy || await makeRegistryProxy(opts.registryProxyOpts);
    const unitroller = opts.unitroller || await deploy('Unitroller', [registryProxy._address]);
    const controller = await deploy('ControllerHarness');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = etherMantissa(dfn(opts.closeFactor, .051));
    const feeFactorMax = etherMantissa(dfn(opts.feeFactorMax, 0.1));
    const maxAssets = etherUnsigned(dfn(opts.maxAssets, 10));
    const borrowDelay = etherUnsigned(dfn(opts.borrowDelay, 86400));
    const liquidationIncentive = etherMantissa(1);
    const pie = opts.pie || await deploy('Pie', [opts.pieOwner || root]);

    await send(unitroller, '_setPendingImplementation', [controller._address]);
    await send(controller, '_become', [unitroller._address]);
    mergeInterface(unitroller, controller);
    await send(unitroller, '_setLiquidationIncentive', [liquidationIncentive]);
    await send(unitroller, '_setCloseFactor', [closeFactor]);
    await send(unitroller, '_setFeeFactorMaxMantissa', [feeFactorMax]);
    await send(unitroller, '_setMaxAssets', [maxAssets]);
    await send(unitroller, '_setBorrowDelay', [borrowDelay]);

    if (opts.distributorOpts === 'isNotSet') {
      return Object.assign(unitroller, { priceOracle, pie, registryProxy });
    }

    const pieRate = etherUnsigned(dfn(opts.pieRate, 1e18));

    if (opts.distributorOpts === undefined) {
      opts.distributorOpts = {
          registryProxy: registryProxy,
          controller: unitroller
      }
    }

    const distributor = opts.distributor || await makeDistributor(opts.distributorOpts);

    await send(distributor, 'harnessSetPieRate', [pieRate]);
    await send(distributor, 'setPieAddress', [pie._address]); // harness only
    await send(unitroller, '_setDistributor', [distributor._address]);

    return Object.assign(unitroller, { priceOracle, pie, registryProxy, distributor });
  }
}

async function makePToken(opts = {}) {
  const {
    root = saddle.account,
    kind = 'perc20'
  } = opts || {};

  const interestRateModel = opts.interestRateModel || await makeInterestRateModel(opts.interestRateModelOpts);
  // for simple calculation by default in tests exchangeRate is 1e18, but in factory pToken decimals is 8 and underlying decimals is 18
  // then we have additional factor 1e10, thus exchangeRate by default value is 1e8, and 1e18 in factory
  const exchangeRate = etherMantissa(dfn(opts.exchangeRate, 0.0000000001));
  const reserveFactor = etherMantissa(dfn(opts.reserveFactor, 0.1));
  const symbol = opts.symbol || (kind === 'pether' ? 'pETH' : 'pOMG');
  const name = opts.name || `PToken ${symbol}`;

  const registryProxy = opts.registryProxy || await makeRegistryProxy(opts.registryProxyOpts);

  if (opts.controllerOpts === undefined) {
      opts.controllerOpts = {
          registryProxy: registryProxy
      }
  }

  const controller = opts.controller || await makeController(opts.controllerOpts);
  const mockPriceFeed = opts.mockPriceFeed || await deploy('MockPriceFeed');
  const mockUniswapV2Factory = opts.mockUniswapV2Factory || await deploy('MockUniswapV2Factory');
  const mockUniswapV2Pool = opts.mockUniswapV2Pool || await deploy('MockUniswapV2Pool', [mockUniswapV2Factory._address]);
  const WETHToken = opts.WETHToken || await makeToken();
  
  let tx = await send(mockUniswapV2Factory, 'setPair', [mockUniswapV2Pool._address]);
  let tx_ = await send(mockUniswapV2Factory, 'setPairExist', [true]);

  const priceOracle = opts.priceOracle || await deploy('PriceOracleMock', [
    mockPriceFeed._address
  ]);

  if (opts.priceOracle === undefined) {
      let tx = await send(priceOracle, '_setRegistry', [registryProxy._address]);

      const uniswapOracle = opts.uniswapOracle || await deploy('UniswapV2PriceOracleMock', [
          mockUniswapV2Factory._address,
          WETHToken._address
      ]);

      let tx0 = await send(uniswapOracle, '_setRegistry', [registryProxy._address]);
      let tx0_ = await send(priceOracle, '_addOracle', [uniswapOracle._address]);
  }

  let pToken, underlying;
  let pTokenFactory;
  let tokenAddress;
  let tx1, tx2, tx3;

  pTokenFactory = opts.pTokenFactory || await deploy('PTokenFactoryHarness', [
    registryProxy._address,
    controller._address,
    interestRateModel._address,
    exchangeRate,
    reserveFactor,
    0
  ]);

  tx2 = await send(registryProxy, '_setFactoryContract', [pTokenFactory._address]);
  let tx2_ = await send(registryProxy, '_setOracle', [priceOracle._address]);

  let token0, token1;

  switch (kind) {
    case 'pether':
      let pETHImplementation = await deploy('PEtherDelegateHarness');

      tx3 = await send(pTokenFactory, '_createPETH', [pETHImplementation._address, 'ETH']);
      tokenAddress = tx3.events['PTokenCreated'].returnValues['newPToken'];

      pToken = await saddle.getContractAt('PEtherDelegateHarness', tokenAddress);
      break;

    case 'ppie':
      underlying = opts.underlying || await makeToken(opts.underlyingOpts);
      token0 = await call(mockUniswapV2Pool, "token0");
      token1 = await call(mockUniswapV2Pool, "token1");

      if (token0 === '0x0000000000000000000000000000000000000000' || token1 === '0x0000000000000000000000000000000000000000') {
        await send(mockUniswapV2Pool, 'setData', [underlying._address, WETHToken._address]);
      }

      let pPIEImplementation = await deploy('PPIEDelegateHarness');

      tx3 = await send(pTokenFactory, '_createPPIE', [underlying._address, pPIEImplementation._address]);

      tokenAddress = tx3.events['PTokenCreated'].returnValues['newPToken'];

      pToken = await saddle.getContractAt('PPIEDelegateHarness', tokenAddress);
      break;

    case 'perc20':
    default:
      underlying = opts.underlying || await makeToken(opts.underlyingOpts);
      token0 = await call(mockUniswapV2Pool, "token0");
      token1 = await call(mockUniswapV2Pool, "token1");

      if (token0 === '0x0000000000000000000000000000000000000000' || token1 === '0x0000000000000000000000000000000000000000') {
        await send(mockUniswapV2Pool, 'setData', [underlying._address, WETHToken._address]);
      }

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
    await send(priceOracle, 'setUnderlyingPrice', [pToken._address, price]);
  }

  if (opts.collateralFactor) {
    const factor = etherMantissa(opts.collateralFactor);
    expect(await send(controller, '_setCollateralFactor', [pToken._address, factor])).toSucceed();
  }

  return Object.assign(pToken, { name, symbol, underlying, controller, pTokenFactory, interestRateModel });
}

async function makeInterestRateModel(opts = {}) {
  const {
    root = saddle.account,
    kind = 'harnessed',
    blocksPerYear = '2102400'
  } = opts || {};

  if (kind == 'harnessed') {
    const borrowRate = etherMantissa(dfn(opts.borrowRate, 0));
    return await deploy('InterestRateModelHarness', [borrowRate]);
  }

  if (kind == 'false-marker') {
    const borrowRate = etherMantissa(dfn(opts.borrowRate, 0));
    return await deploy('FalseMarkerMethodInterestRateModel', [borrowRate]);
  }

  if (kind == 'base-model') {
    const baseRate = etherMantissa(dfn(opts.baseRate, 0));
    const multiplier = etherMantissa(dfn(opts.multiplier, 1e-18));
    return await deploy('BaseInterestRateModel', [blocksPerYear, baseRate, multiplier]);
  }

  if (kind == 'jump-rate') {
    const baseRate = etherMantissa(dfn(opts.baseRate, 0));
    const multiplier = etherMantissa(dfn(opts.multiplier, 1e-18));
    const jump = etherMantissa(dfn(opts.jump, 0));
    const kink = etherMantissa(dfn(opts.kink, 0));
    return await deploy('JumpRateModel', [blocksPerYear, baseRate, multiplier, jump, kink]);
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

  if (kind == 'uniswap') {
      const registryProxy = opts.registryProxy || await makeRegistryProxy(opts.registryProxyOpts);
      const mockUniswapV2Factory = opts.mockUniswapV2Factory || await deploy('MockUniswapV2Factory');
      const mockUniswapV2Pool = opts.mockUniswapV2Pool || await deploy('MockUniswapV2Pool', [mockUniswapV2Factory._address]);
      const WETHToken = opts.WETHToken || await makeToken();

      let tx = await send(mockUniswapV2Factory, 'setPair', [mockUniswapV2Pool._address]);
      let tx_ = await send(mockUniswapV2Factory, 'setPairExist', [true]);

      const uniswapOracle = await deploy('UniswapV2PriceOracleMock', [
          mockUniswapV2Factory._address,
          WETHToken._address
      ]);

      let tx0 = await send(uniswapOracle, '_setRegistry', [registryProxy._address]);

      return uniswapOracle;
  }

  if (kind == 'uniswapV3') {
    const registryProxy = opts.registryProxy || await makeRegistryProxy(opts.registryProxyOpts);
    const mockPriceFeed = opts.mockPriceFeed || await deploy('MockPriceFeed');
    const mockUniswapV3Factory = opts.mockUniswapV3Factory || await deploy('MockUniswapV3Factory');
    const mockUniswapV3Pool = opts.mockUniswapV3Pool || await deploy('MockUniswapV3Pool');
    const WETHToken = opts.WETHToken || await makeToken();

    let tx = await send(mockUniswapV3Factory, 'setPair', [mockUniswapV3Pool._address]);

    const uniswapOracle = await deploy('UniswapV3PriceOracleMock', [
        mockUniswapV3Factory._address,
        WETHToken._address,
        mockPriceFeed._address
    ]);

    let tx0 = await send(uniswapOracle, '_setRegistry', [registryProxy._address]);

    return uniswapOracle;
  }
}

async function makeToken(opts = {}) {
  const {
    root = saddle.account,
    kind = 'erc20'
  } = opts || {};

  if (kind == 'erc20') {
    const quantity = etherUnsigned(dfn(opts.quantity, 1e26));
    const decimals = etherUnsigned(dfn(opts.decimals, 18));
    const symbol = opts.symbol || 'OMG';
    const name = opts.name || `Erc20 ${symbol}`;
    return await deploy('ERC20Harness', [quantity, name, decimals, symbol]);
  }

  if (kind == 'fee') {
      const quantity = etherUnsigned(dfn(opts.quantity, 1e25));
      const decimals = etherUnsigned(dfn(opts.decimals, 18));
      const symbol = opts.symbol || 'FEE';
      const name = opts.name || `Erc20 ${symbol}`;
      const basisPointFee = opts.basisPointFee || '100'; // 1%
      const owner = opts.owner || root;
      return await deploy('FeeToken', [quantity, name, decimals, symbol, basisPointFee, owner]);
  }
}

async function makePTokenFactory(opts = {}) {
    const {
        root = saddle.account
    } = opts || {};

    const registryProxy = opts.registryProxy || await makeRegistryProxy(opts.registryProxyOpts);

    if (opts.controllerOpts === undefined) {
        opts.controllerOpts = {
            registryProxy: registryProxy
        }
    }

    const controller = opts.controller || await makeController(opts.controllerOpts);
    const interestRateModel = opts.interestRateModel || await makeInterestRateModel(opts.interestRateModelOpts);
    const exchangeRate = etherMantissa(dfn(opts.exchangeRate, 1));
    const reserveFactor = etherMantissa(dfn(opts.reserveFactor, 0.1));

    let pTokenFactory;
    const mockPriceFeed = opts.mockPriceFeed || await deploy('MockPriceFeed');
    const mockUniswapV2Factory = opts.mockUniswapV2Factory || await deploy('MockUniswapV2Factory');
    const mockUniswapV2Pool = opts.mockUniswapV2Pool || await deploy('MockUniswapV2Pool', [mockUniswapV2Factory._address]);
    let tx = await send(mockUniswapV2Factory, 'setPair', [mockUniswapV2Pool._address]);
    let tx_ = await send(mockUniswapV2Factory, 'setPairExist', [true]);

    const priceOracle = opts.priceOracle || await deploy('PriceOracleMock', [
        mockPriceFeed._address
    ]);

    if (opts.priceOracle === undefined) {
        let tx = await send(priceOracle, '_setRegistry', [registryProxy._address]);

        const uniswapOracle = opts.uniswapOracle || await deploy('UniswapV2PriceOracleMock', [
            mockUniswapV2Factory._address,
            mockUniswapV2Pool._address
        ]);

        let tx0 = await send(uniswapOracle, '_setRegistry', [registryProxy._address]);
        let tx0_ = await send(priceOracle, '_addOracle', [uniswapOracle._address]);
    }

    pTokenFactory = await deploy('PTokenFactoryHarness', [
        registryProxy._address,
        controller._address,
        interestRateModel._address,
        exchangeRate,
        reserveFactor,
        0
    ]);

    let tx2 = await send(registryProxy, '_setFactoryContract', [pTokenFactory._address]);
    let tx2_ = await send(registryProxy, '_setOracle', [priceOracle._address]);

    pTokenFactory = await saddle.getContractAt('PTokenFactoryHarness', pTokenFactory._address);

    return pTokenFactory;
}

async function makeRegistryProxy(opts = {}) {
    const {
        root = saddle.account
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

async function makeVotingEscrow(opts = {}) {
    const {
        root = saddle.account
    } = opts || {};

    const registryProxy = opts.registryProxy || await makeRegistryProxy();
    const token = opts.token || await makeToken();
    const name = opts.name || 'Voting Escrow PIE token';
    const symbol = opts.symbol || "VEPIE";
    const interval = opts.interval || etherUnsigned(604800);
    const minDuration = opts.minDuration || etherUnsigned(604800);
    const maxDuration = opts.maxDuration || etherUnsigned(125798400);
    const minLockAmount = opts.minLockAmount || etherUnsigned(1e21);
    const governor = opts.governor || root;

    let votingEscrow;

    votingEscrow = await deploy('VotingEscrowHarness', [
        registryProxy._address,
        token._address,
        name,
        symbol,
        interval,
        minDuration,
        maxDuration,
        minLockAmount,
        governor
    ]);

    votingEscrow = await saddle.getContractAt('VotingEscrowHarness', votingEscrow._address);

    return Object.assign(votingEscrow, { token, registryProxy });
}

async function makeDistributor(opts = {}) {
    const {
        root = saddle.account
    } = opts || {};

    // console.log('opts', opts)
    const implementation = opts.implementation || await deploy('Distributor');
    const registryProxy = opts.registryProxy || await makeRegistryProxy(opts.registryProxyOpts);

    if (opts.controllerOpts === undefined) {
        opts.controllerOpts = {
            registryProxy: registryProxy
        }
    }

    if (opts.controllerOpts.distributorOpts === undefined) {
        opts.controllerOpts.distributorOpts = 'isNotSet';
    }

    const controller = opts.controller || await makeController(opts.controllerOpts);
    let distributor = await deploy('DistributorHarness');

    const pieRate = etherUnsigned(dfn(opts.pieRate, 1e18));
    const pie = opts.pie || controller.pie || await deploy('Pie', [opts.pieOwner || root]);

    await send(distributor, 'harnessSetPieRate', [pieRate]);
    await send(distributor, 'setPieAddress', [pie._address]); // harness only
    await send(distributor, 'init', [implementation._address, registryProxy._address, controller._address]); // harness only
    await send(controller, '_setDistributor', [distributor._address]);

    return Object.assign(distributor, { controller, pie, registryProxy });
}

async function makeProxyProtocol(opts = {}) {
    const {
        root = saddle.account
    } = opts || {};

    const pTokenFactory = opts.pTokenFactory || await makePTokenFactory();
    const pETH = opts.pETH || await makePToken({kind: 'pether'});
    const maximillion = opts.maximillion || await deploy('Maximillion', [pETH._address]);
    const admin = opts.admin || root;
    const feeToken = opts.feeToken || await deploy('PErc20DelegateHarness');
    const feeRecipient = opts.feeRecipient || root;
    const feeAmountCreatePool = opts.feeAmountCreatePool || '0';
    const feePercentMint = opts.feePercentMint || '0';
    const feePercentRepayBorrow = opts.feePercentRepayBorrow || '0';

    let proxyProtocol;

    proxyProtocol = await deploy('ProxyProtocolHarness', [
        pTokenFactory._address,
        pETH._address,
        maximillion._address,
        admin,
        feeToken._address,
        feeRecipient,
        feeAmountCreatePool,
        feePercentMint,
        feePercentRepayBorrow
    ]);

    proxyProtocol = await saddle.getContractAt('ProxyProtocolHarness', proxyProtocol._address);

    return proxyProtocol;
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
    balances[pToken._address][account][key] = balances[pToken._address][account][key].plus(diff);
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
  makeProxyProtocol,
  makeDistributor,
  makeVotingEscrow,

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
  pretendBorrow,

  etherBalance
};
