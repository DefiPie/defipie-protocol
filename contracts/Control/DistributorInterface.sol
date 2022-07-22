// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "../Oracles/PriceOracle.sol";
import "../Exponential.sol";

abstract contract DistributorInterface {
    function getPieAddress() public view virtual returns (address);

    function updatePieSupplyIndex(address pToken) public virtual;
    function distributeSupplierPie(address pToken, address supplier, bool distributeAll) public virtual;

    function updatePieBorrowIndex(address pToken, Exponential.Exp memory marketBorrowIndex) public virtual;
    function distributeBorrowerPie(
        address pToken,
        address borrower,
        Exponential.Exp memory marketBorrowIndex,
        bool distributeAll
    ) public virtual;
}
