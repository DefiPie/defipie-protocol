// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "./FaucetToken.sol";

/**
  * @title The DeFiPie Evil Test Token
  * @author DeFiPie
  * @notice A simple test token that fails certain operations
  */
contract EvilToken is FaucetToken {
    using SafeMath for uint256;

    bool public fail;

    constructor(uint256 _initialAmount, string memory _tokenName, uint8 _decimalUnits, string memory _tokenSymbol)
        FaucetToken(_initialAmount, _tokenName, _decimalUnits, _tokenSymbol) {
        fail = true;
    }

    function setFail(bool _fail) external {
        fail = _fail;
    }

    function transfer(address dst, uint256 amount) external override returns (bool) {
        if (fail) {
            return false;
        }
        balances[msg.sender] = balances[msg.sender].sub(amount);
        balances[dst] = balances[dst].add(amount);
        emit Transfer(msg.sender, dst, amount);
        return true;
    }

    function transferFrom(address src, address dst, uint256 amount) external override returns (bool) {
        if (fail) {
            return false;
        }
        balances[src] = balances[src].sub(amount);
        balances[dst] = balances[dst].add(amount);
        allowed[src][msg.sender] = allowed[src][msg.sender].sub(amount);
        emit Transfer(src, dst, amount);
        return true;
    }
}
