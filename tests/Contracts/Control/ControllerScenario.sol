// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

import "../../../contracts/Control/Controller.sol";

contract ControllerScenario is Controller {
    uint public blockNumber;

    constructor() Controller() {}

    function fastForward(uint blocks) public returns (uint) {
        blockNumber += blocks;
        return blockNumber;
    }

    function setBlockNumber(uint number) public {
        blockNumber = number;
    }

    function membershipLength(address pToken) public view returns (uint) {
        return accountAssets[pToken].length;
    }

    function unlist(address pToken) public {
        markets[pToken].isListed = false;
    }
}
