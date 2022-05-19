// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import '../../contracts/Oracles/PriceOracleProxy.sol';

contract PriceOracleProxyHarness is PriceOracleProxy {
    constructor(
        address implementation_,
        address registry_,
        address ethPriceFeed_
    ) PriceOracleProxy(
        implementation_,
        registry_,
        ethPriceFeed_
    ) {}

    function updateUnderlyingPrice(address) external returns (uint)  {
        delegateAndReturn();
    }

    function update(address) public returns (uint) {
        delegateAndReturn();
    }

    function getPriceInUSD(address) public returns (uint) {
        delegateAndReturn();
    }

    function getUnderlyingPrice(address) public returns (uint) {
        delegateAndReturn();
    }

    function searchPair(address) public returns (address, address, uint112) {
        delegateAndReturn();
    }

    function getMyAdmin() public returns (address) {
        delegateAndReturn();
    }

    function isPeriodElapsed(address ) public returns (bool)  {
        delegateAndReturn();
    }

    function _addOracle(address) public returns (uint) {
        delegateAndReturn();
    }

    function _removeOracle(uint) public returns (uint) {
        delegateAndReturn();
    }

    function _updateOracle(uint, address) public returns (uint) {
        delegateAndReturn();
    }

    function _updateAssetOracle(address, address) public returns (uint) {
        delegateAndReturn();
    }

    function checkAndUpdateAllNewAssets() public {
        delegateAndReturn();
    }

    function isNewAsset(address) public returns (bool) {
        delegateAndReturn();
    }

    function getAllPriceOracles() public returns (address[] memory) {
        delegateAndReturn();
    }

    function updateNewAssets(address[] memory) public {
        delegateAndReturn();
    }

    function getPriceOraclesLength() public returns (uint) {
        delegateAndReturn();
    }

    function setDirectPrice(address, uint) public {
        delegateAndReturn();
    }

    function setUnderlyingPrice(address, uint) public  {
        delegateAndReturn();
    }

    function assetPrices(address) external returns (uint) {
        delegateAndReturn();
    }

    function _setRegistry(address) public {
        delegateAndReturn();
    }
}