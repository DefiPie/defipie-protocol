// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "../../contracts/PErc20.sol";
import "../../contracts/PErc20Delegator.sol";
import "../../contracts/PErc20Delegate.sol";
import "./ControllerScenario.sol";

contract PErc20Harness is PErc20 {
    uint blockNumber = 100000;
    uint harnessExchangeRate;
    bool harnessExchangeRateStored;

    mapping (address => bool) public failTransferToAddresses;

    constructor(
        address underlying_,
        RegistryInterface registry_,
        ControllerInterface controller_,
        InterestRateModel interestRateModel_,
        uint initialExchangeRateMantissa_,
        uint initialReserveFactorMantissa_,
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) {
        initialize(underlying_, registry_, controller_, interestRateModel_, initialExchangeRateMantissa_, initialReserveFactorMantissa_, name_, symbol_, decimals_);
    }

    function doTransferOut(address payable to, uint amount) internal override {
        require(failTransferToAddresses[to] == false, "TOKEN_TRANSFER_OUT_FAILED");
        return super.doTransferOut(to, amount);
    }

    function exchangeRateStoredInternal() internal view override returns (MathError, uint) {
        if (harnessExchangeRateStored) {
            return (MathError.NO_ERROR, harnessExchangeRate);
        }
        return super.exchangeRateStoredInternal();
    }

    function getBlockNumber() internal view override returns (uint) {
        return blockNumber;
    }

    function getBorrowRateMaxMantissa() public pure returns (uint) {
        return borrowRateMaxMantissa;
    }

    function harnessSetAccrualBlockNumber(uint _accrualblockNumber) public {
        accrualBlockNumber = _accrualblockNumber;
    }

    function harnessSetBlockNumber(uint newBlockNumber) public {
        blockNumber = newBlockNumber;
    }

    function harnessFastForward(uint blocks) public {
        blockNumber += blocks;
    }

    function harnessSetBalance(address account, uint amount) external {
        accountTokens[account] = amount;
    }

    function harnessSetTotalSupply(uint totalSupply_) public {
        totalSupply = totalSupply_;
    }

    function harnessSetTotalBorrows(uint totalBorrows_) public {
        totalBorrows = totalBorrows_;
    }

    function harnessSetTotalReserves(uint totalReserves_) public {
        totalReserves = totalReserves_;
    }

    function harnessExchangeRateDetails(uint totalSupply_, uint totalBorrows_, uint totalReserves_) public {
        totalSupply = totalSupply_;
        totalBorrows = totalBorrows_;
        totalReserves = totalReserves_;
    }

    function harnessSetExchangeRate(uint exchangeRate) public {
        harnessExchangeRate = exchangeRate;
        harnessExchangeRateStored = true;
    }

    function harnessSetFailTransferToAddress(address _to, bool _fail) public {
        failTransferToAddresses[_to] = _fail;
    }

    function harnessMintFresh(address account, uint mintAmount) public returns (uint) {
        (uint err,,) = super.mintFresh(account, mintAmount);
        return err;
    }

    function harnessRedeemFresh(address payable account, uint pTokenAmount, uint underlyingAmount) public returns (uint) {
        (uint err,,) = super.redeemFresh(account, pTokenAmount, underlyingAmount);
        return err;
    }

    function harnessAccountBorrows(address account) public view returns (uint principal, uint interestIndex) {
        BorrowSnapshot memory snapshot = accountBorrows[account];
        return (snapshot.principal, snapshot.interestIndex);
    }

    function harnessSetAccountBorrows(address account, uint principal, uint interestIndex) public {
        accountBorrows[account] = BorrowSnapshot({principal: principal, interestIndex: interestIndex});
    }

    function harnessSetBorrowIndex(uint borrowIndex_) public {
        borrowIndex = borrowIndex_;
    }

    function harnessBorrowFresh(address payable account, uint borrowAmount) public returns (uint) {
        return borrowFresh(account, borrowAmount);
    }

    function harnessRepayBorrowFresh(address payer, address account, uint repayAmount) public returns (uint) {
        (uint err,,) = repayBorrowFresh(payer, account, repayAmount);
        return err;
    }

    function harnessLiquidateBorrowFresh(address liquidator, address borrower, uint repayAmount, PToken pTokenCollateral) public returns (uint) {
        (uint err,) = liquidateBorrowFresh(liquidator, borrower, repayAmount, pTokenCollateral);
        return err;
    }

    function harnessReduceReservesFresh(uint amount) public returns (uint) {
        return _reduceReservesFresh(amount);
    }

    function harnessSetReserveFactorFresh(uint newReserveFactorMantissa) public returns (uint) {
        return _setReserveFactorFresh(newReserveFactorMantissa);
    }

    function harnessSetInterestRateModelFresh(InterestRateModel newInterestRateModel) public returns (uint) {
        return _setInterestRateModelFresh(newInterestRateModel);
    }

    function harnessSetInterestRateModel(address newInterestRateModelAddress) public {
        interestRateModel = InterestRateModel(newInterestRateModelAddress);
    }

    function harnessCallBorrowAllowed(uint amount) public returns (uint) {
        return controller.borrowAllowed(address(this), msg.sender, amount);
    }
}

