pragma solidity ^0.7.6;

import "./PTokenInterfaces.sol";
import './RegistryStorage.sol';
import "./ErrorReporter.sol";
import "./Controller.sol";
import "./PTokenFactory.sol";

contract Registry is RegistryStorage, RegistryErrorReporter {

    address public factory;
    address public pTokenImplementation;
    address public oracle;

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

    /**
      * @notice Emitted when Factory address is changed
      */
    event NewFactory(address oldFactory, address newFactory);

    /**
      * @notice Emitted when Oracle address is changed
      */
    event NewOracle(address oldOracle, address newOracle);

    /**
      * @notice Emitted when admin remove pToken
      */
    event RemovePToken(address pToken);

    constructor() {}

    function initialize(address _pTokenImplementation) public {
        require(pTokenImplementation == address(0), "Registry may only be initialized once");

        pTokenImplementation = _pTokenImplementation;
    }

    /**
     *  Sets address of actual pToken implementation contract
     *  @return uint 0 = success, otherwise a failure (see ErrorReporter.sol for details)
     */
    function _setPTokenImplementation(address newImplementation) external returns (uint) {
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

        address oldFactory = factory;
        factory = _factory;

        emit NewFactory(oldFactory, factory);

        return uint(Error.NO_ERROR);
    }

    function _setOracle(address _oracle) public returns (uint) {
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_NEW_ORACLE);
        }

        address oldOracle = oracle;
        oracle = _oracle;

        emit NewOracle(oldOracle, oracle);

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

        address underlying = PErc20Storage(pPIE).underlying();
        pTokens[underlying] = pPIE;

        return uint(Error.NO_ERROR);
    }

    function _removePToken(address pToken) public returns (uint) {
        require(msg.sender == admin, "Only admin can remove PTokens");

        PTokenInterface(pToken).isPToken(); // Sanity check to make sure its really a PToken

        address underlying = PErc20Storage(pToken).underlying();
        require(pTokens[underlying] != address(0), "Token not added");
        delete pTokens[underlying];

        emit RemovePToken(pToken);

        return uint(Error.NO_ERROR);
    }
}