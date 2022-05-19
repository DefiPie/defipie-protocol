// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

import "../../../contracts/Control/Distributor.sol";
import "../../../contracts/Oracles/PriceOracle.sol";

contract DistributorHarness is Distributor {
    /// @notice The rate at which the flywheel distributes PIE, per block
    uint public pieRate;

    uint public blockNumber;

    function init(address implementation_, address registry_, address controller_) public {
        implementation = implementation_;
        registry = RegistryInterface(registry_);
        controller = ControllerInterface(controller_);
    }

    function setPieSupplyState(address pToken, uint224 index, uint32 blockNumber_) public {
        pieSupplyState[pToken].index = index;
        pieSupplyState[pToken].block = blockNumber_;
    }

    function setPieBorrowState(address pToken, uint224 index, uint32 blockNumber_) public {
        pieBorrowState[pToken].index = index;
        pieBorrowState[pToken].block = blockNumber_;
    }

    function setPieAccrued(address user, uint userAccrued) public {
        pieAccrued[user] = userAccrued;
    }

    function setPieAddress(address pieAddress_) public {
        pieAddress = pieAddress_;
    }

    function getPieAddress() public view override returns (address) {
        return pieAddress;
    }

    function harnessSetPieRate(uint pieRate_) public {
        pieRate = pieRate_;
    }

    function _setPieRate(uint pieRate_) public {
        pieRate = pieRate_;
    }

    /**
     * @notice Recalculate and update PIE speeds for all PIE markets
     */
    function harnessRefreshPieSpeeds() public {
        address[] memory allMarkets_ = getAllMarkets();

        for (uint i = 0; i < allMarkets_.length; i++) {
            address pToken = allMarkets_[i];
            Exp memory borrowIndex = Exp({mantissa: PTokenInterface(pToken).borrowIndex()});
            updatePieSupplyIndexInternal(address(pToken));
            updatePieBorrowIndexInternal(address(pToken), borrowIndex);
        }

        Exp memory totalUtility = Exp({mantissa: 0});
        Exp[] memory utilities = new Exp[](allMarkets_.length);
        for (uint i = 0; i < allMarkets_.length; i++) {
            address pToken = allMarkets_[i];
            if (pieSpeeds[address(pToken)] > 0) {
                Exp memory assetPrice = Exp({mantissa: Controller(address(controller)).getOracle().getUnderlyingPrice(pToken)});
                Exp memory utility = mul_(assetPrice, PTokenInterface(pToken).totalBorrows());
                utilities[i] = utility;
                totalUtility = add_(totalUtility, utility);
            }
        }

        for (uint i = 0; i < allMarkets_.length; i++) {
            address pToken = allMarkets_[i];
            uint newSpeed = totalUtility.mantissa > 0 ? mul_(pieRate, div_(utilities[i], totalUtility)) : 0;
            setPieSpeedInternal(pToken, newSpeed);
        }
    }

    function setPieBorrowerIndex(address pToken, address borrower, uint index) public {
        pieBorrowerIndex[pToken][borrower] = index;
    }

    function setPieSupplierIndex(address pToken, address supplier, uint index) public {
        pieSupplierIndex[pToken][supplier] = index;
    }

    function harnessUpdatePieBorrowIndex(address pToken, uint marketBorrowIndexMantissa) public {
        updatePieBorrowIndexInternal(pToken, Exp({mantissa: marketBorrowIndexMantissa}));
    }

    function harnessUpdatePieSupplyIndex(address pToken) public {
        updatePieSupplyIndexInternal(pToken);
    }

    function harnessDistributeBorrowerPie(address pToken, address borrower, uint marketBorrowIndexMantissa) public {
        distributeBorrowerPieInternal(pToken, borrower, Exp({mantissa: marketBorrowIndexMantissa}), false);
    }

    function harnessDistributeSupplierPie(address pToken, address supplier) public {
        distributeSupplierPieInternal(pToken, supplier, false);
    }

    function harnessTransferPie(address user, uint userAccrued, uint threshold) public returns (uint) {
        return transferPie(user, userAccrued, threshold);
    }

    function harnessAddPieMarkets(address[] memory pTokens) public {
        for (uint i = 0; i < pTokens.length; i++) {
            // temporarily set compSpeed to 1 (will be fixed by `harnessRefreshPieSpeeds`)
            setPieSpeedInternal(pTokens[i], 1);
        }
    }

    function harnessFastForward(uint blocks) public returns (uint) {
        blockNumber += blocks;
        return blockNumber;
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
        uint m = getAllMarkets().length;
        uint n = 0;
        for (uint i = 0; i < m; i++) {
            if (pieSpeeds[address(Controller(address(controller)).allMarkets(i))] > 0) {
                n++;
            }
        }

        address[] memory pieMarkets = new address[](n);
        uint k = 0;
        for (uint i = 0; i < m; i++) {
            if (pieSpeeds[address(Controller(address(controller)).allMarkets(i))] > 0) {
                pieMarkets[k++] = address(Controller(address(controller)).allMarkets(i));
            }
        }
        return pieMarkets;
    }
}