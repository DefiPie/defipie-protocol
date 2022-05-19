
interface ErrorReporterEnum {
    Error: string[]
    FailureInfo: string[]
}

interface ErrorTypes {
    Error: {[name: string]: number}
    FailureInfo: {[name: string]: number}
    ErrorInv: {[code: number]: string}
    FailureInfoInv: {[code: number]: string}
}

const ControllerErrorReporter = {
    Error: [
        'NO_ERROR',
        'UNAUTHORIZED',
        'CONTROLLER_MISMATCH',
        'INSUFFICIENT_SHORTFALL',
        'INSUFFICIENT_LIQUIDITY',
        'INVALID_CLOSE_FACTOR',
        'INVALID_COLLATERAL_FACTOR',
        'INVALID_LIQUIDATION_INCENTIVE',
        'MARKET_NOT_LISTED',
        'MARKET_ALREADY_LISTED',
        'MATH_ERROR',
        'NONZERO_BORROW_BALANCE',
        'PRICE_ERROR',
        'REJECTION',
        'GUARDIAN_REJECTION',
        'SNAPSHOT_ERROR',
        'TOO_MANY_ASSETS',
        'TOO_MUCH_REPAY'
    ],

    FailureInfo: [
        'ACCEPT_ADMIN_PENDING_ADMIN_CHECK',
        'ACCEPT_PENDING_IMPLEMENTATION_ADDRESS_CHECK',
        'EXIT_MARKET_BALANCE_OWED',
        'EXIT_MARKET_REJECTION',
        'SET_CLOSE_FACTOR_OWNER_CHECK',
        'SET_CLOSE_FACTOR_VALIDATION',
        'SET_COLLATERAL_FACTOR_OWNER_CHECK',
        'SET_COLLATERAL_FACTOR_NO_EXISTS',
        'SET_COLLATERAL_FACTOR_VALIDATION',
        'SET_COLLATERAL_FACTOR_WITHOUT_PRICE',
        'SET_LIQUIDATION_INCENTIVE_OWNER_CHECK',
        'SET_LIQUIDATION_INCENTIVE_VALIDATION',
        'SET_MAX_ASSETS_OWNER_CHECK',
        'SET_GUARDIAN_OWNER_CHECK',
        'SET_PENDING_ADMIN_OWNER_CHECK',
        'SET_PENDING_IMPLEMENTATION_OWNER_CHECK',
        'SUPPORT_MARKET_EXISTS',
        'SUPPORT_MARKET_OWNER_CHECK'
    ]
};

const DistributorErrorReporter = {
    Error: [
        'NO_ERROR',
        'UNAUTHORIZED',
    ],

    FailureInfo: [
        'SET_NEW_IMPLEMENTATION',
    ]
};

