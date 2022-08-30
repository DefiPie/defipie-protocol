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
import "./Oracles/Interfaces/IPriceOracle.sol";
import "./Tokens/PTokenInterfaces.sol";
import "./PTokenFactoryStorage.sol";

contract PTokenFactory is PTokenFactoryStorageV1, FactoryErrorReporter {
    using SafeMath for uint;

    /**
     * Fired on creation new pToken proxy
     * @param newPToken Address of new PToken proxy contract
     * @param startBorrowTimestamp Timestamp for borrow start
     */
    event PTokenCreated(address newPToken, uint startBorrowTimestamp, uint underlyingType);

    event AddedBlackList(address _underlying);
    event RemovedBlackList(address _underlying);

    function initialize(
        address registry_,
        address controller_,
        address interestRateModel_,
        uint256 initialExchangeRateMantissa_,
        uint256 initialReserveFactorMantissa_,
        uint256 minOracleLiquidity_
    ) public {
        registry = registry_;
        controller = controller_;
        interestRateModel = interestRateModel_;
        initialExchangeRateMantissa = initialExchangeRateMantissa_;
        initialReserveFactorMantissa = initialReserveFactorMantissa_;
        minOracleLiquidity = minOracleLiquidity_;

        decimals = 8;
    }

    /**
     * Creates new pToken proxy contract and adds pToken to the controller
     * @param underlying_ The address of the underlying asset
     */
    function createPToken(address underlying_) external returns (uint) {
        if (getBlackListStatus(underlying_)) {
            return fail(Error.INVALID_POOL, FailureInfo.UNDERLYING_IN_BLACKLIST);
        }

        (uint underlyingType_, uint112 liquidity) = getOracle().getUnderlyingTypeAndLiquidity(underlying_);

        if ((underlyingType_ == uint(IPriceOracle.UnderlyingType.BadUnderlying)) || (liquidity < minOracleLiquidity)) {
            return fail(Error.INVALID_UNDERLYING, FailureInfo.DEFICIENCY_LIQUIDITY_IN_POOL_OR_BAD_PAIR);
        }

        (string memory name, string memory symbol) = _createPTokenNameAndSymbol(underlying_, underlyingType_);

        uint power = EIP20Interface(underlying_).decimals();
        uint exchangeRateMantissa = calcExchangeRate(power);

        PErc20Delegator newPToken = new PErc20Delegator(underlying_, controller, interestRateModel, exchangeRateMantissa, initialReserveFactorMantissa, name, symbol, decimals, registry);

        uint256 result = Controller(controller)._supportMarket(address(newPToken));
        if (result != 0) {
            return fail(Error.MARKET_NOT_LISTED, FailureInfo.SUPPORT_MARKET_BAD_RESULT);
        }

        result = RegistryInterface(registry).addPToken(underlying_, address(newPToken));
        if (result != 0) {
            return fail(Error.MARKET_NOT_LISTED, FailureInfo.ADD_PTOKEN_BAD_RESULT);
        }

        uint startBorrowTimestamp = PErc20ExtInterface(address(newPToken)).startBorrowTimestamp();

        result = getOracle().update(underlying_);
        if (result != 0) {
            return fail(Error.MARKET_NOT_LISTED, FailureInfo.UPDATE_PRICE_BAD_RESULT);
        }
        
        if (createPoolFeeAmount > 0) {
            EIP20Interface(PErc20Interface(RegistryInterface(registry).pPIE()).underlying()).transferFrom(msg.sender, controller, createPoolFeeAmount);
            ControllerInterface(controller).setFreezePoolAmount(address(newPToken), createPoolFeeAmount);
        }

        emit PTokenCreated(address(newPToken), startBorrowTimestamp, underlyingType_);

        return uint(Error.NO_ERROR);
    }

    function _createPETH(address pETHImplementation_, string memory symbol_) external virtual returns (uint) {
        if (msg.sender != getAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.CREATE_PETH_POOL);
        }

        string memory name = string(abi.encodePacked("DeFiPie ", symbol_));
        string memory symbol = string(abi.encodePacked("p", symbol_));

        uint power = 18;
        uint exchangeRateMantissa = calcExchangeRate(power);

        PETHDelegator newPETH = new PETHDelegator(pETHImplementation_, controller, interestRateModel, exchangeRateMantissa, initialReserveFactorMantissa, name, symbol, decimals, address(registry));

        uint256 result = Controller(controller)._supportMarket(address(newPETH));
        if (result != 0) {
            return fail(Error.MARKET_NOT_LISTED, FailureInfo.SUPPORT_MARKET_BAD_RESULT);
        }

        result = RegistryInterface(registry).addPETH(address(newPETH));
        if (result != 0) {
            return fail(Error.MARKET_NOT_LISTED, FailureInfo.ADD_PTOKEN_BAD_RESULT);
        }

        emit PTokenCreated(address(newPETH), block.timestamp, uint(IPriceOracle.UnderlyingType.RegularAsset));

        return uint(Error.NO_ERROR);
    }

    function _createPPIE(address underlying_, address pPIEImplementation_) external virtual returns (uint) {
        if (msg.sender != getAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.CREATE_PPIE_POOL);
        }

        string memory name = "DeFiPie PIE";
        string memory symbol = "pPIE";

        uint power = EIP20Interface(underlying_).decimals();
        uint exchangeRateMantissa = calcExchangeRate(power);

        PPIEDelegator newPPIE = new PPIEDelegator(underlying_, pPIEImplementation_, controller, interestRateModel, exchangeRateMantissa, initialReserveFactorMantissa, name, symbol, decimals, address(registry));

        uint256 result = Controller(controller)._supportMarket(address(newPPIE));
        if (result != 0) {
            return fail(Error.MARKET_NOT_LISTED, FailureInfo.SUPPORT_MARKET_BAD_RESULT);
        }

        result = RegistryInterface(registry).addPPIE(address(newPPIE));
        if (result != 0) {
            return fail(Error.MARKET_NOT_LISTED, FailureInfo.ADD_PTOKEN_BAD_RESULT);
        }

        result = getOracle().update(underlying_);
        if (result != 0) {
            return fail(Error.MARKET_NOT_LISTED, FailureInfo.UPDATE_PRICE_BAD_RESULT);
        }

        emit PTokenCreated(address(newPPIE), block.timestamp, uint(IPriceOracle.UnderlyingType.RegularAsset));

        return uint(Error.NO_ERROR);
    }

    function _setMinOracleLiquidity(uint minOracleLiquidity_) public returns (uint) {
        if (msg.sender != getAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_MIN_LIQUIDITY_OWNER_CHECK);
        }

        minOracleLiquidity = minOracleLiquidity_;

        return uint(Error.NO_ERROR);
    }

    /**
     *  Sets address of actual controller contract
     *  @return uint 0 = success, otherwise a failure (see ErrorReporter.sol for details)
     */
    function _setController(address newController) external returns (uint) {
        if (msg.sender != getAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_NEW_CONTROLLER);
        }
        controller = newController;

        return(uint(Error.NO_ERROR));
    }

    /**
     *  Sets address of actual interestRateModel contract
     *  @return uint 0 = success, otherwise a failure (see ErrorReporter.sol for details)
     */
    function _setInterestRateModel(address newInterestRateModel) external returns (uint) {
        if (msg.sender != getAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_NEW_INTEREST_RATE_MODEL);
        }

        interestRateModel = newInterestRateModel;

        return(uint(Error.NO_ERROR));
    }

    /**
     *  Sets initial exchange rate
     *  @return uint 0 = success, otherwise a failure (see ErrorReporter.sol for details)
     */
    function _setInitialExchangeRateMantissa(uint _initialExchangeRateMantissa) external returns (uint) {
        if (msg.sender != getAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_NEW_EXCHANGE_RATE);
        }

        initialExchangeRateMantissa = _initialExchangeRateMantissa;

        return(uint(Error.NO_ERROR));
    }

    function _setInitialReserveFactorMantissa(uint _initialReserveFactorMantissa) external returns (uint) {
        if (msg.sender != getAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_NEW_RESERVE_FACTOR);
        }

        initialReserveFactorMantissa = _initialReserveFactorMantissa;

        return(uint(Error.NO_ERROR));
    }

    function _setPTokenDecimals(uint _decimals) external returns (uint) {
        if (msg.sender != getAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_NEW_DECIMALS);
        }

        decimals = uint8(_decimals);

        return(uint(Error.NO_ERROR));
    }

    function _addBlackList(address _underlying) public returns (uint) {
        if (msg.sender != getAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.ADD_UNDERLYING_TO_BLACKLIST);
        }

        isUnderlyingBlackListed[_underlying] = true;

        emit AddedBlackList(_underlying);

        return(uint(Error.NO_ERROR));
    }

    function _removeBlackList(address _underlying) public returns (uint) {
        if (msg.sender != getAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.REMOVE_UNDERLYING_FROM_BLACKLIST);
        }

        isUnderlyingBlackListed[_underlying] = false;

        emit RemovedBlackList(_underlying);

        return(uint(Error.NO_ERROR));
    }

    function getBlackListStatus(address underlying_) public view returns (bool) {
        return isUnderlyingBlackListed[underlying_];
    }

    /**
     *  Sets fee for create pool in pies
     *  @return uint 0 = success, otherwise a failure (see ErrorReporter.sol for details)
     */
    function _setCreatePoolFeeAmount(uint createPoolFeeAmount_) external returns(uint) {
        if (msg.sender != getAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_NEW_CREATE_POOL_FEE_AMOUNT);
        }
        createPoolFeeAmount = createPoolFeeAmount_;

        return(uint(Error.NO_ERROR));
    }

    function _withdrawERC20(address token_, address recipient_) external returns(uint) {
        if (msg.sender != getAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.WITHDRAW_ERC20);
        }

        EIP20Interface(token_).transfer(recipient_, EIP20Interface(token_).balanceOf(address(this)));

        return(uint(Error.NO_ERROR));
    }

    function getAdmin() public view returns(address) {
        return RegistryInterface(registry).admin();
    }

    function getOracle() public view returns (PriceOracle) {
        return PriceOracle(RegistryInterface(registry).oracle());
    }

    function _createPTokenNameAndSymbol(address underlying_, uint underlyingType_) internal view returns (string memory, string memory) {
        if (underlyingType_ == uint(IPriceOracle.UnderlyingType.RegularAsset)) {
            return _createPTokenNameAndSymbolForAsset(underlying_);
        } else if (underlyingType_ == uint(IPriceOracle.UnderlyingType.UniswapV2LP)) {
            return _createPTokenNameAndSymbolForUniswapV2LP(underlying_);
        } else {
            return ("","");
        }
    }

    function _createPTokenNameAndSymbolForAsset(address underlying_) internal view returns (string memory, string memory) {
        string memory name = string(abi.encodePacked("DeFiPie ", EIP20Interface(underlying_).name()));
        string memory symbol = string(abi.encodePacked("p", EIP20Interface(underlying_).symbol()));
        return (name, symbol);
    }

    function _createPTokenNameAndSymbolForUniswapV2LP(address underlying_) internal view returns (string memory, string memory) {
        IUniswapV2Pair pool = IUniswapV2Pair(underlying_);

        address token0 = pool.token0();
        address token1 = pool.token1();

        string memory symbol0 = EIP20Interface(token0).symbol();
        string memory symbol1 = EIP20Interface(token1).symbol();

        string memory name = string(abi.encodePacked("DeFiPie uniLP ", symbol0, "-", symbol1));
        string memory symbol = string(abi.encodePacked("pUniLP", symbol0, "-", symbol1));
        return (name, symbol);
    }

    function calcExchangeRate(uint power) internal view returns (uint) {
        uint factor;

        if (decimals >= power) {
            factor = 10**(decimals - power);
            return initialExchangeRateMantissa.div(factor);
        } else {
            factor = 10**(power - decimals);
            return initialExchangeRateMantissa.mul(factor);
        }
    }
}
