// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import './Tokens/PErc20Delegator.sol';
import './RegistryInterface.sol';
import './Tokens/EIP20Interface.sol';
import "./Oracles/Interfaces/IPriceFeeds.sol";
import "./ErrorReporter.sol";
import "./SafeMath.sol";
import "./Tokens/PEtherDelegator.sol";
import "./Tokens/PPIEDelegator.sol";
import "./Control/Controller.sol";
import "./Oracles/PriceOracle.sol";
import "./Tokens/PTokenInterfaces.sol";

contract PTokenFactoryStorage {
    address public implementation;
    address public registry;
}

contract PTokenFactoryStorageV1 is PTokenFactoryStorage {
    // default parameters for pToken
    address public controller;
    address public interestRateModel;
    uint256 public initialExchangeRateMantissa;
    uint256 public initialReserveFactorMantissa;
    uint256 public minOracleLiquidity;

    // decimals for pToken
    uint8 public decimals;

    mapping (address => bool) public isUnderlyingBlackListed;

    uint public createPoolFeeAmount;
}