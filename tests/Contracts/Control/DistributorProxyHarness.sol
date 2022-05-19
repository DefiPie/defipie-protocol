// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import '../../../contracts/Control/DistributorProxy.sol';

contract DistributorProxyHarness is DistributorProxy {
    constructor(
        address implementation_,
        address registry_,
        address controller_
    ) DistributorProxy(
        implementation_,
        registry_,
        controller_)
    {}

    function getAdmin() public returns (address) {
        delegateAndReturn();
    }

    function _setPieSpeed(address pToken, uint pieSpeed) public {
        delegateAndReturn();
    }

    function _setPieRate(uint pieRate_) public {
        delegateAndReturn();
    }

    function getPieMarkets() public returns (address[] memory) {
        delegateAndReturn();
    }

    function harnessRefreshPieSpeeds() public {
        delegateAndReturn();
    }

    function claimPie(address holder) public {
        delegateAndReturn();
    }

    function _setPieAddress(address pieAddress_) public returns (uint) {
        delegateAndReturn();
    }

    function getPieAddress() public returns (address) {
        delegateAndReturn();
    }

    function getBlockNumber() public returns (uint) {
        delegateAndReturn();
    }

    function getAllMarkets() public returns (address[] memory) {
        delegateAndReturn();
    }

    function fastForward(uint blocks) public returns (uint) {
        delegateAndReturn();
    }

    function pieRate() public returns (uint) {
        delegateAndReturn();
    }
}
