// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "../Oracles/PriceOracle.sol";
import '../RegistryInterface.sol';

contract DistributorStorage {
    /**
    * @notice Active brains of Distributor
    */
    address public implementation;

    /**
    * @notice Administrator for this contract in registry
    */
    RegistryInterface public registry;

    /**
    * @notice Administrator for this contract in registry
    */
    ControllerInterface public controller;

    /// @notice index The market's last updated pieBorrowIndex or pieSupplyIndex
    /// @notice block The block number the index was last updated at
    struct PieMarketState {
        uint224 index;
        uint32 block;
    }

    /// @notice Address of the PIE token
    address public pieAddress;

    /// @notice The portion of pieRate that each market currently receives
    mapping(address => uint) public pieSpeeds;

    /// @notice The PIE market supply state for each market
    mapping(address => PieMarketState) public pieSupplyState;

    /// @notice The PIE market borrow state for each market
    mapping(address => PieMarketState) public pieBorrowState;

    /// @notice The PIE borrow index for each market for each supplier as of the last time they accrued PIE
    mapping(address => mapping(address => uint)) public pieSupplierIndex;

    /// @notice The PIE borrow index for each market for each borrower as of the last time they accrued PIE
    mapping(address => mapping(address => uint)) public pieBorrowerIndex;

    /// @notice The PIE accrued but not yet transferred to each user
    mapping(address => uint) public pieAccrued;
}