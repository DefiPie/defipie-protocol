// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

import "../ErrorReporter.sol";
import "../Exponential.sol";
import "../Oracles/PriceOracle.sol";
import "./ControllerInterface.sol";
import "./ControllerStorage.sol";
import "./DistributorInterface.sol";
import "./DistributorStorage.sol";
import "../Tokens/PTokenInterfaces.sol";
import "../Tokens/EIP20Interface.sol";
import "./Unitroller.sol";

/**
 * @title DeFiPie's Distributor Contract
 * @author DeFiPie
 */
contract Distributor is DistributorStorage, DistributorErrorReporter, DistributorInterface, Exponential {

    /// @notice Emitted when a new PIE speed is calculated for a market
    event PieSpeedUpdated(address indexed pToken, uint newSpeed);

    /// @notice Emitted when PIE is distributed to a supplier
    event DistributedSupplierPie(address indexed pToken, address indexed supplier, uint pieDelta, uint pieSupplyIndex);

    /// @notice Emitted when PIE is distributed to a borrower
    event DistributedBorrowerPie(address indexed pToken, address indexed borrower, uint pieDelta, uint pieBorrowIndex);

    /// @notice The threshold above which the flywheel transfers PIE, in wei
    uint public constant pieClaimThreshold = 0.001e18;

    /// @notice The initial PIE index for a market
    uint224 public constant pieInitialIndex = 1e36;

    constructor() {}

    /*** Admin Functions ***/

    /**
      * @notice Sets a PIE address for the distributor
      * @return uint 0=success
      */
    function _setPieAddress(address pieAddress_) public returns (uint) {
        require(msg.sender == getAdmin() && pieAddress == address(0), "pie address may only be initialized once");

        pieAddress = pieAddress_;

        return uint(Error.NO_ERROR);
    }

    /*** Pie Distribution ***/

    /**
     * @notice Set PIE speed for a single market
     * @param pToken The market whose PIE speed to update
     * @param pieSpeed New PIE speed for market
     */
    function setPieSpeedInternal(address pToken, uint pieSpeed) internal {
        uint currentPieSpeed = pieSpeeds[pToken];
        if (currentPieSpeed != 0) {
            // note that PIE speed could be set to 0 to halt liquidity rewards for a market
            Exp memory borrowIndex = Exp({mantissa: PTokenInterface(pToken).borrowIndex()});
            updatePieSupplyIndexInternal(pToken);
            updatePieBorrowIndexInternal(pToken, borrowIndex);
        } else if (pieSpeed != 0) {
            // Add the PIE market
            require(controller.checkIsListed(pToken) == true, "pie market is not listed");

            if (pieSupplyState[pToken].index == 0) {
                pieSupplyState[pToken] = PieMarketState({
                    index: pieInitialIndex,
                    block: safe32(getBlockNumber(), "block number exceeds 32 bits")
                });
            } else {
                pieSupplyState[pToken].block = safe32(getBlockNumber(), "block number exceeds 32 bits");
            }

            if (pieBorrowState[pToken].index == 0) {
                pieBorrowState[pToken] = PieMarketState({
                    index: pieInitialIndex,
                    block: safe32(getBlockNumber(), "block number exceeds 32 bits")
                });
            } else {
                pieBorrowState[pToken].block = safe32(getBlockNumber(), "block number exceeds 32 bits");
            }
        }

        if (currentPieSpeed != pieSpeed) {
            pieSpeeds[pToken] = pieSpeed;
            emit PieSpeedUpdated(pToken, pieSpeed);
        }
    }

    function updatePieSupplyIndex(address pToken) public override {
        require(msg.sender == address(controller), "only controller can update index");
        updatePieSupplyIndexInternal(pToken);
    }

    /**
     * @notice Accrue PIE to the market by updating the supply index
     * @param pToken The market whose supply index to update
     */
    function updatePieSupplyIndexInternal(address pToken) internal {
        PieMarketState storage supplyState = pieSupplyState[pToken];
        uint supplySpeed = pieSpeeds[pToken];
        uint blockNumber = getBlockNumber();
        uint deltaBlocks = sub_(blockNumber, uint(supplyState.block));
        if (deltaBlocks > 0 && supplySpeed > 0) {
            uint supplyTokens = PTokenInterface(pToken).totalSupply();
            uint pieAccrued = mul_(deltaBlocks, supplySpeed);
            Double memory ratio = supplyTokens > 0 ? fraction(pieAccrued, supplyTokens) : Double({mantissa: 0});
            Double memory index = add_(Double({mantissa: supplyState.index}), ratio);
            pieSupplyState[pToken] = PieMarketState({
                index: safe224(index.mantissa, "new index exceeds 224 bits"),
                block: safe32(blockNumber, "block number exceeds 32 bits")
            });
        }
    }

    function updatePieBorrowIndex(address pToken, Exp memory marketBorrowIndex) public override {
        require(msg.sender == address(controller), "only controller can update index");
        updatePieBorrowIndexInternal(pToken, marketBorrowIndex);
    }
    /**
     * @notice Accrue PIE to the market by updating the borrow index
     * @param pToken The market whose borrow index to update
     */
    function updatePieBorrowIndexInternal(address pToken, Exp memory marketBorrowIndex) internal {
        PieMarketState storage borrowState = pieBorrowState[pToken];
        uint borrowSpeed = pieSpeeds[pToken];
        uint blockNumber = getBlockNumber();
        uint deltaBlocks = sub_(blockNumber, uint(borrowState.block));
        if (deltaBlocks > 0 && borrowSpeed > 0) {
            uint borrowAmount = div_(PTokenInterface(pToken).totalBorrows(), marketBorrowIndex);
            uint pieAccrued = mul_(deltaBlocks, borrowSpeed);
            Double memory ratio = borrowAmount > 0 ? fraction(pieAccrued, borrowAmount) : Double({mantissa: 0});
            Double memory index = add_(Double({mantissa: borrowState.index}), ratio);
            pieBorrowState[pToken] = PieMarketState({
                index: safe224(index.mantissa, "new index exceeds 224 bits"),
                block: safe32(blockNumber, "block number exceeds 32 bits")
            });
        }
    }

    function distributeSupplierPie(address pToken, address supplier, bool distributeAll) public override {
        require(msg.sender == address(controller), "only controller can update index");
        distributeSupplierPieInternal(pToken, supplier, distributeAll);
    }

    /**
     * @notice Calculate PIE accrued by a supplier and possibly transfer it to them
     * @param pToken The market in which the supplier is interacting
     * @param supplier The address of the supplier to distribute PIE to
     */
    function distributeSupplierPieInternal(address pToken, address supplier, bool distributeAll) internal {
        PieMarketState storage supplyState = pieSupplyState[pToken];
        Double memory supplyIndex = Double({mantissa: supplyState.index});
        Double memory supplierIndex = Double({mantissa: pieSupplierIndex[pToken][supplier]});
        pieSupplierIndex[pToken][supplier] = supplyIndex.mantissa;

        if (supplierIndex.mantissa == 0 && supplyIndex.mantissa > 0) {
            supplierIndex.mantissa = pieInitialIndex;
        }

        Double memory deltaIndex = sub_(supplyIndex, supplierIndex);
        uint supplierTokens = PTokenInterface(pToken).balanceOf(supplier);
        uint supplierDelta = mul_(supplierTokens, deltaIndex);
        uint supplierAccrued = add_(pieAccrued[supplier], supplierDelta);
        pieAccrued[supplier] = transferPie(supplier, supplierAccrued, distributeAll ? 0 : pieClaimThreshold);
        emit DistributedSupplierPie(pToken, supplier, supplierDelta, supplyIndex.mantissa);
    }

    function distributeBorrowerPie(
        address pToken,
        address borrower,
        Exp memory marketBorrowIndex,
        bool distributeAll
    ) public override {
        require(msg.sender == address(controller), "only controller can update index");

        distributeBorrowerPieInternal(pToken, borrower, marketBorrowIndex, distributeAll);
    }

    /**
     * @notice Calculate PIE accrued by a borrower and possibly transfer it to them
     * @dev Borrowers will not begin to accrue until after the first interaction with the protocol.
     * @param pToken The market in which the borrower is interacting
     * @param borrower The address of the borrower to distribute PIE to
     */
    function distributeBorrowerPieInternal(
        address pToken,
        address borrower,
        Exp memory marketBorrowIndex,
        bool distributeAll
    ) internal {
        PieMarketState storage borrowState = pieBorrowState[pToken];
        Double memory borrowIndex = Double({mantissa: borrowState.index});
        Double memory borrowerIndex = Double({mantissa: pieBorrowerIndex[pToken][borrower]});
        pieBorrowerIndex[pToken][borrower] = borrowIndex.mantissa;

        if (borrowerIndex.mantissa > 0) {
            Double memory deltaIndex = sub_(borrowIndex, borrowerIndex);
            uint borrowerAmount = div_(PTokenInterface(pToken).borrowBalanceStored(borrower), marketBorrowIndex);
            uint borrowerDelta = mul_(borrowerAmount, deltaIndex);
            uint borrowerAccrued = add_(pieAccrued[borrower], borrowerDelta);
            pieAccrued[borrower] = transferPie(borrower, borrowerAccrued, distributeAll ? 0 : pieClaimThreshold);
            emit DistributedBorrowerPie(pToken, borrower, borrowerDelta, borrowIndex.mantissa);
        }
    }

    /**
     * @notice Claim all the pie accrued by holder in all markets
     * @param holder The address to claim PIE for
     */
    function claimPie(address holder) public {
        claimPie(holder, getAllMarkets());
    }

    /**
     * @notice Claim all the pie accrued by holder in the specified markets
     * @param holder The address to claim PIE for
     * @param pTokens The list of markets to claim PIE in
     */
    function claimPie(address holder, address[] memory pTokens) public {
        address[] memory holders = new address[](1);
        holders[0] = holder;
        claimPie(holders, pTokens, true, true);
    }

    /**
     * @notice Claim all pie accrued by the holders
     * @param holders The addresses to claim PIE for
     * @param pTokens The list of markets to claim PIE in
     * @param borrowers Whether or not to claim PIE earned by borrowing
     * @param suppliers Whether or not to claim PIE earned by supplying
     */
    function claimPie(address[] memory holders, address[] memory pTokens, bool borrowers, bool suppliers) public {
        for (uint i = 0; i < pTokens.length; i++) {
            address pToken = pTokens[i];
            require(controller.checkIsListed(pToken), "market must be listed");
            if (borrowers == true) {
                Exp memory borrowIndex = Exp({mantissa: PTokenInterface(pToken).borrowIndex()});
                updatePieBorrowIndexInternal(pToken, borrowIndex);
                for (uint j = 0; j < holders.length; j++) {
                    distributeBorrowerPieInternal(pToken, holders[j], borrowIndex, true);
                }
            }
            if (suppliers == true) {
                updatePieSupplyIndexInternal(pToken);
                for (uint j = 0; j < holders.length; j++) {
                    distributeSupplierPieInternal(pToken, holders[j], true);
                }
            }
        }
    }

    /**
     * @notice Transfer PIE to the user
     * @dev Note: If there is not enough PIE, we do not perform the transfer all.
     * @param user The address of the user to transfer PIE to
     * @param userAccrued The amount of PIE to (possibly) transfer
     * @return The userAccrued of PIE which was NOT transferred to the user
     */
    function transferPie(address user, uint userAccrued, uint threshold) internal returns (uint) {
        if (userAccrued >= threshold && userAccrued > 0) {
            address pie = getPieAddress();
            uint pieRemaining = EIP20Interface(pie).balanceOf(address(this));
            if (userAccrued <= pieRemaining) {
                EIP20Interface(pie).transfer(user, userAccrued);
                return 0;
            }
        }
        return userAccrued;
    }

    /*** Pie Distribution Admin ***/

    /**
    * @notice Set PIE speed for a single market
    * @param pToken The market whose PIE speed to update
    * @param pieSpeed New PIE speed for market
    */
    function _setPieSpeed(address pToken, uint pieSpeed) public {
        require(msg.sender == getAdmin(), "only admin can set pie speed");
        setPieSpeedInternal(pToken, pieSpeed);
    }

    /**
     * @notice Return all of the markets
     * @return The list of market addresses
     */
    function getAllMarkets() public view returns (address[] memory) {
        return controller.getAllMarkets();
    }

    /**
     * @notice Return the number of current block
     * @return The block number
     */
    function getBlockNumber() public view virtual returns (uint) {
        return block.number;
    }

    /**
     * @notice Return the address of the PIE token
     * @return The address of PIE
     */
    function getPieAddress() public view override virtual returns (address) {
        return pieAddress;
    }

    /**
     * @notice Return the address of the admin
     * @return The address of admin
     */
    function getAdmin() public view returns (address) {
        return registry.admin();
    }
}