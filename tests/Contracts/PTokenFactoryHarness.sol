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

    function createPETH(address pETHImplementation_) external override returns (uint) {
        if (msg.sender != getAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.CREATE_PETH_POOL);
        }

        string memory name = "DeFiPie ETH";
        string memory symbol = "pETH";
        uint8 pETHDecimals = 18;

        PETHDelegator newPETH = new PETHDelegator(pETHImplementation_, controller, interestRateModel, initialExchangeRateMantissa, initialReserveFactorMantissa, name, symbol, pETHDecimals, address(registry));

        uint256 result = Controller(controller)._supportMarket(address(newPETH));
        if (result != 0) {
            return fail(Error.MARKET_NOT_LISTED, FailureInfo.SUPPORT_MARKET_BAD_RESULT);
        }

        registry.addPETH(address(newPETH));

        emit PTokenCreated(address(newPETH));

        return uint(Error.NO_ERROR);
    }

    function createPPIE(address underlying_, address pPIEImplementation_) external override returns (uint) {
        if (msg.sender != getAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.CREATE_PPIE_POOL);
        }

        string memory name = "DeFiPie PIE";
        string memory symbol = "pPIE";
        uint8 pPIEDecimals = 18;

        PPIEDelegator newPPIE = new PPIEDelegator(underlying_, pPIEImplementation_, controller, interestRateModel, initialExchangeRateMantissa, initialReserveFactorMantissa, name, symbol, pPIEDecimals, address(registry));

        uint256 result = Controller(controller)._supportMarket(address(newPPIE));
        if (result != 0) {
            return fail(Error.MARKET_NOT_LISTED, FailureInfo.SUPPORT_MARKET_BAD_RESULT);
        }

        registry.addPPIE(address(newPPIE));

        emit PTokenCreated(address(newPPIE));

        oracle.update(underlying_);

        return uint(Error.NO_ERROR);
    }
}
