var HDWalletProvider = require("@truffle/hdwallet-provider");
const fs = require('fs');
const mnemonic = fs.readFileSync(".secretPhrase").toString().trim();
const privateKey = fs.readFileSync(".secretKey").toString().trim();
let privateKeys = [];
privateKeys[0] = privateKey;

module.exports = {
  compilers: {
      solc: {
        version: "0.7.6",    // Fetch exact version from solc-bin (default: truffle's version)
        // docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
        settings: {          // See the solidity docs for advice about optimization and evmVersion
         optimizer: {
           enabled: true,
           runs: 200
         },
         // evmVersion: "byzantium"
        }
      }
    },
  plugins: ['truffle-plugin-verify'],

  api_keys: {
      bscscan: 'YTYHJVFBXJT82PZ6Z84BR6XAGIGNPRRVJH',
      polygonscan: 'BK5G8JANY99Z9VS7H9G54S9SX1UEW6XXFP'
  },

  // See <http://truffleframework.com/docs/advanced/configuration>
  // for more about customizing your Truffle configuration!
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*" // Match any network id
    },
    // testnet: {
    //   provider: () => new HDWalletProvider(mnemonic, `https://data-seed-prebsc-1-s1.binance.org:8545`),
    //   network_id: 97,
    //   timeoutBlocks: 200,
    //   confirmations: 5
    // },
    // bsc: {
    //   host: "127.0.0.1",
    //   port: 8575,
    //   network_id: "56", // Match any network id,
    //   confirmations: 5,
    //   timeoutBlocks: 200,
    //   skipDryRun: true
    // },
    // bsctestnet: {
    //   host: "127.0.0.1",
    //   port: 8575,
    //   network_id: "97", // Match any network id,
    //   confirmations: 5,
    //   timeoutBlocks: 200,
    //   skipDryRun: true
    // },
    mumbai: {
      provider: () => new HDWalletProvider(mnemonic, `https://rpc-mumbai.matic.today`),
      network_id: 80001,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true
    },
      matic: {
          provider: () => new HDWalletProvider({
              privateKeys: privateKeys,
              providerOrUrl: `https://rpc-mainnet.matic.network`
          }),
          gasPrice: 2e9,
          network_id: 137, // Match any network id,
          confirmations: 5,
          timeoutBlocks: 200,
          skipDryRun: true
      }
  }
};
