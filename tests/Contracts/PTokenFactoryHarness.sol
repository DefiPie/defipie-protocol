// SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;

import "../../contracts/PTokenFactory.sol";
import '../../contracts/RegistryInterface.sol';

contract PTokenFactoryHarness is PTokenFactory {

    constructor(
        address registry_,
        uint minUniswapLiquidity_,
        address oracle_,
        address controller_,
        address interestRateModel_,
        uint256 initialExchangeRateMantissa_,
        uint256 initialReserveFactorMantissa_
    ) PTokenFactory(
        RegistryInterface(registry_),
        minUniswapLiquidity_,
        oracle_,
        controller_,
        interestRateModel_,
        initialExchangeRateMantissa_,
        initialReserveFactorMantissa_
    ) {}
}
