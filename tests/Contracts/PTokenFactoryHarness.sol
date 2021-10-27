pragma solidity ^0.7.6;

import "../../contracts/PTokenFactory.sol";
import '../../contracts/RegistryInterface.sol';

contract PTokenFactoryHarness is PTokenFactory {

    constructor(
        address registry_,
        uint minUniswapLiquidity_,
        address controller_,
        address interestRateModel_,
        uint256 initialExchangeRateMantissa_,
        uint256 initialReserveFactorMantissa_
    ) PTokenFactory(
        RegistryInterface(registry_),
        minUniswapLiquidity_,
        controller_,
        interestRateModel_,
        initialExchangeRateMantissa_,
        initialReserveFactorMantissa_
    ) {}

}
