// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "../SafeMath.sol";
import "../Oracles/UniswapV2PriceOracle.sol";
import "../Oracles/Interfaces/IPriceFeeds.sol";
import "../Oracles/UniswapV3PriceOracle.sol";

contract CalcPoolPrice {
    uint224 constant Q112 = 2**112;

    using FixedPoint for *;
    using SafeMath for uint;

    PriceOracle public priceOracle;

    constructor(address priceOracle_) {
        priceOracle = PriceOracle(priceOracle_);
    }

    function isContract(address account) public view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
    }

    function checkFunctionStaticCall(
        address target
    ) public view returns (bool) {
        require(isContract(target), "Address: static call to non-contract");

        bytes4 FUNC_SELECTOR = bytes4(keccak256("getReserves()"));
        bytes memory data = abi.encodeWithSelector(FUNC_SELECTOR);

        (bool success, ) = target.staticcall(data);
        return success;
    }

    function getPoolPriceAverage(address pair_, address asset) public view returns (FixedPoint.uq112x112 memory) {
        if (checkFunctionStaticCall(pair_)) {
            IUniswapV2Pair pair = IUniswapV2Pair(pair_);
            (uint112 reserve0, uint112 reserve1, ) = pair.getReserves();

            FixedPoint.uq112x112 memory priceAverage;

            if (asset == pair.token0()) {
                priceAverage = FixedPoint.uq112x112(uqdiv(encode(reserve1), reserve0));
            } else {
                priceAverage = FixedPoint.uq112x112(uqdiv(encode(reserve0), reserve1));
            }

            return priceAverage;
        } else {
            address oracle = priceOracle.assetOracle(asset);
            uint price = UniswapV3PriceOracle(oracle).getAveragePrice(asset);
            uint power = EIP20Interface(asset).decimals();

            return FixedPoint.uq112x112(uqdiv(encode(uint112(price)), (uint112(10**power))));
        }
    }

    function getPoolETHAmount(address asset, uint amountIn) public view returns (uint) {
        address oracle = priceOracle.assetOracle(asset);
        address pair = UniswapV2PriceOracle(oracle).assetPair(asset);

        address token0 = IUniswapV2Pair(pair).token0();
        address token1 = IUniswapV2Pair(pair).token1();

        uint power;

        FixedPoint.uq112x112 memory priceAverage = getPoolPriceAverage(pair, asset);
        uint result = priceAverage.mul(amountIn).decode144();

        if (token0 == UniswapV2PriceOracle(oracle).WETHToken() || token1 == UniswapV2PriceOracle(oracle).WETHToken()) {
            // asset and weth pool
            return result;
        } else {
            // asset and stable coin pool
            if (token0 == asset) {
                power = EIP20Interface(token1).decimals();
                return result.mul(calcPoolCourseInETH(token1)).div(10**power);
            } else {
                power = EIP20Interface(token0).decimals();
                return result.mul(calcPoolCourseInETH(token0)).div(10**power);
            }
        }
    }

    function calcPoolCourseInETH(address asset) public view returns (uint) {
        if (asset == Registry(priceOracle.registry()).pETH()) {
            // ether always worth 1
            return 1e18;
        }

        uint power = EIP20Interface(asset).decimals();
        uint amountIn = 10**power;

        return getPoolETHAmount(asset, amountIn);
    }

    function getPoolCourseInETH(address asset) public view returns (uint) {
        if (asset == Registry(priceOracle.registry()).pETH()) {
            // ether always worth 1
            return 1e18;
        }

        return calcPoolCourseInETH(asset);
    }

    function getPoolPriceInUSD(address asset) public view returns (uint) {
        uint ETHUSDPrice = uint(AggregatorInterface(priceOracle.ETHUSDPriceFeed()).latestAnswer());
        uint AssetETHCourse = getPoolCourseInETH(asset);

        // div 1e8 is chainlink precision for ETH
        return ETHUSDPrice.mul(AssetETHCourse).div(1e8);
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