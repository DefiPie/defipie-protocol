// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "../../contracts/SafeMath.sol";
import "../../contracts/PTokenInterfaces.sol";
import "../../contracts/EIP20Interface.sol";
import "./FaucetToken.sol";
import "../../contracts/ProxyWithRegistry.sol";

/**
  * @title The DeFiPie Evil Test Token
  * @author DeFiPie
  * @notice A simple test token that fails certain operations
  */
contract EvilXToken is ImplementationStorage {
    using SafeMath for uint;

    event Transfer(address indexed from, address indexed to, uint value);
    event Approval(address indexed owner, address indexed spender, uint value);

    bool public fail;
    uint public count;

    mapping(address => uint) public balances;
    mapping(address => mapping(address => uint)) public allowed;

    string public name;
    string public symbol;
    uint8 public decimals;
    uint public totalSupply_;

    PErc20Interface public pToken;
    uint public borrowAmount;
    ControllerInterface public controller;
    PErc20Interface public pTokenBorrow;
    PErc20Interface public pTokenMint;

    PErc20Interface public pTokenLiquidate;

    bool public doBorrow;
    bool public doLiquidate;
    address public liqBorrower;
    uint public liqRepayAmount;
    address public liqPTokenCollateral;

    constructor() {}

    function initialize(uint256 _initialAmount, string memory _tokenName, string memory _tokenSymbol, uint8 _decimalUnits) public {
        totalSupply_ = _initialAmount;
        balances[msg.sender] = _initialAmount;
        name = _tokenName;
        symbol = _tokenSymbol;
        decimals = _decimalUnits;
    }

    function enterMarkets(address[] memory pTokens) public returns (uint[] memory) {
        return controller.enterMarkets(pTokens);
    }

    function setController(address controller_) public {
        controller = ControllerInterface(controller_);
    }

    function totalSupply() public view returns (uint) {
        return totalSupply_;
    }

    function balanceOf(address user) public view returns (uint) {
        return balances[user];
    }

    function allocateTo(address _owner, uint256 value) public {
        balances[_owner] += value;
        totalSupply_ += value;
        emit Transfer(address(this), _owner, value);
    }

    function setDoBorrow(bool doBorrow_) public {
        doBorrow = doBorrow_;
    }

    function setDoLiquidate(bool doLiquidate_) public {
        doLiquidate = doLiquidate_;
    }

    function setPToken(address pToken_) public {
        pToken = PErc20Interface(pToken_);
    }

    function setPTokenBorrow(address pToken_) public {
        pTokenBorrow = PErc20Interface(pToken_);
    }

    function setPTokenLiquidate(address pToken_) public {
        pTokenLiquidate = PErc20Interface(pToken_);
    }

    function setPTokenMint(address pToken_) public {
        pTokenMint = PErc20Interface(pToken_);
    }

    function setBorrowAmount(uint borrowAmount_) public {
        borrowAmount = borrowAmount_;
    }

    function setCount(uint count_) public {
        count = count_;
    }

    function setAllowance(address owner, address spender, uint amount) public {
        allowed[owner][spender] = amount;
    }

    function setLiqData(address liqBorrower_, uint liqRepayAmount_, address liqPTokenCollateral_) public {
        liqBorrower = liqBorrower_;
        liqRepayAmount = liqRepayAmount_;
        liqPTokenCollateral = liqPTokenCollateral_;
    }

    function transfer(address to, uint value) external returns (bool) {
        balances[msg.sender] = balances[msg.sender].sub(value);
        balances[to] = balances[to].add(value);

        if (doBorrow) {
            for (uint i = 0; i < count; i++) {
                pTokenBorrow.borrow(borrowAmount);
            }
        }

        if (doLiquidate) {
            for (uint i = 0; i < count; i++) {
                pTokenLiquidate.liquidateBorrow(liqBorrower, liqRepayAmount, PTokenInterface(liqPTokenCollateral));
            }
        }

        emit Transfer(msg.sender, to, value);

        return true;
    }

    function transferFrom(address from, address to, uint value) external virtual returns (bool) {
        balances[from] = balances[from].sub(value);
        balances[to] = balances[to].add(value);
        allowed[from][to] = allowed[from][to].sub(value);

        if (doBorrow) {
            for (uint i = 0; i < count; i++) {
                pTokenBorrow.borrow(borrowAmount);
            }
        }

        emit Transfer(from, to, value);
        return true;
    }

    function approve(address spender, uint value) external returns (bool) {
        allowed[msg.sender][spender] = value;

        emit Approval(msg.sender, spender, value);
        return true;
    }

    function approveToken(address token, address spender, uint value) external returns (bool) {
        return EIP20Interface(token).approve(spender, value);
    }

    function allowance(address owner, address spender) external view returns (uint) {
        return allowed[owner][spender];
    }

    function mint(uint mintAmount) external virtual returns (uint) {
        return pTokenMint.mint(mintAmount);
    }

    function redeem(uint redeemTokens) external returns (uint) {
        return pToken.redeem(redeemTokens);
    }

    function redeemUnderlying(uint redeemAmount) external returns (uint) {
        return pToken.redeemUnderlying(redeemAmount);
    }

    function borrow(uint borrowAmount_) external returns (uint) {
        return pToken.borrow(borrowAmount_);
    }

    function repayBorrow(uint repayAmount) external returns (uint) {
        return pToken.repayBorrow(repayAmount);
    }

    function repayBorrowBehalf(address borrower, uint repayAmount) external returns (uint) {
        return pToken.repayBorrowBehalf(borrower, repayAmount);
    }

    function liquidateBorrow(address borrower, uint repayAmount, address pTokenCollateral) external returns (uint) {
        return pToken.liquidateBorrow(borrower, repayAmount, PTokenInterface(pTokenCollateral));
    }

}