contract PErc20Scenario is PErc20 {
    constructor(
        address underlying_,
        RegistryInterface registry_,
        ControllerInterface controller_,
        InterestRateModel interestRateModel_,
        uint initialExchangeRateMantissa_,
        uint initialReserveFactorMantissa_,
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) {
        initialize(underlying_, registry_, controller_, interestRateModel_, initialExchangeRateMantissa_, initialReserveFactorMantissa_, name_, symbol_, decimals_);
    }

    function setTotalBorrows(uint totalBorrows_) public {
        totalBorrows = totalBorrows_;
    }

    function setTotalReserves(uint totalReserves_) public {
        totalReserves = totalReserves_;
    }

    function getBlockNumber() internal view override returns (uint) {
        ControllerScenario controllerScenario = ControllerScenario(address(controller));
        return controllerScenario.blockNumber();
    }
}

contract PEvil is PErc20Scenario {
    constructor(
        address underlying_,
        RegistryInterface registry_,
        ControllerInterface controller_,
        InterestRateModel interestRateModel_,
        uint initialExchangeRateMantissa_,
        uint initialReserveFactorMantissa_,
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    )
        PErc20Scenario
    (
        underlying_,
        registry_,
        controller_,
        interestRateModel_,
        initialExchangeRateMantissa_,
        initialReserveFactorMantissa_,
        name_,
        symbol_,
        decimals_
    ) {}

    function evilSeize(PToken treasure, address liquidator, address borrower, uint seizeTokens) public returns (uint) {
        return treasure.seize(liquidator, borrower, seizeTokens);
    }
}

