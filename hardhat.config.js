require("@nomiclabs/hardhat-ethers");
const fs = require('fs');
const privateKey = fs.readFileSync(".secretKey").toString().trim();

module.exports = {
    defaultNetwork: "mumbai",
    networks: {
        hardhat: {
        },
        mumbai: {
            url: "https://rpc-mumbai.maticvigil.com",
            accounts: [privateKey],
            gasPrice: 2e9
        },
        matic: {
            url: "https://rpc-mainnet.matic.quiknode.pro",
            accounts: [privateKey],
            gasPrice: 10e9,
            network_id: "137", // Match any network id,
            confirmations: 5,
            timeoutBlocks: 200,
            skipDryRun: true
        }
    },
    solidity: {
        version: "0.7.6",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },

    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts"
    },

    mocha: {
        timeout: 20000
    }
};