// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

import "./PriceOracle.sol";
import './RegistryInterface.sol';
import "./ErrorReporter.sol";
import "./Interfaces/IPriceFeeds.sol";
import "./PTokenInterfaces.sol";
import "./EIP20Interface.sol";
import "./SafeMath.sol";
import "./UniswapCommon.sol";
import "./PriceOracleProxy.sol";
import "./Controller.sol";
import "./PTokenFactory.sol";

abstract contract PriceOracleCore {
    /**
      * @notice Get the underlying price of a pToken asset
      * @param pToken The pToken to get the underlying price of
      * @return The underlying asset price mantissa (scaled by 1e18).
      *  Zero means the price is unavailable.
      */
    function getUnderlyingPrice(address pToken) external view virtual returns (uint);

    function updateUnderlyingPrice(address pToken) external virtual returns (uint);
}

contract PriceOracle is PriceOracleProxyStorage, PriceOracleCore, OracleErrorReporter {
    using SafeMath for uint;

    address public ETHUSDPriceFeed;

    address[] public priceOracles;

    mapping(address => address) public assetOracle;

    event OracleAdded(uint oracleId, address oracle);
    event OracleRemoved(uint oracleId, address oracle);
    event OracleUpdated(uint oracleId, address oracle);

    event PriceUpdated(address oracle, address asset, uint price);
    event AssetOracleUpdated(address oracle, address asset);

    function initialize(
        address ETHUSDPriceFeed_
    ) public {
        require(
            ETHUSDPriceFeed == address(0),
            "Oracle: may only be initialized once"
        );

        require(
            ETHUSDPriceFeed_ != address(0),
            "Oracle: address is not correct"
        );

        ETHUSDPriceFeed = ETHUSDPriceFeed_;
    }

    function updateUnderlyingPrice(address pToken) external override returns (uint) {
        if (pToken == RegistryInterface(registry).pETH()) {
            return uint(Error.NO_ERROR);
        }

        address asset = PErc20Interface(pToken).underlying();

        return update(asset);
    }

    function update(address asset) public returns (uint) {
        address oracle = assetOracle[asset];

        if (oracle == address(0)) {
            (oracle,,) = searchPair(asset);
        }

        if (oracle != address(0)) {
            if (assetOracle[asset] == address(0)) {
                assetOracle[asset] = oracle;
                emit AssetOracleUpdated(oracle, asset);
            }

            uint result = UniswapCommon(oracle).update(asset);

            if (result == uint(Error.NO_ERROR)) {
                emit PriceUpdated(oracle, asset, UniswapCommon(oracle).getCourseInETH(asset));
            }

            return result;
        }

        return fail(Error.UPDATE_PRICE, FailureInfo.NO_PAIR);
    }

    function reSearchPair(address asset) public returns (uint) {
        (address oracle,,) = searchPair(asset);

        if (oracle != address(0) && oracle != assetOracle[asset]) {
            assetOracle[asset] = oracle;
        }

        UniswapCommon(oracle).reSearchPair(asset);

        return update(asset);
    }

    function getPriceInUSD(address asset) public view virtual returns (uint) {
        uint ETHUSDPrice = uint(AggregatorInterface(ETHUSDPriceFeed).latestAnswer());
        uint AssetETHCourse = getPriceInETH(asset);

        // div 1e8 is chainlink precision for ETH
        return ETHUSDPrice.mul(AssetETHCourse).div(1e8);
    }

    function getPriceInETH(address asset) public view returns(uint) {
        if (asset == RegistryInterface(registry).pETH()) {
            // ether always worth 1
            return 1e18;
        }

        address oracle = assetOracle[asset];
        if (oracle == address(0)) {
            return 0;
        }

        return UniswapCommon(oracle).getCourseInETH(asset);
    }

    function getUnderlyingPrice(address pToken) public view override virtual returns (uint) {
        if (pToken == RegistryInterface(registry).pETH()) {
            return getPriceInUSD(pToken);
        }

        address asset = PErc20Interface(pToken).underlying();
        uint price = getPriceInUSD(asset);
        uint decimals = EIP20Interface(asset).decimals();

        return price.mul(10 ** (36 - decimals)).div(1e18);
    }

    function searchPair(address asset) public view returns (address, address, uint112) {
        address pair;
        uint112 liquidity;
        address maxLiquidityPair;
        uint112 maxLiquidity;
        address oracle;

        for(uint i = 0; i < priceOracles.length; i++) {
            (pair, liquidity) = UniswapCommon(priceOracles[i]).searchPair(asset);

            if (pair != address(0) && liquidity > maxLiquidity) {
                maxLiquidityPair = pair;
                maxLiquidity = liquidity;
                oracle = priceOracles[i];
            }
        }

        return (oracle, maxLiquidityPair, maxLiquidity);
    }

    function getMyAdmin() public view returns (address) {
        return RegistryInterface(registry).admin();
    }

    function isPeriodElapsed(address asset) public view returns (bool) {
        if (isNewAsset(asset)) {
            return true;
        }

        return UniswapCommon(assetOracle[asset]).isPeriodElapsed(asset);
    }

    function _addOracle(address oracle_) public returns (uint) {
        // Check caller = admin
        if (msg.sender != getMyAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.ADD_ORACLE);
        }

        require(
            oracle_ != address(0)
            , 'PriceOracle: invalid address for oracle'
        );

        for (uint i = 0; i < priceOracles.length; i++) {
            if (priceOracles[i] == oracle_) {
                return fail(Error.ORACLE_EXIST, FailureInfo.ADD_ORACLE);
            }
        }

        priceOracles.push(oracle_);

        emit OracleAdded(priceOracles.length - 1, oracle_);

        return uint(Error.NO_ERROR);
    }

    function _removeOracle(uint oracleId) public returns (uint) {
        // Check caller = admin
        if (msg.sender != getMyAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.UPDATE_DATA);
        }

        require(
            priceOracles.length > oracleId
            , 'PriceOracle: oracleId is not correct'
        );

        uint lastId = priceOracles.length - 1;

        address lastOracle = priceOracles[lastId];
        priceOracles.pop();
        emit OracleRemoved(oracleId, lastOracle);

        if (lastId != oracleId) {
            priceOracles[oracleId] = lastOracle;
            emit OracleUpdated(oracleId, lastOracle);
        }

        return uint(Error.NO_ERROR);
    }

    function _updateOracle(uint oracleId, address oracle_) public returns (uint) {
        // Check caller = admin
        if (msg.sender != getMyAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.UPDATE_DATA);
        }

        require(
            oracle_ != address(0)
            , 'PriceOracle: invalid address for oracle_'
        );

        for (uint i = 0; i < priceOracles.length; i++) {
            if (priceOracles[i] == oracle_) {
                return fail(Error.ORACLE_EXIST, FailureInfo.ADD_ORACLE);
            }
        }

        priceOracles[oracleId] = oracle_;

        emit OracleUpdated(oracleId, oracle_);

        return uint(Error.NO_ERROR);
    }

    function _updateAssetOracle(address oracle, address asset) public returns (uint) {
        // Check caller = admin
        if (msg.sender != getMyAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.UPDATE_DATA);
        }

        require(
            oracle != address(0)
            && asset != address(0)
            , 'Oracle: invalid address oracle or asset'
        );

        assetOracle[asset] = oracle;

        emit AssetOracleUpdated(oracle, asset);

        return update(asset);
    }

    function checkAndUpdateAllNewAssets() public {
        PTokenFactory factory = PTokenFactory(RegistryInterface(registry).factory());
        Controller controller = Controller(factory.controller());

        address[] memory allMarkets = Controller(controller).getAllMarkets();

        updateNewAssets(allMarkets);
    }

    function updateNewAssets(address[] memory pTokens) public {
        address asset;

        for(uint i = 0; i < pTokens.length; i++) {
            if (pTokens[i] == RegistryInterface(registry).pETH()) {
                continue;
            }

            asset = PErc20Interface(pTokens[i]).underlying();

            if (isNewAsset(asset)) {
                update(asset);
            }
        }
    }

    function isNewAsset(address asset) public view returns (bool) {
        return bool(assetOracle[asset] == address(0));
    }

    function getAllPriceOracles() public view returns (address[] memory) {
        return priceOracles;
    }

    function getPriceOraclesLength() public view returns (uint) {
        return priceOracles.length;
    }

}