const TokenErrorReporter = {
    Error: [
        'NO_ERROR',
        'UNAUTHORIZED',
        'BAD_INPUT',
        'CONTROLLER_REJECTION',
        'INVALID_ACCOUNT_PAIR',
        'INVALID_CLOSE_AMOUNT_REQUESTED',
        'MATH_ERROR',
        'MARKET_NOT_FRESH',
        'TOKEN_INSUFFICIENT_CASH'
    ],

    FailureInfo: [
        'ACCRUE_INTEREST_ACCUMULATED_INTEREST_CALCULATION_FAILED',
        'ACCRUE_INTEREST_NEW_BORROW_INDEX_CALCULATION_FAILED',
        'ACCRUE_INTEREST_NEW_TOTAL_BORROWS_CALCULATION_FAILED',
        'ACCRUE_INTEREST_NEW_TOTAL_RESERVES_CALCULATION_FAILED',
        'ACCRUE_INTEREST_SIMPLE_INTEREST_FACTOR_CALCULATION_FAILED',
        'BORROW_ACCUMULATED_BALANCE_CALCULATION_FAILED',
        'BORROW_ACCRUE_INTEREST_FAILED',
        'BORROW_CASH_NOT_AVAILABLE',
        'BORROW_FRESHNESS_CHECK',
        'BORROW_NEW_TOTAL_BALANCE_CALCULATION_FAILED',
        'BORROW_NEW_ACCOUNT_BORROW_BALANCE_CALCULATION_FAILED',
        'BORROW_CONTROLLER_REJECTION',
        'LIQUIDATE_ACCRUE_BORROW_INTEREST_FAILED',
        'LIQUIDATE_ACCRUE_COLLATERAL_INTEREST_FAILED',
        'LIQUIDATE_COLLATERAL_FRESHNESS_CHECK',
        'LIQUIDATE_CONTROLLER_REJECTION',
        'LIQUIDATE_CONTROLLER_CALCULATE_AMOUNT_SEIZE_FAILED',
        'LIQUIDATE_CLOSE_AMOUNT_IS_UINT_MAX',
        'LIQUIDATE_CLOSE_AMOUNT_IS_ZERO',
        'LIQUIDATE_FRESHNESS_CHECK',
        'LIQUIDATE_LIQUIDATOR_IS_BORROWER',
        'LIQUIDATE_REPAY_BORROW_FRESH_FAILED',
        'LIQUIDATE_SEIZE_BALANCE_INCREMENT_FAILED',
        'LIQUIDATE_SEIZE_BALANCE_DECREMENT_FAILED',
        'LIQUIDATE_SEIZE_CONTROLLER_REJECTION',
        'LIQUIDATE_SEIZE_LIQUIDATOR_IS_BORROWER',
        'LIQUIDATE_SEIZE_TOO_MUCH',
        'MINT_ACCRUE_INTEREST_FAILED',
        'MINT_CONTROLLER_REJECTION',
        'MINT_EXCHANGE_CALCULATION_FAILED',
        'MINT_EXCHANGE_RATE_READ_FAILED',
        'MINT_FRESHNESS_CHECK',
        'MINT_NEW_ACCOUNT_BALANCE_CALCULATION_FAILED',
        'MINT_NEW_TOTAL_SUPPLY_CALCULATION_FAILED',
        'REDEEM_ACCRUE_INTEREST_FAILED',
        'REDEEM_CONTROLLER_REJECTION',
        'REDEEM_EXCHANGE_TOKENS_CALCULATION_FAILED',
        'REDEEM_EXCHANGE_AMOUNT_CALCULATION_FAILED',
        'REDEEM_EXCHANGE_RATE_READ_FAILED',
        'REDEEM_FRESHNESS_CHECK',
        'REDEEM_NEW_ACCOUNT_BALANCE_CALCULATION_FAILED',
        'REDEEM_NEW_TOTAL_SUPPLY_CALCULATION_FAILED',
        'REDEEM_TRANSFER_OUT_NOT_POSSIBLE',
        'REDUCE_RESERVES_ACCRUE_INTEREST_FAILED',
        'REDUCE_RESERVES_ADMIN_CHECK',
        'REDUCE_RESERVES_CASH_NOT_AVAILABLE',
        'REDUCE_RESERVES_FRESH_CHECK',
        'REDUCE_RESERVES_VALIDATION',
        'REPAY_BEHALF_ACCRUE_INTEREST_FAILED',
        'REPAY_BORROW_ACCRUE_INTEREST_FAILED',
        'REPAY_BORROW_ACCUMULATED_BALANCE_CALCULATION_FAILED',
        'REPAY_BORROW_CONTROLLER_REJECTION',
        'REPAY_BORROW_FRESHNESS_CHECK',
        'REPAY_BORROW_NEW_ACCOUNT_BORROW_BALANCE_CALCULATION_FAILED',
        'REPAY_BORROW_NEW_TOTAL_BALANCE_CALCULATION_FAILED',
        'SET_CONTROLLER_OWNER_CHECK',
        'SET_INTEREST_RATE_MODEL_ACCRUE_INTEREST_FAILED',
        'SET_INTEREST_RATE_MODEL_FRESH_CHECK',
        'SET_INTEREST_RATE_MODEL_OWNER_CHECK',
        'SET_RESERVE_FACTOR_ACCRUE_INTEREST_FAILED',
        'SET_RESERVE_FACTOR_ADMIN_CHECK',
        'SET_RESERVE_FACTOR_FRESH_CHECK',
        'SET_RESERVE_FACTOR_BOUNDS_CHECK',
        'TRANSFER_CONTROLLER_REJECTION',
        'TRANSFER_NOT_ALLOWED',
        'TRANSFER_NOT_ENOUGH',
        'TRANSFER_TOO_MUCH',
        'ADD_RESERVES_ACCRUE_INTEREST_FAILED',
        'ADD_RESERVES_FRESH_CHECK',
        'SET_NEW_IMPLEMENTATION,'
    ]
};

