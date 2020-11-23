pragma solidity ^0.7.4;

import "./PTokenInterfaces.sol";
import './RegistryStorage.sol';
import "./ErrorReporter.sol";

contract Registry is RegistryStorage, RegistryErrorReporter {

    address public factory;
    address public pTokenImplementation;

    mapping (address => address) public pTokens;
    address public pETH;
    address public pPIE;

    /*** Admin Events ***/

    /**
     * @notice Event emitted when pendingAdmin is changed
     */
    event NewPendingAdmin(address oldPendingAdmin, address newPendingAdmin);

    /**
     * @notice Event emitted when pendingAdmin is accepted, which means admin is updated
     */
    event NewAdmin(address oldAdmin, address newAdmin);

    /**
      * @notice Emitted when PTokenImplementation is changed
      */
    event NewPTokenImplementation(address oldImplementation, address newImplementation);

    constructor() {}

    function initialize(address _pTokenImplementation) public {
        require(pTokenImplementation == address(0), "Registry may only be initialized once");

        pTokenImplementation = _pTokenImplementation;
    }

    /**
     *  Sets address of actual pToken implementation contract
     *  @return uint 0 = success, otherwise a failure (see ErrorReporter.sol for details)
     */
    function setPTokenImplementation(address newImplementation) external returns (uint) {
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_NEW_IMPLEMENTATION);
        }

        address oldImplementation = pTokenImplementation;
        pTokenImplementation = newImplementation;

        emit NewPTokenImplementation(oldImplementation, pTokenImplementation);

        return(uint(Error.NO_ERROR));
    }

    function _setFactoryContract(address _factory) external returns (uint) {
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_NEW_FACTORY);
        }

        factory = _factory;
        return uint(Error.NO_ERROR);
    }

    function addPToken(address underlying, address pToken) public returns (uint) {
        require(msg.sender == admin || msg.sender == factory, "Only admin or factory can add PTokens");

        PTokenInterface(pToken).isPToken(); // Sanity check to make sure its really a PToken

        require(pTokens[underlying] == address(0), "Token already added");
        pTokens[underlying] = pToken;

        return uint(Error.NO_ERROR);
    }

    function addPETH(address pETH_) public returns (uint) {
        require(msg.sender == admin || msg.sender == factory, "Only admin or factory can add PETH");

        PTokenInterface(pETH_).isPToken(); // Sanity check to make sure its really a PToken

        require(pETH == address(0), "ETH already added");
        pETH = pETH_;

        return uint(Error.NO_ERROR);
    }

    function addPPIE(address pPIE_) public returns (uint) {
        require(msg.sender == admin || msg.sender == factory, "Only admin or factory can add PPIE");

        PTokenInterface(pPIE_).isPToken(); // Sanity check to make sure its really a PToken

        require(pPIE == address(0), "PIE already added");
        pPIE = pPIE_;

        return uint(Error.NO_ERROR);
    }
}