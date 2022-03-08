// https://etherscan.io/address/0x1f98431c8ad98523631ae4a59f267346ea31f984
// https://rinkeby.etherscan.io/address/0x1f98431c8ad98523631ae4a59f267346ea31f984#code
// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "./MockUniswapV3Pool.sol";

contract MockUniswapV3Factory {
    mapping(uint24 => int24) public feeAmountTickSpacing;
    mapping(address => mapping(address => mapping(uint24 => address))) public getPool;

    constructor() {
        feeAmountTickSpacing[100] = 1;
        feeAmountTickSpacing[500] = 10;
        feeAmountTickSpacing[3000] = 60;
        feeAmountTickSpacing[10000] = 200;
    }

    function setPair(address pool) public {
        address token0 = MockUniswapV3Pool(pool).token0();
        address token1 = MockUniswapV3Pool(pool).token1();
        uint24 fee = MockUniswapV3Pool(pool).fee();

        getPool[token0][token1][fee] = pool;
        getPool[token1][token0][fee] = pool;
    }

    function setPool(
        address pool,
        address token0,
        address token1,
        uint24 fee
    ) public {
        getPool[token0][token1][fee] = pool;
        getPool[token1][token0][fee] = pool;
    }
}