// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

contract MockPriceFeed {
    int public latestPrice; // chainlink USD with 8 decimals of precision

    constructor() {
        latestPrice = 400e8;
    }

    function latestAnswer() public view returns (int256) {
        return latestPrice;
    }

    function setLatestAnswer(int256 latestAnswer_) public {
        latestPrice = latestAnswer_;
    }
}
