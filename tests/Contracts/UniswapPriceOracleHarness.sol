// SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;
pragma experimental ABIEncoderV2;

import '../../contracts/UniswapPriceOracle.sol';

contract UniswapPriceOracleHarness is UniswapPriceOracle {
    constructor(
        address registryProxy_,
        address uniswapFactory_,
        address WETHUniswap_,
        address ETHUSDPriceFeed_
    ) {
        initialize(
            registryProxy_,
            uniswapFactory_,
            WETHUniswap_,
            ETHUSDPriceFeed_
        );
    }
}

contract UniswapPriceOracleMock is UniswapPriceOracle {
    constructor(
        address registryProxy_,
        address uniswapFactory_,
        address WETHUniswap_,
        address ETHUSDPriceFeed_
    ) {
        initialize(
            registryProxy_,
            uniswapFactory_,
            WETHUniswap_,
            ETHUSDPriceFeed_
        );
    }

    function getPriceInUSD(address asset) public view override returns (uint) {
        return 0;
    }
}
