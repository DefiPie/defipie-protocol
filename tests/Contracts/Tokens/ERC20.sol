// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "../../../contracts/SafeMath.sol";

interface ERC20Base {
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Transfer(address indexed from, address indexed to, uint256 value);
    function totalSupply() external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
}

abstract contract ERC20 is ERC20Base {
    function transfer(address to, uint256 value) external virtual returns (bool);
    function transferFrom(address from, address to, uint256 value) external virtual returns (bool);
}

abstract contract ERC20NS is ERC20Base {
    function transfer(address to, uint256 value) external virtual;
    function transferFrom(address from, address to, uint256 value) external virtual;
}

/**
 * @title Standard ERC20 token
 * @dev Implementation of the basic standard token.
 *  See https://github.com/ethereum/EIPs/issues/20
 */
contract StandardToken is ERC20 {
    using SafeMath for uint256;

    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply_;
    mapping (address => mapping (address => uint256)) internal allowed;
    mapping(address => uint256) internal balances;

    constructor(uint256 _initialAmount, string memory _tokenName, uint8 _decimalUnits, string memory _tokenSymbol) {
        totalSupply_ = _initialAmount;
        balances[msg.sender] = _initialAmount;
        name = _tokenName;
        symbol = _tokenSymbol;
        decimals = _decimalUnits;
    }

    function transfer(address dst, uint256 amount) external virtual override returns (bool) {
        balances[msg.sender] = balances[msg.sender].sub(amount, "Insufficient balance");
        balances[dst] = balances[dst].add(amount, "Balance overflow");
        emit Transfer(msg.sender, dst, amount);
        return true;
    }

    function transferFrom(address src, address dst, uint256 amount) external virtual override returns (bool) {
        allowed[src][msg.sender] = allowed[src][msg.sender].sub(amount, "Insufficient allowance");
        balances[src] = balances[src].sub(amount, "Insufficient balance");
        balances[dst] = balances[dst].add(amount, "Balance overflow");
        emit Transfer(src, dst, amount);
        return true;
    }

    function approve(address _spender, uint256 amount) external override returns (bool) {
        allowed[msg.sender][_spender] = amount;
        emit Approval(msg.sender, _spender, amount);
        return true;
    }

    function allowance(
        address _owner,
        address _spender
    )
        public
        view
        override
        returns (uint256)
    {
        return allowed[_owner][_spender];
    }

    function balanceOf(address _owner) public view override returns (uint256) {
        return balances[_owner];
    }

    function totalSupply() external view override returns (uint256) {
        return totalSupply_;
    }
}

/**
 * @title Non-Standard ERC20 token
 * @dev Version of ERC20 with no return values for `transfer` and `transferFrom`
 *  See https://medium.com/coinmonks/missing-return-value-bug-at-least-130-tokens-affected-d67bf08521ca
 */
contract NonStandardToken is ERC20NS {
    using SafeMath for uint256;

    string public name;
    uint8 public decimals;
    string public symbol;
    uint256 public totalSupply_;
    mapping (address => mapping (address => uint256)) internal allowed;
    mapping(address => uint256) internal balances;

    constructor(uint256 _initialAmount, string memory _tokenName, uint8 _decimalUnits, string memory _tokenSymbol) {
        totalSupply_ = _initialAmount;
        balances[msg.sender] = _initialAmount;
        name = _tokenName;
        symbol = _tokenSymbol;
        decimals = _decimalUnits;
    }

    function transfer(address dst, uint256 amount) external override {
        balances[msg.sender] = balances[msg.sender].sub(amount, "Insufficient balance");
        balances[dst] = balances[dst].add(amount, "Balance overflow");
        emit Transfer(msg.sender, dst, amount);
    }

    function transferFrom(address src, address dst, uint256 amount) external override {
        allowed[src][msg.sender] = allowed[src][msg.sender].sub(amount, "Insufficient allowance");
        balances[src] = balances[src].sub(amount, "Insufficient balance");
        balances[dst] = balances[dst].add(amount, "Balance overflow");
        emit Transfer(src, dst, amount);
    }

    function approve(address _spender, uint256 amount) external override returns (bool) {
        allowed[msg.sender][_spender] = amount;
        emit Approval(msg.sender, _spender, amount);
        return true;
    }

    function allowance(
        address _owner,
        address _spender
    )
        public
        view
        override
        returns (uint256)
    {
        return allowed[_owner][_spender];
    }

    function balanceOf(address _owner) public view override returns (uint256) {
        return balances[_owner];
    }

    function totalSupply() external view override returns (uint256) {
        return totalSupply_;
    }

}

contract ERC20Harness is StandardToken {
    using SafeMath for uint256;

    // To support testing, we can specify addresses for which transferFrom should fail and return false
    mapping (address => bool) public failTransferFromAddresses;

    // To support testing, we allow the contract to always fail `transfer`.
    mapping (address => bool) public failTransferToAddresses;

    constructor(uint256 _initialAmount, string memory _tokenName, uint8 _decimalUnits, string memory _tokenSymbol)
        StandardToken(_initialAmount, _tokenName, _decimalUnits, _tokenSymbol) {}

    function harnessSetFailTransferFromAddress(address src, bool _fail) public {
        failTransferFromAddresses[src] = _fail;
    }

    function harnessSetFailTransferToAddress(address dst, bool _fail) public {
        failTransferToAddresses[dst] = _fail;
    }

    function harnessSetBalance(address _account, uint _amount) public {
        balances[_account] = _amount;
    }

    function transfer(address dst, uint256 amount) external override returns (bool success) {
        // Added for testing purposes
        if (failTransferToAddresses[dst]) {
            return false;
        }
        balances[msg.sender] = balances[msg.sender].sub(amount, "Insufficient balance");
        balances[dst] = balances[dst].add(amount, "Balance overflow");
        emit Transfer(msg.sender, dst, amount);
        return true;
    }

    function transferFrom(address src, address dst, uint256 amount) external override returns (bool success) {
        // Added for testing purposes
        if (failTransferFromAddresses[src]) {
            return false;
        }
        allowed[src][msg.sender] = allowed[src][msg.sender].sub(amount, "Insufficient allowance");
        balances[src] = balances[src].sub(amount, "Insufficient balance");
        balances[dst] = balances[dst].add(amount, "Balance overflow");
        emit Transfer(src, dst, amount);
        return true;
    }
}
