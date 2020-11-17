pragma solidity ^0.7.4;

import "../../contracts/Controller.sol";
import "../../contracts/PriceOracle.sol";

// XXX we should delete G1 everything...
//  requires fork/deploy bytecode tests

contract ControllerScenarioG1 is Controller {
    uint public blockNumber;

    constructor() Controller() {}

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

    function getHypotheticalAccountLiquidity(
        address account,
        address pTokenModify,
        uint redeemTokens,
        uint borrowAmount) public view override returns (uint, uint, uint) {
        (Error err, uint liquidity, uint shortfall) =
            super.getHypotheticalAccountLiquidityInternal(account, PToken(pTokenModify), redeemTokens, borrowAmount);
        return (uint(err), liquidity, shortfall);
    }

    function unlist(PToken pToken) public {
        markets[address(pToken)].isListed = false;
    }
}
