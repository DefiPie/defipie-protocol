// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "../../contracts/Controller.sol";

contract ControllerScenarioG2 is Controller {
    uint public blockNumber;

    constructor() Controller() {}

    function fastForward(uint blocks) public returns (uint) {
        blockNumber += blocks;
        return blockNumber;
    }

    function setBlockNumber(uint number) public {
        blockNumber = number;
    }

    function _setPieRate(uint pieRate_) public {
        pieRate = pieRate_;
    }
}
