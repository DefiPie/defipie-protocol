// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "../../contracts/EIP20Interface.sol";

abstract contract TetherInterface is EIP20Interface {
    function setParams(uint newBasisPoints, uint newMaxFee) external virtual;
}