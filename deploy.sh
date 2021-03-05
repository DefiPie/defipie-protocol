npx saddle deploy StandardToken 220000000000000000000000000 "DeFiPIE Token" 18 "PIE"
npx saddle deploy PErc20Delegate
npx saddle deploy PPIEDelegate
npx saddle deploy PEtherDelegate
npx saddle deploy Controller
npx saddle deploy Unitroller
npx saddle deploy BaseInterestRateModel 20000000000000000 850000000000000000
npx saddle deploy Registry
npx saddle deploy RegistryProxy "$Registry" "$PErc20Delegate"
npx saddle deploy UniswapPriceOracle
npx saddle deploy UniswapPriceOracleProxy "$UniswapPriceOracle" "$RegistryProxy" "0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f" "0xc778417e063141139fce010982780140aa0cd5ab" "0x8A753747A1Fa494EC906cE90E9f37563A8AF630e"
npx saddle deploy PTokenFactory "$RegistryProxy" 1000000000000000000 "$UniswapPriceOracleProxy" "$Unitroller" "$BaseInterestRateModel" 20000000000000000 100000000000000000
npx saddle deploy Maximillion "$PEther"
npx saddle deploy ClaimCalc "$Unitroller"

npx -n --experimental-repl-await saddle console

await unitroller.methods._setPendingImplementation(controller._address).send()
await controller.methods._become(unitroller._address).send()
let unitroller1 = new web3.eth.Contract(controller._jsonInterface, unitroller._address)
await unitroller1.methods._setPriceOracle(uniswapPriceOracleProxy._address).send({ from: "$from" })
await unitroller1.methods._setFactoryContract(pTokenFactory._address).send({ from: "$from" })
await unitroller1.methods._setLiquidationIncentive('1080000000000000000').send({ from: "$from" })
await unitroller1.methods._setMaxAssets(20).send({ from: "$from" })
await unitroller1.methods._setCloseFactor('500000000000000000').send({ from: "$from" })
let registry1 = new web3.eth.Contract(registry._jsonInterface, registryProxy._address)
await registry1.methods._setFactoryContract(pTokenFactory._address).send({ from: "$from" })
await pTokenFactory.methods.createPETH(pEtherDelegate._address).send()
await pTokenFactory.methods.createPPIE("0xb36afc9f38d8ac6f991bb9939d3ee8d45a7a1285", pPIEDelegate._address).send()