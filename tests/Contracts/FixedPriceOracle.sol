// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "../../contracts/Oracles/PriceOracle.sol";

contract FixedPriceOracle is PriceOracleProxyStorage, IPriceOracle {
    uint public price;
    uint underlyingType = uint(IPriceOracle.UnderlyingType.RegularAsset);
    uint112 public liquidity = 1000000000000000000;

    constructor(uint _price) {
        price = _price;
    }

    function initialize(address) public {
        price = 1e18;
    }

    function getUnderlyingPrice(address) public view override returns (uint) {
        return price;
    }

    function assetPrices(address) public view returns (uint) {
        return price;
    }

    function updateUnderlyingPrice(address) external override returns (uint) {
        return 0;
    }

    function setPrice(uint _price) public {
        price = _price;
    }

    function setUnderlyingPrice(address, uint _price) public {
        price = _price;
    }

    function getUnderlyingTypeAndLiquidity(address asset) public view returns (uint, uint112) {
        return (underlyingType, liquidity);
    }
    
    function setUnderlyingTypeAndLiquidity(uint underlyingType_, uint112 liquidity_) public {
        underlyingType = underlyingType_;
        liquidity = liquidity_;
    }
}

contract FixedPriceOracleV2 is IPriceOracle {
    mapping(address => uint) public underlyingPrice;
    mapping(address => uint) public price;
    uint underlyingType = uint(IPriceOracle.UnderlyingType.RegularAsset);
    uint112 public reserves = 1000000000000000000;
    address public pair = address(1);
    uint112 public liquidity = 1000000000000000000;

    function getUnderlyingPrice(address pToken) public view override returns (uint) {
        return underlyingPrice[pToken];
    }

    function setUnderlyingPrice(address pToken, uint price_) public {
        underlyingPrice[pToken] = price_;
    }

    function getPrice(address asset) public view returns (uint) {
        return price[asset];
    }

    function setPrice(address asset, uint price_) public {
        price[asset] = price_;
    }

    function searchPair(address asset) public view returns (address, address, uint112) {
        asset;//
        return (address(this), pair, uint112(reserves));
    }

    function setSearchPair(address pair_, uint112 reserves_) public {
        pair = pair_;
        reserves = reserves_;
    }

    function _setRegistry(address _registry) public {
        _registry; //
    }

    function update(address) public returns (uint) {
        return 0;
    }

    function updateUnderlyingPrice(address pToken) external override returns (uint) {
        pToken; //shh
        return 0;
    }

    function getUnderlyingTypeAndLiquidity(address asset) public view returns (uint, uint112) {
        return (underlyingType, liquidity);
    }

    function setUnderlyingTypeAndLiquidity(uint underlyingType_, uint112 liquidity_) public {
        underlyingType = underlyingType_;
        liquidity = liquidity_;
    }
}

contract FixedUniswapPriceOracle is IPriceOracle {
    mapping(address => uint) public underlyingPrice;
    mapping(address => uint) public price;
    uint underlyingType = uint(IPriceOracle.UnderlyingType.RegularAsset);
    uint112 public liquidity = 1000000000000000000;
    address public pair;
    uint112 public reserves = 10000000;

    function getUnderlyingPrice(address pToken) public view override returns (uint) {
        return underlyingPrice[pToken];
    }

    function setUnderlyingPrice(address pToken, uint price_) public {
        underlyingPrice[pToken] = price_;
    }

    function getPrice(address asset) public view returns (uint) {
        return price[asset];
    }

    function setPrice(address asset, uint price_) public {
        price[asset] = price_;
    }

    function searchPair(address asset) public view returns (address, uint112) {
        asset;//
        return (pair, uint112(reserves));
    }

    function setSearchPair(address pair_, uint112 reserves_) public {
        pair = pair_;
        reserves = reserves_;
    }

    function _setRegistry(address _registry) public {
        _registry; //
    }

    function update(address asset) public returns (uint) {
        asset;//
        return 0;
    }

    function updateUnderlyingPrice(address pToken) external override returns (uint) {
        pToken; //shh
        return 0;
    }

    function getUnderlyingTypeAndLiquidity(address asset) public view returns (uint, uint112) {
        return (underlyingType, liquidity);
    }

    function setUnderlyingTypeAndLiquidity(uint underlyingType_, uint112 liquidity_) public {
        underlyingType = underlyingType_;
        liquidity = liquidity_;
    }
}
