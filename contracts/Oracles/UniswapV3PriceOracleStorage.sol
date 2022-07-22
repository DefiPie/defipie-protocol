// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import '../Registry.sol';
import "./Interfaces/IPriceFeeds.sol";

contract UniswapV3PriceOracleStorageV1 {
    uint24[] public feeArray;
}