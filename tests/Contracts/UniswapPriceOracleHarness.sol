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
    mapping(address => uint) public priceInUSD;
    mapping(address => uint) public underlyingPriceInUSD;

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

    function setPriceInUSD(address asset, uint priceInUSD_) public {
        priceInUSD[asset] = priceInUSD_;
    }

    function getPriceInUSD(address asset) public view override returns (uint) {
        return priceInUSD[asset];
    }

    function setUnderlyingPrice(address pToken, uint priceInUSD_) public {
        underlyingPriceInUSD[pToken] = priceInUSD_;
    }

    function getUnderlyingPrice(address pToken) public view override returns (uint) {
        return underlyingPriceInUSD[pToken];
    }
}
