// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "./PriceOracle.sol";
import "../ErrorReporter.sol";
import "../Tokens/PTokenInterfaces.sol";
import "../SafeMath.sol";
import "./UniswapV2PriceOracleStorage.sol";
import "../Tokens/EIP20Interface.sol";

contract UniswapV2PriceOracle is UniswapCommon, UniswapV2PriceOracleStorageV1 {
    using FixedPoint for *;
    using SafeMath for uint;

    event AssetPairUpdated(address asset, address pair);

    constructor() {}

    function initialize(
        address poolFactory_,
        address WETHToken_
    )
        public
    {
        require(
            WETHToken == address(0)
            , "Oracle: may only be initialized once"
        );

        WETHToken = WETHToken_;

        require(
            poolFactory_ != address(0)
            , 'Oracle: invalid address for factory'
        );

        Q112 = 2**112;
        period = 10 minutes;

        poolFactories.push(poolFactory_);

        emit PoolAdded(0, poolFactory_);
    }

    function getCourseInETH(address asset) public view override returns (uint) {
        if (asset == RegistryInterface(registry).pETH()) {
            // ether always worth 1
            return 1e18;
        }

        return averagePrices[asset];
    }

    function update(address asset) public override returns (uint) {
        uint112 reserve0;
        uint112 reserve1;
        uint32 blockTimeStamp;
        address pair;

        if (!isNewAsset(asset)) {
            pair = assetPair[asset];

            address token0 = IUniswapV2Pair(pair).token0();
            address token1 = IUniswapV2Pair(pair).token1();

            (, reserve1, ) = getReservesFromPair(asset);
            uint result = uint(reserve1);

            if (token0 != WETHToken && token1 != WETHToken) {
                uint power;

                // asset and stable coin pool
                if (token0 == asset) {
                    power = EIP20Interface(token1).decimals();
                    result = uint(reserve1).mul(getCourseInETH(token1)).div(10**power);
                } else {
                    power = EIP20Interface(token0).decimals();
                    result = uint(reserve1).mul(getCourseInETH(token0)).div(10**power);
                }
            }

            if (result < minReserveLiquidity) {
                cumulativePrices[assetPair[asset]][asset].priceAverage._x = 0;
                cumulativePrices[assetPair[asset]][asset].priceCumulativePrevious = 0;
                cumulativePrices[assetPair[asset]][asset].blockTimeStampPrevious = 0;
                assetPair[asset] = address(0);
            }
        }

        if (isNewAsset(asset)) {
            if (assetPair[asset] == address(0)) {
                // first update from factory or other users
                (pair, ) = searchPair(asset);
            } else {
                // after updatePair function
                pair = assetPair[asset];
            }

            if (pair != address(0)) {
                assetPair[asset] = pair;

                (reserve0, reserve1, blockTimeStamp) = getReservesFromPair(asset);

                if (reserve1 < minReserveLiquidity) {
                    return fail(Error.UPDATE_PRICE, FailureInfo.NO_RESERVES);
                }

                cumulativePrices[pair][asset].priceAverage = FixedPoint.uq112x112(uqdiv(encode(reserve1), reserve0));
            } else {
                return fail(Error.UPDATE_PRICE, FailureInfo.NO_PAIR);
            }
        } else {
            // second and next updates
            if (!isPeriodElapsed(asset)) {
                return fail(Error.UPDATE_PRICE, FailureInfo.PERIOD_NOT_ELAPSED);
            }

            (, , blockTimeStamp) = getReservesFromPair(asset);
            pair = assetPair[asset];

            uint32 timeElapsed = blockTimeStamp - cumulativePrices[pair][asset].blockTimeStampPrevious;

            // overflow is desired, casting never truncates
            // cumulative price is in (uq112x112 price * seconds) units so we simply wrap it after division by time elapsed
            if (asset == IUniswapV2Pair(pair).token0()) {
                cumulativePrices[pair][asset].priceAverage = FixedPoint.uq112x112(uint224((IUniswapV2Pair(pair).price0CumulativeLast() - cumulativePrices[pair][asset].priceCumulativePrevious) / timeElapsed));
            } else {
                cumulativePrices[pair][asset].priceAverage = FixedPoint.uq112x112(uint224((IUniswapV2Pair(pair).price1CumulativeLast() - cumulativePrices[pair][asset].priceCumulativePrevious) / timeElapsed));
            }
        }

        cumulativePrices[pair][asset].blockTimeStampPrevious = blockTimeStamp;

        // update data
        if (asset == IUniswapV2Pair(pair).token0()) {
            cumulativePrices[pair][asset].priceCumulativePrevious = IUniswapV2Pair(pair).price0CumulativeLast();
        } else {
            cumulativePrices[pair][asset].priceCumulativePrevious = IUniswapV2Pair(pair).price1CumulativeLast();
        }

        averagePrices[asset] = calcCourseInETH(asset);

        return uint(Error.NO_ERROR);
    }

    function isNewAsset(address asset) public view returns (bool) {
        return bool(cumulativePrices[assetPair[asset]][asset].blockTimeStampPrevious == 0);
    }

    function getPoolPair(address asset, uint poolId) public view returns (address) {
        IUniswapV2Factory factory = IUniswapV2Factory(poolFactories[poolId]);

        return factory.getPair(WETHToken, asset);
    }

    function getPoolPairWithStableCoin(address asset, uint poolId, uint stableCoinId) public view returns (address) {
        IUniswapV2Factory factory = IUniswapV2Factory(poolFactories[poolId]);

        return factory.getPair(stableCoins[stableCoinId], asset);
    }

    function getReservesFromPair(address asset) public view returns (uint112, uint112, uint32) {
        uint112 assetReserve;
        uint112 ethOrCoinReserves;
        uint32 blockTimeStamp;

        IUniswapV2Pair pair = IUniswapV2Pair(assetPair[asset]);

        address token0 = pair.token0();

        if (token0 == asset) {
            (assetReserve, ethOrCoinReserves, blockTimeStamp) = pair.getReserves();
        } else {
            (ethOrCoinReserves, assetReserve, blockTimeStamp) = pair.getReserves();
        }

        return (assetReserve, ethOrCoinReserves, blockTimeStamp);
    }

    function isPeriodElapsed(address asset) public view override returns (bool) {
        IUniswapV2Pair pair = IUniswapV2Pair(assetPair[asset]);

        ( , , uint32 blockTimeStamp) = pair.getReserves();

        uint timeElapsed = uint(blockTimeStamp).sub(uint(cumulativePrices[assetPair[asset]][asset].blockTimeStampPrevious));

        return bool(timeElapsed > period);
    }

    function calcCourseInETH(address asset) public view returns (uint) {
        if (asset == RegistryInterface(registry).pETH()) {
            // ether always worth 1
            return 1e18;
        }

        uint power = EIP20Interface(asset).decimals();
        uint amountIn = 10**power;

        return getETHAmount(asset, amountIn);
    }

    function getETHAmount(address asset, uint amountIn) public view returns (uint) {
        address pair = assetPair[asset];

        address token0 = IUniswapV2Pair(pair).token0();
        address token1 = IUniswapV2Pair(pair).token1();

        uint power;
        uint result = cumulativePrices[pair][asset].priceAverage.mul(amountIn).decode144();

        if (token0 == WETHToken || token1 == WETHToken) {
            // asset and weth pool
            return result;
        } else {
            // asset and stable coin pool
            if (token0 == asset) {
                power = EIP20Interface(token1).decimals();
                return result.mul(getCourseInETH(token1)).div(10**power);
            } else {
                power = EIP20Interface(token0).decimals();
                return result.mul(getCourseInETH(token0)).div(10**power);
            }
        }
    }

    function searchPair(address asset) public view override returns (address, uint112) {
        address pair;
        uint112 maxReserves;

        IUniswapV2Pair tempPair;
        uint112 ETHReserves;

        uint112 stableCoinReserve;
        uint power;
        address token0;
        address token1;

        for (uint i = 0; i < poolFactories.length; i++) {
            tempPair = IUniswapV2Pair(getPoolPair(asset, i));

            if (address(tempPair) != address(0)) {
                if (tempPair.token0() == asset) {
                    (, ETHReserves, ) = tempPair.getReserves();
                } else {
                    (ETHReserves, , ) = tempPair.getReserves();
                }

                if (ETHReserves > maxReserves) {
                    maxReserves = ETHReserves;
                    pair = address(tempPair);
                }
            }

            for (uint j = 0; j < stableCoins.length; j++) {
                tempPair = IUniswapV2Pair(getPoolPairWithStableCoin(asset, i, j));

                if (address(tempPair) != address(0)) {
                    stableCoinReserve;
                    power;

                    token0 = tempPair.token0();
                    token1 = tempPair.token1();

                    if (token0 == asset) {
                        (, stableCoinReserve,) = tempPair.getReserves();
                        power = EIP20Interface(token1).decimals();
                        ETHReserves = uint112(getCourseInETH(token1) * stableCoinReserve / (10**power));
                    } else {
                        (stableCoinReserve, , ) = tempPair.getReserves();
                        power = EIP20Interface(token0).decimals();
                        ETHReserves = uint112(getCourseInETH(token0) * stableCoinReserve / (10**power));
                    }

                    if (ETHReserves > maxReserves) {
                        maxReserves = ETHReserves;
                        pair = address(tempPair);
                    }
                }
            }
        }

        return (pair, maxReserves);
    }

    function reSearchPair(address asset) public override returns (uint) {
        address oldPair = assetPair[asset];
        (address newPair,) = searchPair(asset);

        if (newPair != address(0) && newPair != oldPair) {
            cumulativePrices[oldPair][asset].priceAverage._x = 0;
            cumulativePrices[oldPair][asset].priceCumulativePrevious = 0;
            cumulativePrices[oldPair][asset].blockTimeStampPrevious = 0;

            assetPair[asset] = newPair;

            emit AssetPairUpdated(asset, newPair);
        }

        return update(asset);
    }

    function _updateAssetPair(address asset, address pair) public returns (uint) {
        // Check caller = admin
        if (msg.sender != getMyAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.UPDATE_DATA);
        }

        require(
            asset != address(0)
            && pair != address(0)
            , 'Oracle: invalid address for asset or pair'
        );

        cumulativePrices[assetPair[asset]][asset].priceAverage._x = 0;
        cumulativePrices[assetPair[asset]][asset].priceCumulativePrevious = 0;
        cumulativePrices[assetPair[asset]][asset].blockTimeStampPrevious = 0;

        assetPair[asset] = pair;

        emit AssetPairUpdated(asset, pair);

        return update(asset);
    }

    // encode a uint112 as a UQ112x112
    function encode(uint112 y) internal view returns (uint224 z) {
        z = uint224(y) * uint224(Q112); // never overflows
    }

    // divide a UQ112x112 by a uint112, returning a UQ112x112
    function uqdiv(uint224 x, uint112 y) internal pure returns (uint224 z) {
        z = x / uint224(y);
    }

}