contract PErc20DelegatorScenario is PErc20Delegator, PTokenStorage {
    event Failure(uint error, uint info, uint detail);

    constructor(
        address underlying_,
        ControllerInterface controller_,
        InterestRateModel interestRateModel_,
        uint initialExchangeRateMantissa_,
        uint initialReserveFactorMantissa_,
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        address registry_
    )
        PErc20Delegator
    (
        underlying_,
        address(controller_),
        address(interestRateModel_),
        initialExchangeRateMantissa_,
        initialReserveFactorMantissa_,
        name_,
        symbol_,
        decimals_,
        registry_
    ) {}

    function mint(uint mintAmount) external returns (uint) {
        mintAmount; // Shh
        delegateAndReturn();
    }

    function redeem(uint redeemTokens) external returns (uint) {
        redeemTokens; // Shh
        delegateAndReturn();
    }

    function borrow(uint borrowAmount) external returns (uint) {
        borrowAmount; // Shh
        delegateAndReturn();
    }

    function borrowBalanceCurrent(address account) external returns (uint) {
        account; // Shh
        delegateAndReturn();
    }

    function balanceOfUnderlying(address owner) external returns (uint) {
        owner; // Shh
        delegateAndReturn();
    }

    function liquidateBorrow(address borrower, uint repayAmount, PTokenInterface pTokenCollateral) external returns (uint) {
        borrower; repayAmount; pTokenCollateral; // Shh
        delegateAndReturn();
    }

    function getMyAdmin() external returns (address) {
        delegateAndReturn();
    }

    function exchangeRateStored() public view returns (uint) {
        delegateToViewAndReturn();
    }

    function underlying() external returns (address) {
        delegateAndReturn();
    }

    function startBorrowTimestamp() public view returns (uint) {
        delegateToViewAndReturn();
    }

    function calcUnderlyingAmountMin() public view returns (uint) {
        delegateToViewAndReturn();
    }

    function delegateToViewAndReturn() private view returns (bytes memory) {
        (bool success, ) = address(this).staticcall(abi.encodeWithSignature("delegateToImplementation(bytes)", msg.data));

        assembly {
            let free_mem_ptr := mload(0x40)
            returndatacopy(free_mem_ptr, 0, returndatasize())

            switch success
            case 0 { revert(free_mem_ptr, returndatasize()) }
            default { return(add(free_mem_ptr, 0x40), returndatasize()) }
        }
    }

    function delegateToImplementation(bytes memory data) public returns (bytes memory) {
        return delegateTo(_pTokenImplementation(), data);
    }

    function delegateToViewImplementation(bytes memory data) public view returns (bytes memory) {
        (bool success, bytes memory returnData) = address(this).staticcall(abi.encodeWithSignature("delegateToImplementation(bytes)", data));
        assembly {
            if eq(success, 0) {
                revert(add(returnData, 0x20), returndatasize())
            }
        }
        return abi.decode(returnData, (bytes));
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        owner; spender; // Shh
        delegateToViewAndReturn();
    }

    function balanceOf(address owner) external view returns (uint) {
        owner; // Shh
        delegateToViewAndReturn();
    }

    function exchangeRateCurrent() public returns (uint) {
        delegateAndReturn();
    }

    function borrowBalanceStored(address account) public view returns (uint) {
        account; // Shh
        delegateToViewAndReturn();
    }

    function _setInterestRateModel(InterestRateModel newInterestRateModel) public returns (uint) {
        newInterestRateModel; // Shh
        delegateAndReturn();
    }

    function _setReserveFactor(uint newReserveFactorMantissa) external returns (uint) {
        newReserveFactorMantissa; // Shh
        delegateAndReturn();
    }

    function repayBorrow(uint repayAmount) external returns (uint) {
        repayAmount; // Shh
        delegateAndReturn();
    }

    function _reduceReserves(uint reduceAmount) external returns (uint) {
        reduceAmount; // Shh
        delegateAndReturn();
    }

    function _addReserves(uint addAmount) external returns (uint) {
        addAmount; // Shh
        delegateAndReturn();
    }

    function totalBorrowsCurrent() external returns (uint) {
        delegateAndReturn();
    }

    function accrueInterest() public returns (uint) {
        delegateAndReturn();
    }

    function seize(address liquidator, address borrower, uint seizeTokens) external returns (uint) {
        liquidator; borrower; seizeTokens; // Shh
        delegateAndReturn();
    }

    function transfer(address dst, uint amount) external returns (bool) {
        dst; amount; // Shh
        delegateAndReturn();
    }

    function transferFrom(address src, address dst, uint256 amount) external returns (bool) {
        src; dst; amount; // Shh
        delegateAndReturn();
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        spender; amount; // Shh
        delegateAndReturn();
    }

    function redeemUnderlying(uint redeemAmount) external returns (uint) {
        redeemAmount; // Shh
        delegateAndReturn();
    }

    function repayBorrowBehalf(address borrower, uint repayAmount) external returns (uint) {
        borrower; repayAmount; // Shh
        delegateAndReturn();
    }

    function _setController(ControllerInterface newController) public returns (uint) {
        newController; // Shh
        delegateAndReturn();
    }

    function setTotalBorrows(uint totalBorrows_) public {
        totalBorrows = totalBorrows_;
    }

    function setTotalReserves(uint totalReserves_) public {
        totalReserves = totalReserves_;
    }
}

