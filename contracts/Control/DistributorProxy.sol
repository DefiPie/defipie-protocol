// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import './DistributorStorage.sol';
import "../ErrorReporter.sol";
import './DistributorInterface.sol';

contract DistributorProxy is DistributorStorage, DistributorErrorReporter {

    /*** Admin Events ***/

    /**
      * @notice Emitted when implementation is changed
      */
    event NewImplementation(address oldImplementation, address newImplementation);

    constructor(
        address implementation_,
        address registry_,
        address controller_
    ) {
        implementation = implementation_;
        registry = RegistryInterface(registry_);
        controller = ControllerInterface(controller_);
    }

    function _setDistributorImplementation(address newImplementation) external returns(uint256) {
        if (msg.sender != registry.admin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_NEW_IMPLEMENTATION);
        }

        address oldImplementation = implementation;
        implementation = newImplementation;

        emit NewImplementation(oldImplementation, implementation);

        return(uint(Error.NO_ERROR));
    }

    /**
     * @notice Internal method to delegate execution to another contract
     * @dev It returns to the external caller whatever the implementation returns or forwards reverts
     * @param callee The contract to delegatecall
     * @param data The raw data to delegatecall
     * @return The returned bytes from the delegatecall
     */
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