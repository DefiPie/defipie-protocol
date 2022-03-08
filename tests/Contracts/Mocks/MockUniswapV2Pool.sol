// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

contract MockUniswapV2Pool {
    uint112 public reserve0;
    uint112 public reserve1;
    uint32 public blockTimeStampLast;
    uint public price0CumLast;
    uint public price1CumLast;

    address public token0;
    address public token1;

    constructor() {
        init();
    }

    function init() public {
        reserve0 = 1265853603707383427790000;
        reserve1 = 253170720741476685558;
        blockTimeStampLast = uint32(block.timestamp);
        price0CumLast =       16605707706021539124070921915727672600000000;
        price1CumLast = 39194436442927457763557598254579840882221574000000;
    }

    function getReserves() public view returns (uint112, uint112, uint32) {
        return (reserve0, reserve1, blockTimeStampLast);
    }

    function setBlockTimeStampLast(uint32 blockTimeStampLast_) public {
        blockTimeStampLast = blockTimeStampLast_;
    }

    function price0CumulativeLast() public view returns (uint) {
        return price0CumLast;
    }

    function price1CumulativeLast() public view returns (uint) {
        return price1CumLast;
    }

    function setData(address tokenA, address tokenB) public {
        (token0, token1) = (tokenA, tokenB);
    }

    function setData(address tokenA, address tokenB, uint112 reserveA, uint112 reserveB) public {
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        (reserve0, reserve1) = tokenA < tokenB ? (reserveA, reserveB) : (reserveB, reserveA);
    }

    function setData(address tokenA, address tokenB, uint112 reserveA, uint112 reserveB, uint price0_, uint price1_) public {
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        (reserve0, reserve1) = tokenA < tokenB ? (reserveA, reserveB) : (reserveB, reserveA);
        (price0CumLast, price1CumLast) = tokenA < tokenB ? (price0_, price1_) : (price1_, price0_);
    }
}
