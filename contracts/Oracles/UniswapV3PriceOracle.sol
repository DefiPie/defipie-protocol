// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

import './Interfaces/uniswapV3/OracleLibrary.sol';
import './Interfaces/uniswapV3/PoolAddress.sol';
import './Interfaces/uniswapV3/IUniswapV3Factory.sol';
import './Interfaces/uniswapV3/LiquidityAmounts.sol';

import "./PriceOracle.sol";
import "../ErrorReporter.sol";
import "../Tokens/PTokenInterfaces.sol";
import "../SafeMath.sol";
import "./UniswapV3PriceOracleStorage.sol";
import "../Tokens/EIP20Interface.sol";
import "../Control/Controller.sol";
import "../PTokenFactory.sol";

contract UniswapV3PriceOracle is UniswapCommon, UniswapV3PriceOracleStorageV1 {
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

        poolFactories.push(poolFactory_);

        feeArray.push(100);
        feeArray.push(500);
        feeArray.push(3000);
        feeArray.push(10000);

        period = 10 minutes;

        emit PoolAdded(0, poolFactory_);
    }

    function update(address asset) public override returns (uint) {
        uint reserves;
        address pair;

        if (assetPair[asset] != address(0)) {
            reserves = calcVirtualReserves(assetPair[asset], asset);
            if (reserves < minReserveLiquidity) {
                assetPair[asset] = address(0);
            }
        }

        if (assetPair[asset] == address(0)) {
            (pair, reserves) = searchPair(asset);

            if (pair == address(0)) {
                return fail(Error.UPDATE_PRICE, FailureInfo.NO_PAIR);
            }

            if (reserves > minReserveLiquidity) {
                assetPair[asset] = pair;
            } else {
                return fail(Error.UPDATE_PRICE, FailureInfo.NO_RESERVES);
            }
        }

        return uint(Error.NO_ERROR);
    }

    function getCourseInETH(address asset) public view override returns (uint) {
        if (asset == RegistryInterface(registry).pETH()) {
            // ether always worth 1
            return 1e18;
        }

        return getAveragePrice(asset);
    }

    function getAveragePrice(address asset) public view returns (uint) {
        uint assetAmount = (10 ** EIP20Interface(asset).decimals()).mul(100);

        uint price = assetToEth(asset, assetAmount);
        return price.div(100);
    }

    function assetToEth(address asset, uint256 amountIn) public view returns (uint ethAmountOut) {
        address pool;

        if (assetPair[asset] == address(0)) {
            // first update from factory or other users
            (pool,) = searchPair(asset);
        } else {
            pool = assetPair[asset];
        }

        address token0 = IUniswapV3PoolImmutables(pool).token0();
        address token1 = IUniswapV3PoolImmutables(pool).token1();

        if (token0 == WETHToken || token1 == WETHToken) {
            // asset and weth pool
            return fetchTwap(asset, amountIn, WETHToken, pool);
        } else {
            uint power;
            // asset and stable coin pool
            if (token0 == asset) {
                power = EIP20Interface(token1).decimals();
                return fetchTwap(asset, amountIn, token1, pool).mul(getCourseInETH(token1)).div(10**power);
            } else {
                power = EIP20Interface(token0).decimals();
                return fetchTwap(asset, amountIn, token0, pool).mul(getCourseInETH(token0)).div(10**power);
            }
        }
    }

    function fetchTwap(
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        address pool
    ) public view returns (uint256 amountOut) {
        (int24 twapTick, ) = OracleLibrary.consult(pool, uint32(period));

        return OracleLibrary.getQuoteAtTick(twapTick, SafeCast.toUint128(amountIn), tokenIn, tokenOut);
    }

    function getMaxLiquidityPool(address tokenA, address tokenB) public view returns (address, uint) {
        address maxLiquidityPool;
        uint maxHarmonicMeanLiquidity;

        for(uint i = 0; i < poolFactories.length; i++) {
            for(uint j = 0; j < feeArray.length; j++) {
                address pool = IUniswapV3Factory(poolFactories[i]).getPool(tokenA, tokenB, feeArray[j]);

                if (pool != address(0)) {
                    (, uint128 poolHarmonicMeanLiquidity) = OracleLibrary.consult(pool, uint32(period));

                    if (poolHarmonicMeanLiquidity > maxHarmonicMeanLiquidity) {
                        maxHarmonicMeanLiquidity = poolHarmonicMeanLiquidity;
                        maxLiquidityPool = pool;
                    }
                }
            }
        }

        return (maxLiquidityPool, maxHarmonicMeanLiquidity);
    }

    function calcVirtualReserves(address pair, address asset) public view returns (uint) {
        if (pair == address(0)) {
            return 0;
        }

        uint virtualReserves;

        uint128 liquidity = IUniswapV3PoolState(pair).liquidity();
        (uint160 sqrtPriceX96,,,,,,) = IUniswapV3PoolState(pair).slot0();

        uint160 sqrtPriceAX96 = sqrtPriceX96 / 4;
        uint160 sqrtPriceBX96 = sqrtPriceX96 * 4;

        (uint256 amount0, uint256 amount1) = LiquidityAmounts.getAmountsForLiquidity(sqrtPriceX96, sqrtPriceAX96, sqrtPriceBX96, liquidity);

        if (IUniswapV3PoolImmutables(pair).token0() == asset) {
            virtualReserves = amount1;
        } else {
            virtualReserves = amount0;
        }

        return virtualReserves;
    }

    function searchPair(address asset) public view override returns (address, uint112) {
        (address pair, ) = getMaxLiquidityPool(asset, WETHToken);
        uint virtualETHReserves;

        if (pair != address(0)) {
            virtualETHReserves = calcVirtualReserves(pair, asset);
        }

        address stablePair;
        uint maxStableCoinReserves;

        address tempPair;
        uint stableCoinReserves;

        for (uint i = 0; i < stableCoins.length; i++) {
            (tempPair, ) = getMaxLiquidityPool(asset, stableCoins[i]);

            if (tempPair != address(0)) {
                stableCoinReserves = calcVirtualReserves(tempPair, asset);

                if (stableCoinReserves > maxStableCoinReserves) {
                    maxStableCoinReserves = stableCoinReserves;
                    stablePair = tempPair;
                }
            }
        }

        if (stablePair != address(0)) {
            uint power;
            uint calcETHReserves;

            address token0 = IUniswapV3PoolImmutables(stablePair).token0();
            address token1 = IUniswapV3PoolImmutables(stablePair).token1();

            if (token0 == asset) {
                power = EIP20Interface(token1).decimals();
                calcETHReserves = getCourseInETH(token1).mul(maxStableCoinReserves).div(10**power);
            } else {
                power = EIP20Interface(token0).decimals();
                calcETHReserves = getCourseInETH(token0).mul(maxStableCoinReserves).div(10**power);
            }

            if (calcETHReserves > virtualETHReserves) {
                pair = stablePair;
                virtualETHReserves = calcETHReserves;
            }
        }

        return (pair, uint112(virtualETHReserves));
    }

    function reSearchPair(address asset) public override returns (uint) {
        address oldPair = assetPair[asset];
        (address newPair,) = searchPair(asset);

        if (newPair != address(0) && newPair != oldPair) {
            assetPair[asset] = newPair;

            emit AssetPairUpdated(asset, newPair);
        }

        return uint(Error.NO_ERROR);
    }

    function isPeriodElapsed(address /*asset*/) public view override returns (bool) {
        return false;
    }

    function _updateAssetPair(address asset, address pair) public returns (uint) {
        // Check caller = admin
        if (msg.sender != getMyAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.UPDATE_DATA);
        }

        require(
            pair != address(0)
            && asset != address(0)
            , 'Oracle: invalid address for asset or pair'
        );

        assetPair[asset] = pair;

        emit AssetPairUpdated(asset, pair);

        return update(asset);
    }
}