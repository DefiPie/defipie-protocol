// SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;

import "./FaucetToken.sol";

/**
  * @title Fee Token
  * @author DeFiPie
  * @notice A simple test token that charges fees on transfer. Used to mock USDT.
  */
contract FeeToken is FaucetToken {
    using SafeMath for uint256;
    uint public basisPointFee;
    address public owner;

    constructor(
        uint256 _initialAmount,
        string memory _tokenName,
        uint8 _decimalUnits,
        string memory _tokenSymbol,
        uint _basisPointFee,
        address _owner
    ) FaucetToken(_initialAmount, _tokenName, _decimalUnits, _tokenSymbol) {
        basisPointFee = _basisPointFee;
        owner = _owner;
    }

    function transfer(address dst, uint amount) public override returns (bool) {
        uint fee = amount.mul(basisPointFee).div(10000);
        uint net = amount.sub(fee);
        balances[owner] = balances[owner].add(fee);
        balances[msg.sender] = balances[msg.sender].sub(amount);
        balances[dst] = balances[dst].add(net);
        emit Transfer(msg.sender, dst, amount);
        return true;
    }

    function transferFrom(address src, address dst, uint amount) public override returns (bool) {
        uint fee = amount.mul(basisPointFee).div(10000);
        uint net = amount.sub(fee);
        balances[owner] = balances[owner].add(fee);
        balances[src] = balances[src].sub(amount);
        balances[dst] = balances[dst].add(net);
        allowed[src][msg.sender] = allowed[src][msg.sender].sub(amount);
        emit Transfer(src, dst, amount);
        return true;
    }
}
