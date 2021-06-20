var HDWalletProvider = require("truffle-hdwallet-provider");

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
      bscscan: 'YTYHJVFBXJT82PZ6Z84BR6XAGIGNPRRVJH'
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
    bsc: {
      host: "127.0.0.1",
      port: 8575,
      network_id: "56", // Match any network id,
      confirmations: 5,
      timeoutBlocks: 200,
      skipDryRun: true,
      gasPrice: 5000000000
    },
    bsctestnet: {
      host: "127.0.0.1",
      port: 8575,
      network_id: "97", // Match any network id,
      confirmations: 5,
      timeoutBlocks: 200,
      skipDryRun: true
    }
  }
};
