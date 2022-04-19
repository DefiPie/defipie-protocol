// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import './PErc20Delegator.sol';
import './RegistryInterface.sol';
import './EIP20Interface.sol';
import "./Interfaces/IPriceFeeds.sol";
import "./ErrorReporter.sol";
import "./SafeMath.sol";
import "./PEtherDelegator.sol";
import "./PPIEDelegator.sol";
import "./Controller.sol";
import "./PriceOracle.sol";
import "./PTokenInterfaces.sol";

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