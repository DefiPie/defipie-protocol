// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "../../../contracts/Control/Controller.sol";

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
}
