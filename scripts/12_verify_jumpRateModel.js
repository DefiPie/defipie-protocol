// $ npx hardhat run scripts/12_verify_jumpRateModel.js --network rinkeby
const hre = require("hardhat");
const dotenv = require('dotenv');
const network = hre.network.name;
const fs = require('fs');
const envConfig = dotenv.parse(fs.readFileSync(`.env`));
for (const k in envConfig) {
    process.env[k] = envConfig[k]
}

async function main() {
    // Get addresses from file

    let dir = './networks/';
    const fileName = network + '.json';
    let data = JSON.parse(await fs.readFileSync(dir + fileName, { encoding: 'utf8' }));

    // Verify block

    // Pie contract verify
    try {
        await hre.run("verify:verify", {
            address: data.jumpRateModel,
            constructorArguments: [
                process.env.JRM_RINKEBY_BLOCKS_PER_YEAR,
                process.env.JRM_RINKEBY_BASE_RATE_PER_YEAR,
                process.env.JRM_RINKEBY_MULTIPLIER_RATE_PER_YEAR,
                process.env.JRM_RINKEBY_JUMP_MULTIPLIER_PER_YEAR,
                process.env.JRM_RINKEBY_KINK
            ],
        });
    } catch (e) {
        console.log(e);
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });