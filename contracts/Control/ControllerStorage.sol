// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "../Oracles/PriceOracle.sol";
import '../RegistryInterface.sol';
import './DistributorInterface.sol';

contract UnitrollerAdminStorage {
    /**
    * @notice Administrator for this contract in registry
    */
    RegistryInterface public registry;

    /**
    * @notice Active brains of Unitroller
    */
    address public controllerImplementation;

    /**
    * @notice Pending brains of Unitroller
    */
    address public pendingControllerImplementation;
}

contract ControllerStorage is UnitrollerAdminStorage {
    /**
    * @notice Administrator for this contract in registry
    */
    DistributorInterface public distributor;

    /**
     * @notice Oracle which gives the price of any given asset
     */
    PriceOracle public oracle;

    /**
     * @notice Multiplier used to calculate the maximum repayAmount when liquidating a borrow
     */
    uint public closeFactorMantissa;

    /**
     * @notice Multiplier representing the discount on collateral that a liquidator receives
     */
    uint public liquidationIncentiveMantissa;

    /**
     * @notice Max number of assets a single account can participate in (borrow or use as collateral)
     */
    uint public maxAssets;

    /**
     * @notice Per-account mapping of "assets you are in", capped by maxAssets
     */
    mapping(address => address[]) public accountAssets;

    /// @notice isListed Whether or not this market is listed
    /**
     * @notice collateralFactorMantissa Multiplier representing the most one can borrow against their collateral in this market.
     *  For instance, 0.9 to allow borrowing 90% of collateral value.
     *  Must be between 0 and 1, and stored as a mantissa.
     */
    /// @notice accountMembership Per-market mapping of "accounts in this asset"
    /// @notice isPied Whether or not this market receives PIE
    struct Market {
        bool isListed;
        uint collateralFactorMantissa;
        mapping(address => bool) accountMembership;
        bool isPied;
    }

    /**
     * @notice Official mapping of pTokens -> Market metadata
     * @dev Used e.g. to determine if a market is supported
     */
    mapping(address => Market) public markets;

    /**
     * @notice The Pause Guardian can pause certain actions as a safety mechanism.
     *  Actions which allow users to remove their own assets cannot be paused.
     *  Liquidation / seizing / transfer can only be paused globally, not by market.
     */
    address public pauseGuardian;
    bool public _mintGuardianPaused;
    bool public _borrowGuardianPaused;
    bool public transferGuardianPaused;
    bool public seizeGuardianPaused;
    mapping(address => bool) public mintGuardianPaused;
    mapping(address => bool) public borrowGuardianPaused;

    /// @notice A list of all markets
    address[] public allMarkets;

    /// @notice Only the Liquidate guardian can liquidate loans with collateral below the loan amount
    address public liquidateGuardian;

    /// @notice Multiplier representing the bonus on collateral that a liquidator receives for fee tokens
    mapping(address => uint) public feeFactorMantissa;

    // Max value of fee factor can be set for fee factor
    uint public feeFactorMaxMantissa;

    // Value of borrow delay for markets
    uint public borrowDelay;

    // Values for user moderate pool
    uint public userPauseDepositAmount;

    struct ModerateData {
        RewardState rewardState;
        uint freezePoolAmount;
        address userModerate;
    }

    enum RewardState {
        CREATED,
        PENDING,
        REJECTED,
        CONFIRMED,
        HARVESTED
    }

    mapping(address => ModerateData) public moderatePools;
    uint public guardianModerateTime;
    uint public totalFreeze;
}