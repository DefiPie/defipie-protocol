pragma solidity ^0.7.4;

import '../../contracts/RegistryProxy.sol';

contract RegistryProxyHarness is RegistryProxy {
    constructor(
        address implementation_,
        address pTokenImplementation_
    ) RegistryProxy(
        implementation_,
        pTokenImplementation_
    ) {}

    function setPTokenImplementation(address newImplementation) external returns(uint256) {
        newImplementation; // Shh
        delegateAndReturn();
    }

    function pTokenImplementation() public returns (address) {
        delegateAndReturn();
    }

    function _setFactoryContract(address factory_) external returns(uint) {
        factory_; // Shh
        delegateAndReturn();
    }

    function addPPIE(address pPIE_) public returns(uint) {
        pPIE_; // Shh
        delegateAndReturn();
    }

    function pPIE() public returns (address) {
        delegateAndReturn();
    }
}
