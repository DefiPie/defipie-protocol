// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

import './Registry.sol';
import "./Interfaces/IPriceFeeds.sol";

contract UniswapV3PriceOracleStorageV1 {
    uint24[] public feeArray;
}