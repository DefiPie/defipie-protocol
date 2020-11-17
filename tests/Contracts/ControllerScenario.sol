pragma solidity ^0.7.4;

import "../../contracts/Controller.sol";

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

    function membershipLength(PToken pToken) public view returns (uint) {
        return accountAssets[address(pToken)].length;
    }

    function unlist(PToken pToken) public {
        markets[address(pToken)].isListed = false;
    }
}
