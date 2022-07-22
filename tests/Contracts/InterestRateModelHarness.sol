// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "../../contracts/Models/InterestRateModel.sol";

/**
  * @title An Interest Rate Model for tests that can be instructed to return a failure instead of doing a calculation
  * @author DeFiPie
  */
contract InterestRateModelHarness is InterestRateModel {
    uint public constant opaqueBorrowFailureCode = 20;
    bool public failBorrowRate;
    uint public borrowRate;

    constructor(uint borrowRate_) {
        borrowRate = borrowRate_;
    }

    function setFailBorrowRate(bool failBorrowRate_) public {
        failBorrowRate = failBorrowRate_;
    }

    function setBorrowRate(uint borrowRate_) public {
        borrowRate = borrowRate_;
    }

    function getBorrowRate(uint, uint, uint) public view override returns (uint) {
        require(!failBorrowRate, "INTEREST_RATE_MODEL_ERROR");
        return borrowRate;
    }

    function getSupplyRate(uint, uint, uint, uint _reserveFactor) external view override returns (uint) {
        return borrowRate * (1e18 - _reserveFactor) / 1e18;
    }
}
