pragma solidity ^0.7.6;

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

    function membershipLength(address pToken) public view returns (uint) {
        return accountAssets[pToken].length;
    }

    function unlist(address pToken) public {
        markets[pToken].isListed = false;
    }

    function _setPieRate(uint pieRate_) public {
        pieRate = pieRate_;
    }

    /**
     * @notice Recalculate and update PIE speeds for all PIE markets
     */
    function refreshPieSpeeds() public {
        address[] memory allMarkets_ = allMarkets;

        for (uint i = 0; i < allMarkets_.length; i++) {
            address pToken = allMarkets_[i];
            Exp memory borrowIndex = Exp({mantissa: PTokenInterface(pToken).borrowIndex()});
            updatePieSupplyIndex(address(pToken));
            updatePieBorrowIndex(address(pToken), borrowIndex);
        }

        Exp memory totalUtility = Exp({mantissa: 0});
        Exp[] memory utilities = new Exp[](allMarkets_.length);
        for (uint i = 0; i < allMarkets_.length; i++) {
            address pToken = allMarkets_[i];
            if (pieSpeeds[address(pToken)] > 0) {
                Exp memory assetPrice = Exp({mantissa: getOracle().getUnderlyingPrice(pToken)});
                Exp memory utility = mul_(assetPrice, PTokenInterface(pToken).totalBorrows());
                utilities[i] = utility;
                totalUtility = add_(totalUtility, utility);
            }
        }

        for (uint i = 0; i < allMarkets_.length; i++) {
            address pToken = allMarkets[i];
            uint newSpeed = totalUtility.mantissa > 0 ? mul_(pieRate, div_(utilities[i], totalUtility)) : 0;
            setPieSpeedInternal(pToken, newSpeed);
        }
    }
}
