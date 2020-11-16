// SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;

import "../../contracts/Controller.sol";
import "../../contracts/PriceOracle.sol";

contract ControllerHarness is Controller {
    uint public blockNumber;

    constructor() Controller() {}

    function setPauseGuardian(address harnessedPauseGuardian) public {
        pauseGuardian = harnessedPauseGuardian;
    }

    function setPieSupplyState(address pToken, uint224 index, uint32 blockNumber_) public {
        pieSupplyState[pToken].index = index;
        pieSupplyState[pToken].block = blockNumber_;
    }

    function setPieBorrowState(address pToken, uint224 index, uint32 blockNumber_) public {
        pieBorrowState[pToken].index = index;
        pieBorrowState[pToken].block = blockNumber_;
    }

    function setPieAccrued(address user, uint userAccrued) public {
        pieAccrued[user] = userAccrued;
    }

    function setPieAddress(address pieAddress_) public {
        pieAddress = pieAddress_;
    }

    function getPieAddress() public view override returns (address) {
        return pieAddress;
    }

    function setPieSpeed(address pToken, uint pieSpeed) public {
        pieSpeeds[pToken] = pieSpeed;
    }

    function setPieBorrowerIndex(address pToken, address borrower, uint index) public {
        pieBorrowerIndex[pToken][borrower] = index;
    }

    function setPieSupplierIndex(address pToken, address supplier, uint index) public {
        pieSupplierIndex[pToken][supplier] = index;
    }

    function harnessUpdatePieBorrowIndex(address pToken, uint marketBorrowIndexMantissa) public {
        updatePieBorrowIndex(pToken, Exp({mantissa: marketBorrowIndexMantissa}));
    }

    function harnessUpdatePieSupplyIndex(address pToken) public {
        updatePieSupplyIndex(pToken);
    }

    function harnessDistributeBorrowerPie(address pToken, address borrower, uint marketBorrowIndexMantissa) public {
        distributeBorrowerPie(pToken, borrower, Exp({mantissa: marketBorrowIndexMantissa}), false);
    }

    function harnessDistributeSupplierPie(address pToken, address supplier) public {
        distributeSupplierPie(pToken, supplier, false);
    }

    function harnessTransferPie(address user, uint userAccrued, uint threshold) public returns (uint) {
        return transferPie(user, userAccrued, threshold);
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

    function getPieMarkets() public view returns (address[] memory) {
        uint m = allMarkets.length;
        uint n = 0;
        for (uint i = 0; i < m; i++) {
            if (markets[address(allMarkets[i])].isPied) {
                n++;
            }
        }

        address[] memory pieMarkets = new address[](n);
        uint k = 0;
        for (uint i = 0; i < m; i++) {
            if (markets[address(allMarkets[i])].isPied) {
                pieMarkets[k++] = address(allMarkets[i]);
            }
        }
        return pieMarkets;
    }

    function setSupportMarket(address market, bool isListed_) public {
        markets[market].isListed = isListed_;
    }
}

contract ControllerBorked {
    function _become(Unitroller unitroller, uint pieRate_, address[] memory pieMarketsToAdd) public {
        pieRate_;
        pieMarketsToAdd;

        require(msg.sender == unitroller.admin(), "only unitroller admin can change brains");
        unitroller._acceptImplementation();
    }
}

contract BoolController is ControllerInterface {

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
    uint opaqueError = noError + 11; // an arbitrary, opaque error code

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

    function mintVerify(address _pToken, address _minter, uint _mintAmount, uint _mintTokens) external override {
        _pToken;
        _minter;
        _mintAmount;
        _mintTokens;
        require(verifyMint, "mintVerify rejected mint");
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

    function borrowVerify(address _pToken, address _borrower, uint _borrowAmount) external override {
        _pToken;
        _borrower;
        _borrowAmount;
        require(verifyBorrow, "borrowVerify rejected borrow");
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

    function repayBorrowVerify(
        address _pToken,
        address _payer,
        address _borrower,
        uint _repayAmount,
        uint _borrowerIndex) external override {
        _pToken;
        _payer;
        _borrower;
        _repayAmount;
        _borrowerIndex;
        require(verifyRepayBorrow, "repayBorrowVerify rejected repayBorrow");
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

    function liquidateBorrowVerify(
        address _pTokenBorrowed,
        address _pTokenCollateral,
        address _liquidator,
        address _borrower,
        uint _repayAmount,
        uint _seizeTokens) external override {
        _pTokenBorrowed;
        _pTokenCollateral;
        _liquidator;
        _borrower;
        _repayAmount;
        _seizeTokens;
        require(verifyLiquidateBorrow, "liquidateBorrowVerify rejected liquidateBorrow");
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

    function seizeVerify(
        address _pTokenCollateral,
        address _pTokenBorrowed,
        address _liquidator,
        address _borrower,
        uint _seizeTokens) external override {
        _pTokenCollateral;
        _pTokenBorrowed;
        _liquidator;
        _borrower;
        _seizeTokens;
        require(verifySeize, "seizeVerify rejected seize");
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

    function transferVerify(
        address _pToken,
        address _src,
        address _dst,
        uint _transferTokens) external override {
        _pToken;
        _src;
        _dst;
        _transferTokens;
        require(verifyTransfer, "transferVerify rejected transfer");
    }

    /*** Special Liquidation Calculation ***/

    function liquidateCalculateSeizeTokens(
        address _pTokenBorrowed,
        address _pTokenCollateral,
        uint _repayAmount) public view override returns (uint, uint) {
        _pTokenBorrowed;
        _pTokenCollateral;
        _repayAmount;
        return failCalculateSeizeTokens ? (opaqueError, 0) : (noError, calculatedSeizeTokens);
    }

    /**** Mock Settors ****/

    /*** Policy Hooks ***/

    function setMintAllowed(bool allowMint_) public {
        allowMint = allowMint_;
    }

    function setMintVerify(bool verifyMint_) public {
        verifyMint = verifyMint_;
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

    function setBorrowVerify(bool verifyBorrow_) public {
        verifyBorrow = verifyBorrow_;
    }

    function setRepayBorrowAllowed(bool allowRepayBorrow_) public {
        allowRepayBorrow = allowRepayBorrow_;
    }

    function setRepayBorrowVerify(bool verifyRepayBorrow_) public {
        verifyRepayBorrow = verifyRepayBorrow_;
    }

    function setLiquidateBorrowAllowed(bool allowLiquidateBorrow_) public {
        allowLiquidateBorrow = allowLiquidateBorrow_;
    }

    function setLiquidateBorrowVerify(bool verifyLiquidateBorrow_) public {
        verifyLiquidateBorrow = verifyLiquidateBorrow_;
    }

    function setSeizeAllowed(bool allowSeize_) public {
        allowSeize = allowSeize_;
    }

    function setSeizeVerify(bool verifySeize_) public {
        verifySeize = verifySeize_;
    }

    function setTransferAllowed(bool allowTransfer_) public {
        allowTransfer = allowTransfer_;
    }

    function setTransferVerify(bool verifyTransfer_) public {
        verifyTransfer = verifyTransfer_;
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

    function becomeBrains(address payable unitroller) public {
        Unitroller(unitroller)._acceptImplementation();
    }
}
