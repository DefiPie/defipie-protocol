pragma solidity ^0.7.6;
pragma abicoder v2;

import '../../contracts/UniswapPriceOracle.sol';

contract UniswapPriceOracleHarness is UniswapPriceOracle {

    constructor(
        address uniswapFactory_,
        address WETHUniswap_,
        address ETHUSDPriceFeed_
    ) {
        initialize(
            uniswapFactory_,
            WETHUniswap_,
            ETHUSDPriceFeed_
        );
    }

    function setPreviousTimeStampForAsset(address asset_, uint32 blockTimeStamp_) public {
        cumulativePrices[assetPair[asset_]][asset_].blockTimeStampPrevious = blockTimeStamp_;
    }

    function _setRegistry(address _registry) public {
        registry = _registry;
    }
}

contract UniswapPriceOracleMock is UniswapPriceOracle {
    mapping(address => uint) public priceInUSD;
    mapping(address => uint) public underlyingPriceInUSD;

    constructor(
        address uniswapFactory_,
        address WETHUniswap_,
        address ETHUSDPriceFeed_
    ) {
        initialize(
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

    function _setRegistry(address _registry) public {
        registry = _registry;
    }
}
