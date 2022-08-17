// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

contract MockUniswapV2Factory {
    bool public pairExist;
    address public pair;

    constructor() {}

    function getPair(address, address) public view returns (address) {
        if (pairExist) {
            return address(pair);
        } else {
            return address(0);
        }
    }

    function setPairExist(bool pairExist_) public {
        pairExist = pairExist_;
    }

    function setPair(address pair_) public {
        pair = pair_;
    }
}

contract MockUniswapV2FactoryV2 {
    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    constructor() {}

    function allPairsLength() external view returns (uint) {
        return allPairs.length;
    }

    function getAllPairs() external view returns (address[] memory) {
        return allPairs;
    }

    function addPair(address tokenA, address tokenB, address pair) public {
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);

        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair; // populate mapping in the reverse direction
        allPairs.push(pair);
    }
}
