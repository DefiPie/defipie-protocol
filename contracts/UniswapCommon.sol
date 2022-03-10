// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "./ErrorReporter.sol";
import "./RegistryInterface.sol";
import "./PTokenInterfaces.sol";

contract UniswapProxyStorage {
    address public implementation;
    address public registry;
}

contract UniswapCommonStorage {
    address public WETHToken;
    uint public period;

    // asset => pair with reserves
    mapping(address => address) public assetPair;

    address[] public poolFactories;
    address[] public stableCoins;

    uint public minReserveLiquidity;
}

abstract contract UniswapCommon is UniswapProxyStorage, UniswapCommonStorage, OracleErrorReporter  {
    event PoolAdded(uint id, address poolFactory);
    event PoolRemoved(uint id, address poolFactory);
    event PoolUpdated(uint id, address poolFactory);

    event StableCoinAdded(uint id, address coin);
    event StableCoinRemoved(uint id, address coin);
    event StableCoinUpdated(uint id, address coin);

    event PriceUpdated(address asset, uint price); // price in eth

    function getCourseInETH(address asset) public view virtual returns (uint);

    function update(address asset) public virtual returns(uint);

    function searchPair(address asset) public view virtual returns (address, uint112);

    function getMyAdmin() public view returns (address) {
        return RegistryInterface(registry).admin();
    }

    function _setNewWETHAddress(address WETHToken_) external returns (uint) {
        // Check caller = admin
        if (msg.sender != getMyAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.UPDATE_DATA);
        }

        WETHToken = WETHToken_;

        return uint(Error.NO_ERROR);
    }

    function _setNewRegistry(address registry_) external returns (uint) {
        // Check caller = admin
        if (msg.sender != getMyAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.UPDATE_DATA);
        }

        registry = registry_;

        return uint(Error.NO_ERROR);
    }

    function _setPeriod(uint period_) public returns (uint) {
        // Check caller = admin
        if (msg.sender != getMyAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.UPDATE_DATA);
        }

        period = period_;

        return uint(Error.NO_ERROR);
    }

    function _setMinReserveLiquidity(uint minReserveLiquidity_) public returns (uint) {
        if (msg.sender != getMyAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.UPDATE_DATA);
        }

        minReserveLiquidity = minReserveLiquidity_;

        return uint(Error.NO_ERROR);
    }

    function _addPool(address poolFactory_) public returns (uint) {
        // Check caller = admin
        if (msg.sender != getMyAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.ADD_POOL_OR_COIN);
        }

        require(
            poolFactory_ != address(0)
        , 'Oracle: invalid address for factory'
        );

        for (uint i = 0; i < poolFactories.length; i++) {
            if (poolFactories[i] == poolFactory_) {
                return fail(Error.POOL_OR_COIN_EXIST, FailureInfo.ADD_POOL_OR_COIN);
            }
        }

        poolFactories.push(poolFactory_);
        uint poolId = poolFactories.length - 1;

        emit PoolAdded(poolId, poolFactory_);

        return uint(Error.NO_ERROR);
    }

    function _removePool(uint poolId) public returns (uint) {
        // Check caller = admin
        if (msg.sender != getMyAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.UPDATE_DATA);
        }

        require(
            poolFactories.length > 1
        , 'Oracle: must have one pool'
        );

        uint lastId = poolFactories.length - 1;

        address factory = poolFactories[lastId];
        poolFactories.pop();
        emit PoolRemoved(lastId, factory);

        if (lastId != poolId) {
            poolFactories[poolId] = factory;
            emit PoolUpdated(poolId, factory);
        }

        return uint(Error.NO_ERROR);
    }

    function _updatePool(uint poolId, address poolFactory_) public returns (uint) {
        // Check caller = admin
        if (msg.sender != getMyAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.UPDATE_DATA);
        }

        require(
            poolFactory_ != address(0)
            , 'Oracle: invalid address for factory'
        );

        for (uint i = 0; i < poolFactories.length; i++) {
            if (poolFactories[i] == poolFactory_) {
                return fail(Error.POOL_OR_COIN_EXIST, FailureInfo.UPDATE_DATA);
            }
        }

        poolFactories[poolId] = poolFactory_;

        emit PoolUpdated(poolId, poolFactory_);

        return uint(Error.NO_ERROR);
    }

    function _addStableCoin(address stableCoin_) public returns (uint) {
        // Check caller = admin
        if (msg.sender != getMyAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.ADD_POOL_OR_COIN);
        }

        require(
            stableCoin_ != address(0)
            , 'Oracle: invalid address for stable coin'
        );

        for (uint i = 0; i < stableCoins.length; i++) {
            if (stableCoins[i] == stableCoin_) {
                return fail(Error.POOL_OR_COIN_EXIST, FailureInfo.ADD_POOL_OR_COIN);
            }
        }

        stableCoins.push(stableCoin_);

        emit StableCoinAdded(stableCoins.length - 1, stableCoin_);

        return uint(Error.NO_ERROR);
    }

    function _removeStableCoin(uint coinId) public returns (uint) {
        // Check caller = admin
        if (msg.sender != getMyAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.UPDATE_DATA);
        }

        require(
            stableCoins.length > coinId
        , 'Oracle: stable coins are empty'
        );


        uint lastId = stableCoins.length - 1;

        address stableCoin = stableCoins[lastId];
        stableCoins.pop();
        emit StableCoinRemoved(lastId, stableCoin);

        if (lastId != coinId) {
            stableCoins[coinId] = stableCoin;
            emit StableCoinUpdated(coinId, stableCoin);
        }

        return uint(Error.NO_ERROR);
    }

    function _updateStableCoin(uint coinId, address stableCoin_) public returns (uint) {
        // Check caller = admin
        if (msg.sender != getMyAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.UPDATE_DATA);
        }

        require(
            stableCoin_ != address(0)
        , 'Oracle: invalid address for stable coin'
        );

        for (uint i = 0; i < stableCoins.length; i++) {
            if (stableCoins[i] == stableCoin_) {
                return fail(Error.POOL_OR_COIN_EXIST, FailureInfo.UPDATE_DATA);
            }
        }

        stableCoins[coinId] = stableCoin_;

        emit StableCoinUpdated(coinId, stableCoin_);

        return uint(Error.NO_ERROR);
    }

    function getAllPoolFactories() public view returns (address[] memory) {
        return poolFactories;
    }

    function getAllStableCoins() public view returns (address[] memory) {
        return stableCoins;
    }
}
