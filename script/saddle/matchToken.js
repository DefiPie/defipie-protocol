let { loadAddress, loadConf } = require('./support/tokenConfig');

function printUsage() {
  console.log(`
usage: npx saddle script token:match address {tokenConfig}

This checks to see if the deployed byte-code matches this version of the DeFiPie Protocol.

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

  console.log(`Matching pToken at ${address} with ${JSON.stringify(conf)}`);

  let deployArgs = [conf.underlying, conf.controller, conf.interestRateModel, conf.initialExchangeRateMantissa.toString(), conf.name, conf.symbol, conf.decimals, conf.admin];

  await saddle.match(address, 'CErc20Immutable', deployArgs);

  return {
    ...conf,
    address
  };
})();
