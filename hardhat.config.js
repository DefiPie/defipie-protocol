require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-ethers");
require("dotenv/config");

const fs = require('fs');
const privateKey = fs.readFileSync(".secretKey").toString().trim();

module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            allowUnlimitedContractSize: true
        },
        rinkeby: {
            url: "https://rinkeby.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
            accounts: [privateKey],
            gasPrice: 3e9,
            gasLimit: 8000000,
            confirmations: 10,
            timeoutBlocks: 1000,
            network_id: "4"
        },
        mainnet: {
            url: "https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
            accounts: [privateKey],
            gasPrice: 2e9,
            network_id: "1"
        },
        mumbai: {
            url: "https://rpc-mumbai.maticvigil.com",
            accounts: [privateKey],
            gasPrice: 2e9,
            confirmations: 7,
            skipDryRun: true
        },
        matic: {
            url: "https://rpc-mainnet.matic.quiknode.pro",
            accounts: [privateKey],
            gasPrice: 10e9,
            network_id: "137",
            skipDryRun: true
        },
        bsc: {
            url: "https://bsc-dataseed1.ninicoin.io/",
            // port: 8575, for local node use this port and host: "127.0.0.1",
            accounts: [privateKey],
            gasLimit: 8000000,
            network_id: "56",
            confirmations: 7,
            timeoutBlocks: 700,
            skipDryRun: true
        },
        bsctestnet: {
            url: "http://127.0.0.1:8575",
            // port: 8575, for local node use this port and host: "127.0.0.1",
            accounts: "remote",
            gasLimit: 8000000,
            network_id: "97",
            confirmations: 7,
            skipDryRun: true
        },
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
    etherscan: {
        apiKey: process.env.SCAN_API_KEY
    },
    mocha: {
        timeout: 30000
    }
};