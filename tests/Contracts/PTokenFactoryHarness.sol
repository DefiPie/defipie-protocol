// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "../../contracts/PTokenFactory.sol";

contract PTokenFactoryHarness is PTokenFactory {
    constructor(
        address registry_,
        address controller_,
        address interestRateModel_,
        uint256 initialExchangeRateMantissa_,
        uint256 initialReserveFactorMantissa_,
        uint256 minOracleLiquidity_
    ) {
        initialize(
            registry_,
            controller_,
            interestRateModel_,
            initialExchangeRateMantissa_,
            initialReserveFactorMantissa_,
            minOracleLiquidity_
        );
    }

}
