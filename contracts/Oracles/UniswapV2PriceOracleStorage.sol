// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import '../Registry.sol';
import "./Interfaces/IPriceFeeds.sol";

contract UniswapV2PriceOracleStorageV1 {
    uint public Q112;

    struct PoolCumulativePrice {
        FixedPoint.uq112x112 priceAverage;
        uint priceCumulativePrevious;
        uint32 blockTimeStampPrevious;
    }

    // asset => assetPair => data from pool
    mapping(address => mapping (address => PoolCumulativePrice)) public cumulativePrices;
    mapping(address => uint) public averagePrices;
}