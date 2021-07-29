pragma solidity ^0.7.6;

import "../../contracts/ProxyWithRegistry.sol";

contract EvilXProxyToken is ImplementationStorage {

    constructor(
        address implementation_,
        uint256 _initialAmount,
        string memory _tokenName,
        string memory _tokenSymbol,
        uint8 _decimalUnits
    ) {
        _setImplementation(implementation_);

        // First delegate gets to initialize the delegator (i.e. storage contract)
        delegateTo(implementation_, abi.encodeWithSignature("initialize(uint256,string,string,uint8)",
                _initialAmount,
                _tokenName,
                _tokenSymbol,
                _decimalUnits));
    }

    function setImplementation(address newImplementation) external returns (uint) {
        address oldImplementation = implementation;
        _setImplementation(newImplementation);

        return 0;
    }

    function delegateTo(address callee, bytes memory data) internal returns (bytes memory) {
        (bool success, bytes memory returnData) = callee.delegatecall(data);
        assembly {
            if eq(success, 0) {
                revert(add(returnData, 0x20), returndatasize())
            }
        }
        return returnData;
    }

    function delegateAndReturn() internal returns (bytes memory) {
        (bool success, ) = implementation.delegatecall(msg.data);

        assembly {
            let free_mem_ptr := mload(0x40)
            returndatacopy(free_mem_ptr, 0, returndatasize())

            switch success
            case 0 { revert(free_mem_ptr, returndatasize()) }
            default { return(free_mem_ptr, returndatasize()) }
        }
    }

    /**
     * @notice Delegates execution to an implementation contract
     * @dev It returns to the external caller whatever the implementation returns or forwards reverts
     */
    fallback() external {
        // delegate all other functions to current implementation
        delegateAndReturn();
    }
}
