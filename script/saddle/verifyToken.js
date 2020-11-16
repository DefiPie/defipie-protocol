let { loadAddress, loadConf } = require('./support/tokenConfig');

function printUsage() {
  console.log(`
usage: npx saddle script token:verify {tokenAddress} {tokenConfig}

note: $ETHERSCAN_API_KEY environment variable must be set to an Etherscan API Key.

example:

npx saddle -n ropsten script token:deploy '{
  "underlying": "0x516de3a7a567d81737e3a46ec4ff9cfd1fcb0136",
  "controller": "$Controller",
  "interestRateModel": "$Base200bps_Slope3000bps",
  "initialExchangeRateMantissa": "2.0e18",
  "name": "DeFiPie USDT",
  "symbol": "pUSDT",
  "decimals": "18",
  "admin": "$Timelock"
}'
  `);
}

(async function() {
  if (args.length !== 2) {
    return printUsage();
  }

  let address = loadAddress(args[0], addresses);
  let conf = loadConf(args[1], addresses);
  if (!conf) {
    return printUsage();
  }
  let etherscanApiKey = env['ETHERSCAN_API_KEY'];
  if (!etherscanApiKey) {
    console.error("Missing required $ETHERSCAN_API_KEY env variable.");
    return printUsage();
  }

  console.log(`Verifying pToken at ${address} with ${JSON.stringify(conf)}`);

  let deployArgs = [conf.underlying, conf.controller, conf.interestRateModel, conf.initialExchangeRateMantissa.toString(), conf.name, conf.symbol, conf.decimals, conf.admin];

  // TODO: Make sure we match optimizations count, etc
  await saddle.verify(etherscanApiKey, address, 'CErc20Immutable', deployArgs, 200, undefined);

  console.log(`Contract verified at https://${network}.etherscan.io/address/${address}`);

  return {
    ...conf,
    address
  };
})();
