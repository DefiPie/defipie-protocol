// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "../../contracts/Tokens/EIP20Interface.sol";

abstract contract TetherInterface is EIP20Interface {
    function setParams(uint newBasisPoints, uint newMaxFee) external virtual;
}