const OracleErrorReporter = {
    Error: [
        'NO_ERROR',
        'UNAUTHORIZED',
        'UPDATE_PRICE'
    ],

    FailureInfo: [
        'ACCEPT_ADMIN_PENDING_ADMIN_CHECK',
        'NO_RESERVES',
        'PERIOD_NOT_ELAPSED',
        'SET_NEW_ADDRESSES',
        'SET_NEW_IMPLEMENTATION',
        'SET_PENDING_ADMIN_OWNER_CHECK'
    ]
};

const FactoryErrorReporter = {
    Error: [
        'NO_ERROR',
        'INVALID_POOL',
        'MARKET_NOT_LISTED',
        'UNAUTHORIZED'
    ],

    FailureInfo: [
        'ACCEPT_ADMIN_PENDING_ADMIN_CHECK',
        'CREATE_PETH_POOL',
        'CREATE_PPIE_POOL',
        'DEFICIENCY_ETH_LIQUIDITY_IN_POOL',
        'PAIR_IS_NOT_EXIST',
        'SET_MIN_LIQUIDITY_OWNER_CHECK',
        'SET_NEW_CONTROLLER',
        'SET_NEW_DECIMALS',
        'SET_NEW_EXCHANGE_RATE',
        'SET_NEW_IMPLEMENTATION',
        'SET_NEW_INTEREST_RATE_MODEL',
        'SET_NEW_ORACLE',
        'SET_NEW_RESERVE_FACTOR',
        'SET_PENDING_ADMIN_OWNER_CHECK',
        'SUPPORT_MARKET_BAD_RESULT'
    ]
};

const RegistryErrorReporter = {
    Error: [
        'NO_ERROR',
        'UNAUTHORIZED'
    ],

    FailureInfo: [
        'ACCEPT_ADMIN_PENDING_ADMIN_CHECK',
        'SET_NEW_IMPLEMENTATION',
        'SET_PENDING_ADMIN_OWNER_CHECK',
        'SET_NEW_FACTORY',
        'SET_NEW_ORACLE'
    ]
};


function parseEnum(reporterEnum: ErrorReporterEnum): ErrorTypes {
    const Error: {[name: string]: number} = {};
    const ErrorInv: {[code: number]: string} = {};
    const FailureInfo: {[name: string]: number} = {};
    const FailureInfoInv: {[code: number]: string} = {};

    reporterEnum.Error.forEach((entry, i) => {
        Error[entry] = i;
        ErrorInv[i] = entry;
    });

    reporterEnum.FailureInfo.forEach((entry, i) => {
        FailureInfo[entry] = i;
        FailureInfoInv[i] = entry;
    });

    return {Error, ErrorInv, FailureInfo, FailureInfoInv};
}

export const ControllerErr = parseEnum(ControllerErrorReporter);
export const DistributorErr = parseEnum(DistributorErrorReporter);
export const TokenErr = parseEnum(TokenErrorReporter);
export const OracleErr = parseEnum(OracleErrorReporter);
export const FactoryErr = parseEnum(FactoryErrorReporter);
export const RegistryErr = parseEnum(RegistryErrorReporter);

