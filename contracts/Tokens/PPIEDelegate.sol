// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "./PPIE.sol";
import "../RegistryInterface.sol";

/**
 * @title DeFiPie's PPIEDelegate Contract
 * @notice PTokens which wrap an EIP-20 underlying and are delegated to
 * @author DeFiPie
 */
contract PPIEDelegate is PPIE {
    /**
     * @notice Construct an empty delegate
     */
    constructor() {}
}