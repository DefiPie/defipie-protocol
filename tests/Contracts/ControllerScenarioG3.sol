// SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;

import "../../contracts/Controller.sol";

contract ControllerScenarioG3 is Controller {
    uint public blockNumber;

    constructor() Controller() {}

    function setPieAddress(address pieAddress_) public {
        pieAddress = pieAddress_;
    }

    function membershipLength(PToken pToken) public view returns (uint) {
        return accountAssets[address(pToken)].length;
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

    function getPieMarkets() public view returns (address[] memory) {
        uint m = allMarkets.length;
        uint n = 0;
        for (uint i = 0; i < m; i++) {
            if (markets[address(allMarkets[i])].isPied) {
                n++;
            }
        }

        address[] memory pieMarkets = new address[](n);
        uint k = 0;
        for (uint i = 0; i < m; i++) {
            if (markets[address(allMarkets[i])].isPied) {
                pieMarkets[k++] = address(allMarkets[i]);
            }
        }
        return pieMarkets;
    }

    function unlist(PToken pToken) public {
        markets[address(pToken)].isListed = false;
    }
}
