// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import '../../contracts/RegistryProxy.sol';

contract RegistryProxyHarness is RegistryProxy {
    constructor(
        address implementation_,
        address pTokenImplementation_
    ) RegistryProxy(
        implementation_,
        pTokenImplementation_
    ) {}

    function _setPTokenImplementation(address) external returns (uint) {
        delegateAndReturn();
    }

    function pTokenImplementation() public returns (address) {
        delegateAndReturn();
    }

    function _setFactoryContract(address) external returns (uint) {
        delegateAndReturn();
    }

    function _setOracle(address) public returns (uint) {
        delegateAndReturn();
    }

    function addPToken(address, address) public returns (uint) {
        delegateAndReturn();
    }

    function addPPIE(address) public returns (uint) {
        delegateAndReturn();
    }

    function pPIE() public returns (address) {
        delegateAndReturn();
    }

    function addPETH(address) public returns (uint) {
        delegateAndReturn();
    }

    function pETH() public returns (address) {
        delegateAndReturn();
    }

    function factory() public returns (address) {
        delegateAndReturn();
    }

    function oracle() public returns (address) {
        delegateAndReturn();
    }

    function pTokens(address) public returns (address) {
        delegateAndReturn();
    }

    function _removePToken(address) public returns (uint) {
        delegateAndReturn();
    }
}