contract PErc20DelegateHarness is PErc20Delegate {
    event Log(string x, address y);
    event Log(string x, uint y);

    uint blockNumber = 100000;
    uint harnessExchangeRate;
    bool harnessExchangeRateStored;

    mapping (address => bool) public failTransferToAddresses;

    function exchangeRateStoredInternal() internal view override returns (MathError, uint) {
        if (harnessExchangeRateStored) {
            return (MathError.NO_ERROR, harnessExchangeRate);
        }
        return super.exchangeRateStoredInternal();
    }

    function doTransferOut(address payable to, uint amount) internal override {
        require(failTransferToAddresses[to] == false, "TOKEN_TRANSFER_OUT_FAILED");
        return super.doTransferOut(to, amount);
    }

    function getBlockNumber() internal view override returns (uint) {
        return blockNumber;
    }

    function getBorrowRateMaxMantissa() public pure returns (uint) {
        return borrowRateMaxMantissa;
    }

    function harnessSetBlockNumber(uint newBlockNumber) public {
        blockNumber = newBlockNumber;
    }

    function harnessFastForward(uint blocks) public {
        blockNumber += blocks;
    }

    function harnessSetBalance(address account, uint amount) external {
        accountTokens[account] = amount;
    }

    function harnessSetAccrualBlockNumber(uint _accrualblockNumber) public {
        accrualBlockNumber = _accrualblockNumber;
    }

    function harnessSetTotalSupply(uint totalSupply_) public {
        totalSupply = totalSupply_;
    }

    function harnessSetTotalBorrows(uint totalBorrows_) public {
        totalBorrows = totalBorrows_;
    }

    function harnessIncrementTotalBorrows(uint addtlBorrow_) public {
        totalBorrows = totalBorrows + addtlBorrow_;
    }

    function harnessSetTotalReserves(uint totalReserves_) public {
        totalReserves = totalReserves_;
    }

    function harnessExchangeRateDetails(uint totalSupply_, uint totalBorrows_, uint totalReserves_) public {
        totalSupply = totalSupply_;
        totalBorrows = totalBorrows_;
        totalReserves = totalReserves_;
    }

    function harnessSetExchangeRate(uint exchangeRate) public {
        harnessExchangeRate = exchangeRate;
        harnessExchangeRateStored = true;
    }

    function harnessSetFailTransferToAddress(address _to, bool _fail) public {
        failTransferToAddresses[_to] = _fail;
    }

    function harnessMintFresh(address account, uint mintAmount) public returns (uint) {
        (uint err,,) = super.mintFresh(account, mintAmount);
        return err;
    }

    function harnessRedeemFresh(address payable account, uint pTokenAmount, uint underlyingAmount) public returns (uint) {
        (uint err,,) = super.redeemFresh(account, pTokenAmount, underlyingAmount);
        return err;
    }

    function harnessAccountBorrows(address account) public view returns (uint principal, uint interestIndex) {
        BorrowSnapshot memory snapshot = accountBorrows[account];
        return (snapshot.principal, snapshot.interestIndex);
    }

    function harnessSetAccountBorrows(address account, uint principal, uint interestIndex) public {
        accountBorrows[account] = BorrowSnapshot({principal: principal, interestIndex: interestIndex});
    }

    function harnessSetBorrowIndex(uint borrowIndex_) public {
        borrowIndex = borrowIndex_;
    }

    function harnessBorrowFresh(address payable account, uint borrowAmount) public returns (uint) {
        return borrowFresh(account, borrowAmount);
    }

    function harnessRepayBorrowFresh(address payer, address account, uint repayAmount) public returns (uint) {
        (uint err,,) = repayBorrowFresh(payer, account, repayAmount);
        return err;
    }

    function harnessLiquidateBorrowFresh(address liquidator, address borrower, uint repayAmount, PToken pTokenCollateral) public returns (uint) {
        (uint err,) = liquidateBorrowFresh(liquidator, borrower, repayAmount, pTokenCollateral);
        return err;
    }

    function harnessReduceReservesFresh(uint amount) public returns (uint) {
        return _reduceReservesFresh(amount);
    }

    function harnessSetReserveFactorFresh(uint newReserveFactorMantissa) public returns (uint) {
        return _setReserveFactorFresh(newReserveFactorMantissa);
    }

    function harnessSetInterestRateModelFresh(InterestRateModel newInterestRateModel) public returns (uint) {
        return _setInterestRateModelFresh(newInterestRateModel);
    }

    function harnessSetInterestRateModel(address newInterestRateModelAddress) public {
        interestRateModel = InterestRateModel(newInterestRateModelAddress);
    }

    function harnessCallBorrowAllowed(uint amount) public returns (uint) {
        return controller.borrowAllowed(address(this), msg.sender, amount);
    }
}

contract PErc20DelegateScenario is PErc20Delegate {
    constructor() {}

    function setTotalBorrows(uint totalBorrows_) public {
        totalBorrows = totalBorrows_;
    }

    function setTotalReserves(uint totalReserves_) public {
        totalReserves = totalReserves_;
    }

    function getBlockNumber() internal view override returns (uint) {
        ControllerScenario controllerScenario = ControllerScenario(address(controller));
        return controllerScenario.blockNumber();
    }
}

contract PErc20DelegateScenarioExtra is PErc20DelegateScenario {
    function iHaveSpoken() public pure returns (string memory) {
      return "i have spoken";
    }

    function babyYoda() public pure {
      revert("protect the baby");
    }
}
