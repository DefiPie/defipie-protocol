// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "./FaucetToken.sol";

/**
  * @title Fee Token
  * @author DeFiPie
  * @notice A simple test token that charges fees on transfer. Used to mock USDT.
  */
contract FeeToken is FaucetToken {
    using SafeMath for uint256;

    uint public basisPointFee; // 10% is 1000
    uint public denom; // 10000 default value

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

        denom = 10000;
    }

    function transfer(address dst, uint amount) public override returns (bool) {
        uint fee = amount.mul(basisPointFee).div(denom);
        uint net = amount.sub(fee);
        balances[owner] = balances[owner].add(fee);
        balances[msg.sender] = balances[msg.sender].sub(amount);
        balances[dst] = balances[dst].add(net);

        emit Transfer(msg.sender, owner, fee);
        emit Transfer(msg.sender, dst, net);

        return true;
    }

    function transferFrom(address src, address dst, uint amount) public override returns (bool) {
        uint fee = amount.mul(basisPointFee).div(denom);
        uint net = amount.sub(fee);
        balances[owner] = balances[owner].add(fee);
        balances[src] = balances[src].sub(amount);
        balances[dst] = balances[dst].add(net);
        allowed[src][msg.sender] = allowed[src][msg.sender].sub(amount);

        emit Transfer(src, dst, net);
        emit Transfer(src, owner, fee);

        return true;
    }

    function setOwner(address newOwner) public returns (bool) {
        owner = newOwner;

        return true;
    }

    function setBasisPointFee(uint256 _basisPointFee) public returns (bool) {
        require(msg.sender == owner, 'FeeToken::setBasisPointFee: msg.sender is not owner');
        basisPointFee = _basisPointFee;

        return true;
    }

    function setDenom(uint256 denom_) public returns (bool) {
        require(msg.sender == owner, 'FeeToken::setDenom: msg.sender is not owner');
        denom = denom_;

        return true;
    }
}
