// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

import '../../contracts/UniswapV2PriceOracle.sol';
import '../../contracts/UniswapV3PriceOracle.sol';
import '../../contracts/PriceOracle.sol';

contract UniswapV2PriceOracleHarness is UniswapV2PriceOracle {

    constructor(
        address uniswapFactory_,
        address WETHToken_
    ) {
        initialize(
            uniswapFactory_,
            WETHToken_
        );
    }

    function setPreviousTimeStampForAsset(address asset_, uint32 blockTimeStamp_) public {
        cumulativePrices[assetPair[asset_]][asset_].blockTimeStampPrevious = blockTimeStamp_;
    }

    function _setRegistry(address _registry) public {
        registry = _registry;
    }
}

contract UniswapV2PriceOracleMock is UniswapV2PriceOracle {
    mapping(address => uint) public priceInUSD;
    mapping(address => uint) public underlyingPriceInUSD;

    constructor(
        address uniswapFactory_,
        address WETHToken_
    ) {
        initialize(
            uniswapFactory_,
            WETHToken_
        );
    }

    function setPriceInUSD(address asset, uint priceInUSD_) public {
        priceInUSD[asset] = priceInUSD_;
    }

    function getPriceInUSD(address asset) public view returns (uint) {
        return priceInUSD[asset];
    }

    function setUnderlyingPrice(address pToken, uint priceInUSD_) public {
        underlyingPriceInUSD[pToken] = priceInUSD_;
    }

    function getUnderlyingPrice(address pToken) public view returns (uint) {
        if (pToken == Registry(registry).pETH()) {
            return 1000000000000000000;
        }

        return underlyingPriceInUSD[pToken];
    }

    function _setRegistry(address _registry) public {
        registry = _registry;
    }
}

contract UniswapV3PriceOracleHarness is UniswapV3PriceOracle {

    constructor(
        address uniswapFactory_,
        address WETHToken_
    ) {
        initialize(
            uniswapFactory_,
            WETHToken_
        );
    }

    function _setRegistry(address _registry) public {
        registry = _registry;
    }
}

contract UniswapV3PriceOracleMock is UniswapV3PriceOracle {
    mapping(address => uint) public priceInUSD;
    mapping(address => uint) public underlyingPriceInUSD;

    constructor(
        address uniswapFactory_,
        address WETHToken_
    ) {
        initialize(
            uniswapFactory_,
            WETHToken_
        );
    }

    function setPriceInUSD(address asset, uint priceInUSD_) public {
        priceInUSD[asset] = priceInUSD_;
    }

    function getPriceInUSD(address asset) public view returns (uint) {
        return priceInUSD[asset];
    }

    function setUnderlyingPrice(address pToken, uint priceInUSD_) public {
        underlyingPriceInUSD[pToken] = priceInUSD_;
    }

    function getUnderlyingPrice(address pToken) public view returns (uint) {
        if (pToken == Registry(registry).pETH()) {
            return 1000000000000000000;
        }

        return underlyingPriceInUSD[pToken];
    }

    function _setRegistry(address _registry) public {
        registry = _registry;
    }
}

contract PriceOracleHarness is PriceOracle {

    constructor(
        address mockPriceFeed_
    ) {
        initialize(
            mockPriceFeed_
        );
    }

    function _setRegistry(address _registry) public {
        registry = _registry;
    }
}

contract PriceOracleMock is PriceOracle {
    mapping(address => uint) public priceInUSD;
    mapping(address => uint) public underlyingPriceInUSD;

    constructor(
        address mockPriceFeed_
    ) {
        initialize(
            mockPriceFeed_
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
        if (pToken == RegistryInterface(registry).pETH()) {
            return 1000000000000000000;
        }

        return underlyingPriceInUSD[pToken];
    }

    function _setRegistry(address _registry) public {
        registry = _registry;
    }
}