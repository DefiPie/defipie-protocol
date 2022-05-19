// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

import "../../../contracts/Control/Controller.sol";
import "../../../contracts/Oracles/PriceOracle.sol";

contract ControllerHarness is Controller {
    uint public blockNumber;

    constructor() Controller() {}

    function setPauseGuardian(address harnessedPauseGuardian) public {
        pauseGuardian = harnessedPauseGuardian;
    }

    function harnessFastForward(uint blocks) public returns (uint) {
        blockNumber += blocks;
        return blockNumber;
    }

    function setBlockNumber(uint number) public {
        blockNumber = number;
    }

    function getBlockNumber() public view override returns (uint) {
        return blockNumber;
    }

    function setSupportMarket(address market, bool isListed_) public {
        markets[market].isListed = isListed_;
    }
}

contract ControllerHarnessWithAdmin is ControllerHarness {
    address public admin;

    constructor() ControllerHarness() {
        admin = msg.sender;
    }

    function getAdmin() public view override returns (address) {
        return admin;
    }

}

contract ControllerBorked {
    function _become(address unitroller) public {
        require(msg.sender == Unitroller(payable(unitroller)).getAdmin(), "only unitroller admin can change brains");
        Unitroller(payable(unitroller))._acceptImplementation();
    }
}

contract BoolController is ControllerInterface {
    address public pie;

    bool allowMint = true;
    bool allowRedeem = true;
    bool allowBorrow = true;
    bool allowRepayBorrow = true;
    bool allowLiquidateBorrow = true;
    bool allowSeize = true;
    bool allowTransfer = true;

    bool verifyMint = true;
    bool verifyRedeem = true;
    bool verifyBorrow = true;
    bool verifyRepayBorrow = true;
    bool verifyLiquidateBorrow = true;
    bool verifySeize = true;
    bool verifyTransfer = true;

    bool failCalculateSeizeTokens;
    uint calculatedSeizeTokens;

    uint noError = 0;
    uint opaqueError = noError + 10; // an arbitrary, opaque error code

    PriceOracle oracle;

    constructor(address oracle_) {
        oracle = PriceOracle(oracle_);
    }

    function getOracle() external view override returns (PriceOracle) {
        return oracle;
    }

    /*** Assets You Are In ***/

    function enterMarkets(address[] calldata _pTokens) external override returns (uint[] memory) {
        _pTokens;
        uint[] memory ret;
        return ret;
    }

    function exitMarket(address _pToken) external override returns (uint) {
        _pToken;
        return noError;
    }

    /*** Policy Hooks ***/

    function mintAllowed(address _pToken, address _minter, uint _mintAmount) public override returns (uint) {
        _pToken;
        _minter;
        _mintAmount;
        return allowMint ? noError : opaqueError;
    }

    function redeemAllowed(address _pToken, address _redeemer, uint _redeemTokens) public override returns (uint) {
        _pToken;
        _redeemer;
        _redeemTokens;
        return allowRedeem ? noError : opaqueError;
    }

    function redeemVerify(address _pToken, address _redeemer, uint _redeemAmount, uint _redeemTokens) external override {
        _pToken;
        _redeemer;
        _redeemAmount;
        _redeemTokens;
        require(verifyRedeem, "redeemVerify rejected redeem");
    }

    function borrowAllowed(address _pToken, address _borrower, uint _borrowAmount) public override returns (uint) {
        _pToken;
        _borrower;
        _borrowAmount;
        return allowBorrow ? noError : opaqueError;
    }

    function repayBorrowAllowed(
        address _pToken,
        address _payer,
        address _borrower,
        uint _repayAmount) public override returns (uint) {
        _pToken;
        _payer;
        _borrower;
        _repayAmount;
        return allowRepayBorrow ? noError : opaqueError;
    }

    function liquidateBorrowAllowed(
        address _pTokenBorrowed,
        address _pTokenCollateral,
        address _liquidator,
        address _borrower,
        uint _repayAmount) public override returns (uint) {
        _pTokenBorrowed;
        _pTokenCollateral;
        _liquidator;
        _borrower;
        _repayAmount;
        return allowLiquidateBorrow ? noError : opaqueError;
    }

    function seizeAllowed(
        address _pTokenCollateral,
        address _pTokenBorrowed,
        address _borrower,
        address _liquidator,
        uint _seizeTokens) public override returns (uint) {
        _pTokenCollateral;
        _pTokenBorrowed;
        _liquidator;
        _borrower;
        _seizeTokens;
        return allowSeize ? noError : opaqueError;
    }

    function transferAllowed(
        address _pToken,
        address _src,
        address _dst,
        uint _transferTokens) public override returns (uint) {
        _pToken;
        _src;
        _dst;
        _transferTokens;
        return allowTransfer ? noError : opaqueError;
    }

    /*** Special Liquidation Calculation ***/

    function liquidateCalculateSeizeTokens(
        address _pTokenBorrowed,
        address _pTokenCollateral,
        uint _repayAmount
    ) public view override returns (uint, uint) {
        _pTokenBorrowed;
        _pTokenCollateral;
        _repayAmount;
        return failCalculateSeizeTokens ? (opaqueError, 0) : (noError, calculatedSeizeTokens);
    }

    function _setFeeFactor(address, uint) external override returns (uint) {
        return 0;
    }

    /**** Mock Settors ****/

    /*** Policy Hooks ***/

    function setMintAllowed(bool allowMint_) public {
        allowMint = allowMint_;
    }

    function setRedeemAllowed(bool allowRedeem_) public {
        allowRedeem = allowRedeem_;
    }

    function setRedeemVerify(bool verifyRedeem_) public {
        verifyRedeem = verifyRedeem_;
    }

    function setBorrowAllowed(bool allowBorrow_) public {
        allowBorrow = allowBorrow_;
    }

    function setRepayBorrowAllowed(bool allowRepayBorrow_) public {
        allowRepayBorrow = allowRepayBorrow_;
    }

    function setLiquidateBorrowAllowed(bool allowLiquidateBorrow_) public {
        allowLiquidateBorrow = allowLiquidateBorrow_;
    }

    function setSeizeAllowed(bool allowSeize_) public {
        allowSeize = allowSeize_;
    }

    function setTransferAllowed(bool allowTransfer_) public {
        allowTransfer = allowTransfer_;
    }

    /*** Liquidity/Liquidation Calculations ***/

    function setCalculatedSeizeTokens(uint seizeTokens_) public {
        calculatedSeizeTokens = seizeTokens_;
    }

    function setFailCalculateSeizeTokens(bool shouldFail) public {
        failCalculateSeizeTokens = shouldFail;
    }

    uint supportAnswer;

    function setSupportAnswer(uint supportAnswer_) public {
        supportAnswer = supportAnswer_;
    }

    function _supportMarket(address) external returns (uint) {
        return supportAnswer;
    }

    uint factoryAnswer;

    function _setFactoryContract(address) external returns(uint) {
        return factoryAnswer;
    }

    function setFactoryAnswer(uint factoryAnswer_) public {
        supportAnswer = factoryAnswer_;
    }

    function getFeeFactorMantissa(address pToken) public view override returns (uint) {
        return 0;
    }

    function getBorrowDelay() public view override returns (uint) {
        return 0;
    }

    function checkIsListed(address pToken) external view override returns (bool) {
        return true;
    }

    function getAllMarkets() public view override returns (address[] memory allMarkets) {
        return allMarkets;
    }

    function setFreezePoolAmount(address pToken, uint amount) public override {
        // nothing
    }
}

contract EchoTypesController is UnitrollerAdminStorage {
    function stringy(string memory s) public pure returns(string memory) {
        return s;
    }

    function addresses(address a) public pure returns(address) {
        return a;
    }

    function booly(bool b) public pure returns(bool) {
        return b;
    }

    function listOInts(uint[] memory u) public pure returns(uint[] memory) {
        return u;
    }

    function reverty() public pure {
        require(false, "check revert");
    }

    function becomeBrains(address unitroller) public {
        Unitroller(payable(unitroller))._acceptImplementation();
    }
}
