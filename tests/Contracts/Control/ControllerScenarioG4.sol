// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "../../../contracts/Control/Controller.sol";

contract ControllerScenarioG4 is Controller {
    uint public blockNumber;

    constructor() Controller() {}

    function membershipLength(address pToken) public view returns (uint) {
        return accountAssets[pToken].length;
    }

    function fastForward(uint blocks) public returns (uint) {
        blockNumber += blocks;

        return blockNumber;
    }

    function setBlockNumber(uint number) public {
        blockNumber = number;
    }

    function getBlockNumber() public view override returns (uint) {
        return blockNumber;
    }

    function unlist(address pToken) public {
        markets[pToken].isListed = false;
    }
}
