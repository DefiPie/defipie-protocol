// SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;

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
}
