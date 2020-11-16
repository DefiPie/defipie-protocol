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
