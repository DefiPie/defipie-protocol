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

    function setPTokenImplementation(address newImplementation) external returns (uint) {
        newImplementation; // Shh
        delegateAndReturn();
    }

    function pTokenImplementation() public returns (address) {
        delegateAndReturn();
    }

    function _setFactoryContract(address factory_) external returns (uint) {
        factory_; // Shh
        delegateAndReturn();
    }

    function addPToken(address underlying_, address pToken_) public returns (uint) {
        pToken_; // Shh
        underlying_; // Shh
        delegateAndReturn();
    }

    function addPPIE(address pPIE_) public returns (uint) {
        pPIE_; // Shh
        delegateAndReturn();
    }

    function pPIE() public returns (address) {
        delegateAndReturn();
    }

    function addPETH(address pETH_) public returns (uint) {
        pETH_; // Shh
        delegateAndReturn();
    }

    function pETH() public returns (address) {
        delegateAndReturn();
    }

    function factory() public returns (address) {
        delegateAndReturn();
    }

    function pTokens(address underlying_) public returns (address) {
        underlying_; // Shh
        delegateAndReturn();
    }

    function removePToken(address pToken_) public returns (uint) {
        pToken_; // Shh
        delegateAndReturn();
    }
}
