// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

import "../ErrorReporter.sol";
import "../Exponential.sol";
import "../Oracles/PriceOracle.sol";
import "./ControllerInterface.sol";
import "./ControllerStorage.sol";
import "../Tokens/PTokenInterfaces.sol";
import "../Tokens/EIP20Interface.sol";
import "./Unitroller.sol";

/**
 * @title DeFiPie's Controller Contract
 * @author DeFiPie
 */
contract Controller is ControllerStorage, ControllerInterface, ControllerErrorReporter, Exponential {
    /// @notice Emitted when an admin supports a market
    event MarketListed(address pToken);

    /// @notice Emitted when an account enters a market
    event MarketEntered(address pToken, address account);

    /// @notice Emitted when an account exits a market
    event MarketExited(address pToken, address account);

    /// @notice Emitted when close factor is changed by admin
    event NewCloseFactor(uint oldCloseFactorMantissa, uint newCloseFactorMantissa);

    /// @notice Emitted when a collateral factor is changed by admin
    event NewCollateralFactor(address pToken, uint oldCollateralFactorMantissa, uint newCollateralFactorMantissa);

    /// @notice Event emitted when the fee factor max is changed
    event NewFeeFactorMaxMantissa(uint oldFeeFactorMaxMantissa, uint newFeeFactorMaxMantissa);

    /// @notice Event emitted when the fee factor is changed
    event NewFeeFactor(address pToken, uint oldFeeFactorMantissa, uint newFeeFactorMantissa);

    /// @notice Event emitted when the borrow delay is changed
    event NewBorrowDelay(uint oldBorrowDelay, uint newBorrowDelay);

    /// @notice Emitted when liquidation incentive is changed by admin
    event NewLiquidationIncentive(uint oldLiquidationIncentiveMantissa, uint newLiquidationIncentiveMantissa);

    /// @notice Emitted when maxAssets is changed by admin
    event NewMaxAssets(uint oldMaxAssets, uint newMaxAssets);

    /// @notice Emitted when price oracle is changed
    event NewPriceOracle(PriceOracle oldPriceOracle, PriceOracle newPriceOracle);

    /// @notice Emitted when pause guardian is changed
    event NewPauseGuardian(address oldPauseGuardian, address newPauseGuardian);

    /// @notice Emitted when distributor is changed
    event NewDistributor(address oldDistributor, address newDistributor);

    /// @notice Emitted when pause guardian is changed
    event NewLiquidateGuardian(address oldLiquidateGuardian, address newLiquidateGuardian);

    /// @notice Emitted when an action is paused globally
    event ActionPaused(string action, bool pauseState);

    /// @notice Emitted when an action is paused on a market
    event ActionPaused(address pToken, string action, bool pauseState);

    /// @notice Emitted when an action is transferred moderate reward to pool moderator
    event ModerateUserReward(address pToken, address user, uint unfreezeAmount);

    /// @notice Emitted when an action is transferred moderate amounts to pie pool
    event ModeratePoolReward(uint poolReward);

    /// @notice Emitted when an action is created pool and freeze pool create amount
    event FreezePoolAmount(address pToken, uint createPoolFeeAmount);

    /// @notice Emitted when an action is unfreeze pool create amount
    event UnfreezePoolAmount(address pToken, uint freezePoolAmount);

    /// @notice Event emitted when the moderate data is changed
    event NewUserModeratePoolData(uint oldUserPauseDepositAmount, uint newUserPauseDepositAmount_, uint oldGuardianModerateTime, uint newGuardianModerateTime_);

    // closeFactorMantissa must be strictly greater than this value
    uint internal constant closeFactorMinMantissa = 0.05e18; // 0.05

    // closeFactorMantissa must not exceed this value
    uint internal constant closeFactorMaxMantissa = 0.9e18; // 0.9

    // No collateralFactorMantissa may exceed this value
    uint internal constant collateralFactorMaxMantissa = 0.9e18; // 0.9

    // liquidationIncentiveMantissa must be no less than this value
    uint internal constant liquidationIncentiveMinMantissa = 1.0e18; // 1.0

    // liquidationIncentiveMantissa must be no greater than this value
    uint internal constant liquidationIncentiveMaxMantissa = 1.5e18; // 1.5

    constructor() {}

    /*** Assets You Are In ***/

    /**
     * @notice Returns the assets an account has entered
     * @param account The address of the account to pull assets for
     * @return A dynamic list with the assets the account has entered
     */
    function getAssetsIn(address account) external view returns (address[] memory) {
        address[] memory assetsIn = accountAssets[account];

        return assetsIn;
    }

    /**
     * @notice Returns whether the given account is entered in the given asset
     * @param account The address of the account to check
     * @param pToken The pToken to check
     * @return True if the account is in the asset, otherwise false.
     */
    function checkMembership(address account, address pToken) external view returns (bool) {
        return markets[pToken].accountMembership[account];
    }

    /**
    * @notice Returns whether the market is listed
     * @param pToken The pToken to check
     * @return True if the market is listed, otherwise false.
     */
    function checkIsListed(address pToken) external view override returns (bool) {
        return markets[pToken].isListed;
    }

    /**
     * @notice Add assets to be included in account liquidity calculation
     * @param pTokens The list of addresses of the pToken markets to be enabled
     * @return Success indicator for whether each corresponding market was entered
     */
    function enterMarkets(address[] memory pTokens) public override returns (uint[] memory) {
        uint len = pTokens.length;

        uint[] memory results = new uint[](len);
        for (uint i = 0; i < len; i++) {
            address pToken = pTokens[i];

            results[i] = uint(addToMarketInternal(pToken, msg.sender));
        }

        return results;
    }

    /**
     * @notice Add the market to the borrower's "assets in" for liquidity calculations
     * @param pToken The market to enter
     * @param borrower The address of the account to modify
     * @return Success indicator for whether the market was entered
     */
    function addToMarketInternal(address pToken, address borrower) internal returns (Error) {
        Market storage marketToJoin = markets[pToken];

        if (!marketToJoin.isListed) {
            // market is not listed, cannot join
            return Error.MARKET_NOT_LISTED;
        }

        if (marketToJoin.accountMembership[borrower] == true) {
            // already joined
            return Error.NO_ERROR;
        }

        if (accountAssets[borrower].length >= maxAssets)  {
            // no space, cannot join
            return Error.TOO_MANY_ASSETS;
        }

        // survived the gauntlet, add to list
        // NOTE: we store these somewhat redundantly as a significant optimization
        //  this avoids having to iterate through the list for the most common use cases
        //  that is, only when we need to perform liquidity checks
        //  and not whenever we want to check if an account is in a particular market
        marketToJoin.accountMembership[borrower] = true;
        accountAssets[borrower].push(pToken);

        emit MarketEntered(pToken, borrower);

        return Error.NO_ERROR;
    }

    /**
     * @notice Removes asset from sender's account liquidity calculation
     * @dev Sender must not have an outstanding borrow balance in the asset,
     *  or be providing neccessary collateral for an outstanding borrow.
     * @param pTokenAddress The address of the asset to be removed
     * @return Whether or not the account successfully exited the market
     */
    function exitMarket(address pTokenAddress) external override returns (uint) {
        address pToken = pTokenAddress;
        /* Get sender tokensHeld and amountOwed underlying from the pToken */
        (uint oErr, uint tokensHeld, uint amountOwed, ) = PTokenInterface(pToken).getAccountSnapshot(msg.sender);
        require(oErr == 0, "exitMarket: getAccountSnapshot failed"); // semi-opaque error code

        /* Fail if the sender has a borrow balance */
        if (amountOwed != 0) {
            return fail(Error.NONZERO_BORROW_BALANCE, FailureInfo.EXIT_MARKET_BALANCE_OWED);
        }

        /* Fail if the sender is not permitted to redeem all of their tokens */
        uint allowed = redeemAllowedInternal(pTokenAddress, msg.sender, tokensHeld);
        if (allowed != 0) {
            return failOpaque(Error.REJECTION, FailureInfo.EXIT_MARKET_REJECTION, allowed);
        }

        Market storage marketToExit = markets[pToken];

        /* Return true if the sender is not already ‘in’ the market */
        if (!marketToExit.accountMembership[msg.sender]) {
            return uint(Error.NO_ERROR);
        }

        /* Set pToken account membership to false */
        delete marketToExit.accountMembership[msg.sender];

        /* Delete pToken from the account’s list of assets */
        // load into memory for faster iteration
        address[] memory userAssetList = accountAssets[msg.sender];
        uint len = userAssetList.length;
        uint assetIndex = len;
        for (uint i = 0; i < len; i++) {
            if (userAssetList[i] == pToken) {
                assetIndex = i;
                break;
            }
        }

        // We *must* have found the asset in the list or our redundant data structure is broken
        assert(assetIndex < len);

        // copy last item in list to location of item to be removed, reduce length by 1
        address[] storage storedList = accountAssets[msg.sender];
        storedList[assetIndex] = storedList[storedList.length - 1];
        storedList.pop(); //storedList.length--;

        emit MarketExited(pToken, msg.sender);

        return uint(Error.NO_ERROR);
    }

    /*** Policy Hooks ***/

    /**
     * @notice Checks if the account should be allowed to mint tokens in the given market
     * @param pToken The market to verify the mint against
     * @param minter The account which would get the minted tokens
     * @param mintAmount The amount of underlying being supplied to the market in exchange for tokens
     * @return 0 if the mint is allowed, otherwise a semi-opaque error code (See ErrorReporter.sol)
     */
    function mintAllowed(address pToken, address minter, uint mintAmount) external override returns (uint) {
        // Pausing is a very serious situation - we revert to sound the alarms
        require(!mintGuardianPaused[pToken], "mint is paused");

        // Shh - currently unused
        minter;
        mintAmount;

        if (!markets[pToken].isListed) {
            return uint(Error.MARKET_NOT_LISTED);
        }

        // Keep the flywheel moving
        distributor.updatePieSupplyIndex(pToken);
        distributor.distributeSupplierPie(pToken, minter, false);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Checks if the account should be allowed to redeem tokens in the given market
     * @param pToken The market to verify the redeem against
     * @param redeemer The account which would redeem the tokens
     * @param redeemTokens The number of pTokens to exchange for the underlying asset in the market
     * @return 0 if the redeem is allowed, otherwise a semi-opaque error code (See ErrorReporter.sol)
     */
    function redeemAllowed(address pToken, address redeemer, uint redeemTokens) external override returns (uint) {
        uint allowed = redeemAllowedInternal(pToken, redeemer, redeemTokens);
        if (allowed != uint(Error.NO_ERROR)) {
            return allowed;
        }

        // Keep the flywheel moving
        distributor.updatePieSupplyIndex(pToken);
        distributor.distributeSupplierPie(pToken, redeemer, false);

        return uint(Error.NO_ERROR);
    }

    function redeemAllowedInternal(address pToken, address redeemer, uint redeemTokens) internal view returns (uint) {
        if (!markets[pToken].isListed) {
            return uint(Error.MARKET_NOT_LISTED);
        }

        /* If the redeemer is not 'in' the market, then we can bypass the liquidity check */
        if (!markets[pToken].accountMembership[redeemer]) {
            return uint(Error.NO_ERROR);
        }

        /* Otherwise, perform a hypothetical liquidity check to guard against shortfall */
        (Error err, , uint shortfall) = getHypotheticalAccountLiquidityInternal(redeemer, pToken, redeemTokens, 0);
        if (err != Error.NO_ERROR) {
            return uint(err);
        }
        if (shortfall > 0) {
            return uint(Error.INSUFFICIENT_LIQUIDITY);
        }

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates redeem and reverts on rejection. May emit logs.
     * @param pToken Asset being redeemed
     * @param redeemer The address redeeming the tokens
     * @param redeemAmount The amount of the underlying asset being redeemed
     * @param redeemTokens The number of tokens being redeemed
     */
    function redeemVerify(address pToken, address redeemer, uint redeemAmount, uint redeemTokens) external override {
        // Shh - currently unused
        pToken;
        redeemer;

        // Require tokens is zero or amount is also zero
        if (redeemTokens == 0 && redeemAmount > 0) {
            revert("redeemTokens zero");
        }
    }

    /**
     * @notice Checks if the account should be allowed to borrow the underlying asset of the given market
     * @param pToken The market to verify the borrow against
     * @param borrower The account which would borrow the asset
     * @param borrowAmount The amount of underlying the account would borrow
     * @return 0 if the borrow is allowed, otherwise a semi-opaque error code (See ErrorReporter.sol)
     */
    function borrowAllowed(address pToken, address borrower, uint borrowAmount) external override returns (uint) {
        // Pausing is a very serious situation - we revert to sound the alarms
        require(!borrowGuardianPaused[pToken], "borrow is paused");

        if (!markets[pToken].isListed) {
            return uint(Error.MARKET_NOT_LISTED);
        }

        Error err;

        if (!markets[pToken].accountMembership[borrower]) {
            // only pTokens may call borrowAllowed if borrower not in market
            require(msg.sender == pToken, "sender must be pToken");

            // attempt to add borrower to the market
            err = addToMarketInternal(msg.sender, borrower);
            if (err != Error.NO_ERROR) {
                return uint(err);
            }

            // it should be impossible to break the important invariant
            assert(markets[pToken].accountMembership[borrower]);
        }

        if (getOracle().getUnderlyingPrice(pToken) == 0) {
            return uint(Error.PRICE_ERROR);
        }

        uint shortfall;

        (err, , shortfall) = getHypotheticalAccountLiquidityInternal(borrower, pToken, 0, borrowAmount);
        if (err != Error.NO_ERROR) {
            return uint(err);
        }
        if (shortfall > 0) {
            return uint(Error.INSUFFICIENT_LIQUIDITY);
        }

        // Keep the flywheel moving
        Exp memory borrowIndex = Exp({mantissa: PTokenInterface(pToken).borrowIndex()});
        distributor.updatePieBorrowIndex(pToken, borrowIndex);
        distributor.distributeBorrowerPie(pToken, borrower, borrowIndex, false);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Checks if the account should be allowed to repay a borrow in the given market
     * @param pToken The market to verify the repay against
     * @param payer The account which would repay the asset
     * @param borrower The account which would borrowed the asset
     * @param repayAmount The amount of the underlying asset the account would repay
     * @return 0 if the repay is allowed, otherwise a semi-opaque error code (See ErrorReporter.sol)
     */
    function repayBorrowAllowed(
        address pToken,
        address payer,
        address borrower,
        uint repayAmount
    ) external override returns (uint) {
        // Shh - currently unused
        payer;
        borrower;
        repayAmount;

        if (!markets[pToken].isListed) {
            return uint(Error.MARKET_NOT_LISTED);
        }

        // Keep the flywheel moving
        Exp memory borrowIndex = Exp({mantissa: PTokenInterface(pToken).borrowIndex()});
        distributor.updatePieBorrowIndex(pToken, borrowIndex);
        distributor.distributeBorrowerPie(pToken, borrower, borrowIndex, false);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Checks if the liquidation should be allowed to occur
     * @param pTokenBorrowed Asset which was borrowed by the borrower
     * @param pTokenCollateral Asset which was used as collateral and will be seized
     * @param liquidator The address repaying the borrow and seizing the collateral
     * @param borrower The address of the borrower
     * @param repayAmount The amount of underlying being repaid
     */
    function liquidateBorrowAllowed(
        address pTokenBorrowed,
        address pTokenCollateral,
        address liquidator,
        address borrower,
        uint repayAmount
    ) external override returns (uint) {
        if (!markets[pTokenBorrowed].isListed || !markets[pTokenCollateral].isListed) {
            return uint(Error.MARKET_NOT_LISTED);
        }

        /* The borrower must have shortfall(sumCollateral < sumBorrowPlusEffects) in order to be liquidatable */
        (Error err, uint sumCollateral, uint sumBorrowPlusEffects, uint sumDeposit) = calcHypotheticalAccountLiquidityInternal(borrower, address(0), 0, 0);
        if (err != Error.NO_ERROR) {
            return uint(err);
        }
        if (sumCollateral >= sumBorrowPlusEffects) {
            return uint(Error.INSUFFICIENT_SHORTFALL);
        }

        /* The liquidator may not repay more than what is allowed by the closeFactor */
        uint borrowBalance = PTokenInterface(pTokenBorrowed).borrowBalanceStored(borrower);
        (MathError mathErr, uint maxClose) = mulScalarTruncate(Exp({mantissa: closeFactorMantissa}), borrowBalance);
        if (mathErr != MathError.NO_ERROR) {
            return uint(Error.MATH_ERROR);
        }
        if (repayAmount > maxClose) {
            return uint(Error.TOO_MUCH_REPAY);
        }

        // res = sumBorrowPlusEffects * liquidationIncentiveMantissa / 1e18
        uint result = div_(mul_(sumBorrowPlusEffects, liquidationIncentiveMantissa), 1e18);
        if (result > sumDeposit
            && liquidator != liquidateGuardian
        ) {
            return uint(Error.GUARDIAN_REJECTION);
        }

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Checks if the seizing of assets should be allowed to occur
     * @param pTokenCollateral Asset which was used as collateral and will be seized
     * @param pTokenBorrowed Asset which was borrowed by the borrower
     * @param liquidator The address repaying the borrow and seizing the collateral
     * @param borrower The address of the borrower
     * @param seizeTokens The number of collateral tokens to seize
     */
    function seizeAllowed(
        address pTokenCollateral,
        address pTokenBorrowed,
        address liquidator,
        address borrower,
        uint seizeTokens
    ) external override returns (uint) {
        // Pausing is a very serious situation - we revert to sound the alarms
        require(!seizeGuardianPaused, "seize is paused");

        // Shh - currently unused
        seizeTokens;

        if (!markets[pTokenCollateral].isListed || !markets[pTokenBorrowed].isListed) {
            return uint(Error.MARKET_NOT_LISTED);
        }

        if (PTokenInterface(pTokenCollateral).controller() != PTokenInterface(pTokenBorrowed).controller()) {
            return uint(Error.CONTROLLER_MISMATCH);
        }

        // Keep the flywheel moving
        distributor.updatePieSupplyIndex(pTokenCollateral);
        distributor.distributeSupplierPie(pTokenCollateral, borrower, false);
        distributor.distributeSupplierPie(pTokenCollateral, liquidator, false);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Checks if the account should be allowed to transfer tokens in the given market
     * @param pToken The market to verify the transfer against
     * @param src The account which sources the tokens
     * @param dst The account which receives the tokens
     * @param transferTokens The number of pTokens to transfer
     * @return 0 if the transfer is allowed, otherwise a semi-opaque error code (See ErrorReporter.sol)
     */
    function transferAllowed(
        address pToken,
        address src,
        address dst,
        uint transferTokens
    ) external override returns (uint) {
        // Pausing is a very serious situation - we revert to sound the alarms
        require(!transferGuardianPaused, "transfer is paused");

        // Currently the only consideration is whether or not
        //  the src is allowed to redeem this many tokens
        uint allowed = redeemAllowedInternal(pToken, src, transferTokens);
        if (allowed != uint(Error.NO_ERROR)) {
            return allowed;
        }

        // Keep the flywheel moving
        distributor.updatePieSupplyIndex(pToken);
        distributor.distributeSupplierPie(pToken, src, false);
        distributor.distributeSupplierPie(pToken, dst, false);

        return uint(Error.NO_ERROR);
    }

    /*** Liquidity/Liquidation Calculations ***/

    /**
     * @dev Local vars for avoiding stack-depth limits in calculating account liquidity.
     *  Note that `pTokenBalance` is the number of pTokens the account owns in the market,
     *  whereas `borrowBalance` is the amount of underlying that the account has borrowed.
     */
    struct AccountLiquidityLocalVars {
        uint sumCollateral;
        uint sumBorrowPlusEffects;
        uint pTokenBalance;
        uint borrowBalance;
        uint exchangeRateMantissa;
        uint oraclePriceMantissa;
        uint sumDeposit;
        Exp collateralFactor;
        Exp exchangeRate;
        Exp oraclePrice;
        Exp tokensToDenom;
    }

    /**
     * @notice Determine the current account liquidity wrt collateral requirements
     * @return (possible error code (semi-opaque),
                account liquidity in excess of collateral requirements,
     *          account shortfall below collateral requirements)
     */
    function getAccountLiquidity(address account) public view returns (uint, uint, uint) {
        (Error err, uint liquidity, uint shortfall) = getHypotheticalAccountLiquidityInternal(account, address(0), 0, 0);

        return (uint(err), liquidity, shortfall);
    }

    /**
     * @notice Determine the current account liquidity wrt collateral requirements
     * @return (possible error code,
                account liquidity in excess of collateral requirements,
     *          account shortfall below collateral requirements)
     */
    function getAccountLiquidityInternal(address account) internal view returns (Error, uint, uint) {
        return getHypotheticalAccountLiquidityInternal(account, address(0), 0, 0);
    }

    /**
     * @notice Determine what the account liquidity would be if the given amounts were redeemed/borrowed
     * @param pTokenModify The market to hypothetically redeem/borrow in
     * @param account The account to determine liquidity for
     * @param redeemTokens The number of tokens to hypothetically redeem
     * @param borrowAmount The amount of underlying to hypothetically borrow
     * @return (possible error code (semi-opaque),
                hypothetical account liquidity in excess of collateral requirements,
     *          hypothetical account shortfall below collateral requirements)
     */
    function getHypotheticalAccountLiquidity(
        address account,
        address pTokenModify,
        uint redeemTokens,
        uint borrowAmount
    ) public view virtual returns (uint, uint, uint) {
        (Error err, uint liquidity, uint shortfall) = getHypotheticalAccountLiquidityInternal(account, pTokenModify, redeemTokens, borrowAmount);
        return (uint(err), liquidity, shortfall);
    }

    /**
     * @notice Determine what the account liquidity would be if the given amounts were redeemed/borrowed
     * @param pTokenModify The market to hypothetically redeem/borrow in
     * @param account The account to determine liquidity for
     * @param redeemTokens The number of tokens to hypothetically redeem
     * @param borrowAmount The amount of underlying to hypothetically borrow
     * @dev Note that we calculate the exchangeRateStored for each collateral pToken using stored data,
     *  without calculating accumulated interest.
     * @return (possible error code,
                hypothetical account liquidity in excess of collateral requirements,
     *          hypothetical account shortfall below collateral requirements)
     */
    function getHypotheticalAccountLiquidityInternal(
        address account,
        address pTokenModify,
        uint redeemTokens,
        uint borrowAmount
    ) internal view returns (Error, uint, uint) {

        (Error err, uint sumCollateral, uint sumBorrowPlusEffects, ) = calcHypotheticalAccountLiquidityInternal(account, pTokenModify, redeemTokens, borrowAmount);
        if (err != Error.NO_ERROR) {
            return (err, sumCollateral, sumBorrowPlusEffects);
        }

        // These are safe, as the underflow condition is checked first
        if (sumCollateral > sumBorrowPlusEffects) {
            return (Error.NO_ERROR, sumCollateral - sumBorrowPlusEffects, 0);
        } else {
            return (Error.NO_ERROR, 0, sumBorrowPlusEffects - sumCollateral);
        }
    }

    function calcHypotheticalAccountLiquidityInternal(
        address account,
        address pTokenModify,
        uint redeemTokens,
        uint borrowAmount
    ) internal view returns (Error, uint, uint, uint) {

        AccountLiquidityLocalVars memory vars; // Holds all our calculation results
        uint oErr;
        MathError mErr;

        // For each asset the account is in
        address[] memory assets = accountAssets[account];
        for (uint i = 0; i < assets.length; i++) {
            address asset = assets[i];

            // Read the balances and exchange rate from the pToken
            (oErr, vars.pTokenBalance, vars.borrowBalance, vars.exchangeRateMantissa) = PTokenInterface(asset).getAccountSnapshot(account);
            if (oErr != 0) { // semi-opaque error code, we assume NO_ERROR == 0 is invariant between upgrades
                return (Error.SNAPSHOT_ERROR, 0, 0, 0);
            }
            vars.collateralFactor = Exp({mantissa: markets[address(asset)].collateralFactorMantissa});
            vars.exchangeRate = Exp({mantissa: vars.exchangeRateMantissa});

            // Get the normalized price of the asset
            vars.oraclePriceMantissa = getOracle().getUnderlyingPrice(asset);
            if (vars.oraclePriceMantissa == 0) {
                return (Error.PRICE_ERROR, 0, 0, 0);
            }

            vars.oraclePrice = Exp({mantissa: vars.oraclePriceMantissa});

            // Pre-compute a conversion factor from tokens -> ether (normalized price value)
            (mErr, vars.tokensToDenom) = mulExp(vars.exchangeRate, vars.oraclePrice);
            if (mErr != MathError.NO_ERROR) {
                return (Error.MATH_ERROR, 0, 0, 0);
            }

            (mErr, vars.sumDeposit) = mulScalarTruncateAddUInt(vars.tokensToDenom, vars.pTokenBalance, vars.sumDeposit);
            if (mErr != MathError.NO_ERROR) {
                return (Error.MATH_ERROR, 0, 0, 0);
            }

            (mErr, vars.tokensToDenom) = mulExp(vars.collateralFactor, vars.tokensToDenom);
            if (mErr != MathError.NO_ERROR) {
                return (Error.MATH_ERROR, 0, 0, 0);
            }

            // sumCollateral += tokensToDenom * pTokenBalance
            (mErr, vars.sumCollateral) = mulScalarTruncateAddUInt(vars.tokensToDenom, vars.pTokenBalance, vars.sumCollateral);
            if (mErr != MathError.NO_ERROR) {
                return (Error.MATH_ERROR, 0, 0, 0);
            }

            // for feeToken
            if (asset != registry.pETH()
                && asset != registry.pPIE()
                && feeFactorMantissa[asset] > 0
            ) {
                // vars.oraclePriceMantissa * (1e18 + feeFactorMantissa[asset] * 3) / 1e18
                vars.oraclePrice = Exp({mantissa: div_(mul_(vars.oraclePriceMantissa, (add_(1e18, mul_(feeFactorMantissa[asset], 3)))), 1e18)});
            }

            // sumBorrowPlusEffects += oraclePrice * borrowBalance
            (mErr, vars.sumBorrowPlusEffects) = mulScalarTruncateAddUInt(vars.oraclePrice, vars.borrowBalance, vars.sumBorrowPlusEffects);
            if (mErr != MathError.NO_ERROR) {
                return (Error.MATH_ERROR, 0, 0, 0);
            }

            // Calculate effects of interacting with pTokenModify
            if (asset == pTokenModify) {
                // redeem effect
                // sumBorrowPlusEffects += tokensToDenom * redeemTokens
                (mErr, vars.sumBorrowPlusEffects) = mulScalarTruncateAddUInt(vars.tokensToDenom, redeemTokens, vars.sumBorrowPlusEffects);
                if (mErr != MathError.NO_ERROR) {
                    return (Error.MATH_ERROR, 0, 0, 0);
                }

                // borrow effect
                // sumBorrowPlusEffects += oraclePrice * borrowAmount
                (mErr, vars.sumBorrowPlusEffects) = mulScalarTruncateAddUInt(vars.oraclePrice, borrowAmount, vars.sumBorrowPlusEffects);
                if (mErr != MathError.NO_ERROR) {
                    return (Error.MATH_ERROR, 0, 0, 0);
                }
            }
        }

        return (Error.NO_ERROR, vars.sumCollateral, vars.sumBorrowPlusEffects, vars.sumDeposit);
    }

    /**
     * @notice Calculate number of tokens of collateral asset to seize given an underlying amount
     * @dev Used in liquidation (called in pToken.liquidateBorrowFresh)
     * @param pTokenBorrowed The address of the borrowed pToken
     * @param pTokenCollateral The address of the collateral pToken
     * @param actualRepayAmount The amount of pTokenBorrowed underlying to convert into pTokenCollateral tokens
     * @return (errorCode, number of pTokenCollateral tokens to be seized in a liquidation)
     */
    function liquidateCalculateSeizeTokens(
        address pTokenBorrowed,
        address pTokenCollateral,
        uint actualRepayAmount
    ) external view override returns (uint, uint) {
        /* Read oracle prices for borrowed and collateral markets */
        uint priceBorrowedMantissa = getOracle().getUnderlyingPrice(pTokenBorrowed);
        uint priceCollateralMantissa = getOracle().getUnderlyingPrice(pTokenCollateral);
        if (priceBorrowedMantissa == 0 || priceCollateralMantissa == 0) {
            return (uint(Error.PRICE_ERROR), 0);
        }

        /*
         * Get the exchange rate and calculate the number of collateral tokens to seize:
         *  seizeAmount = actualRepayAmount * liquidationIncentive * priceBorrowed / priceCollateral
         *  seizeTokens = seizeAmount / exchangeRate
         *   = actualRepayAmount * (liquidationIncentive * priceBorrowed) / (priceCollateral * exchangeRate)
         */
        uint seizeTokens;
        Exp memory numerator;
        Exp memory denominator;
        Exp memory ratio;
        MathError mathErr;

        (mathErr, numerator) = mulExp(liquidationIncentiveMantissa, priceBorrowedMantissa);
        if (mathErr != MathError.NO_ERROR) {
            return (uint(Error.MATH_ERROR), 0);
        }

        // uint exchangeRateMantissa = PTokenInterface(pTokenCollateral).exchangeRateStored(); // Note: reverts on error
        (mathErr, denominator) = mulExp(priceCollateralMantissa, PTokenInterface(pTokenCollateral).exchangeRateStored());
        if (mathErr != MathError.NO_ERROR) {
            return (uint(Error.MATH_ERROR), 0);
        }

        (mathErr, ratio) = divExp(numerator, denominator);
        if (mathErr != MathError.NO_ERROR) {
            return (uint(Error.MATH_ERROR), 0);
        }

        (mathErr, seizeTokens) = mulScalarTruncate(ratio, actualRepayAmount);
        if (mathErr != MathError.NO_ERROR) {
            return (uint(Error.MATH_ERROR), 0);
        }

        uint feeFactor = feeFactorMantissa[pTokenBorrowed];
        if (feeFactor > 0) {
            // seizeTokens * 1e36 / ((1e18 - feeFactorMantissa[pTokenBorrowed]) ** 2)
            uint res = sub_(1e18, feeFactor);
            seizeTokens = div_(mul_(seizeTokens, 1e36), mul_(res, res));
        }

        return (uint(Error.NO_ERROR), seizeTokens);
    }

    /*** Admin Functions ***/

    /**
      * @notice Sets the closeFactor used when liquidating borrows
      * @dev Admin function to set closeFactor
      * @param newCloseFactorMantissa New close factor, scaled by 1e18
      * @return uint 0=success, otherwise a failure. (See ErrorReporter for details)
      */
    function _setCloseFactor(uint newCloseFactorMantissa) external returns (uint) {
        // Check caller is admin
        if (msg.sender != getAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_CLOSE_FACTOR_OWNER_CHECK);
        }

        Exp memory newCloseFactorExp = Exp({mantissa: newCloseFactorMantissa});
        Exp memory lowLimit = Exp({mantissa: closeFactorMinMantissa});
        if (lessThanOrEqualExp(newCloseFactorExp, lowLimit)) {
            return fail(Error.INVALID_CLOSE_FACTOR, FailureInfo.SET_CLOSE_FACTOR_VALIDATION);
        }

        Exp memory highLimit = Exp({mantissa: closeFactorMaxMantissa});
        if (lessThanExp(highLimit, newCloseFactorExp)) {
            return fail(Error.INVALID_CLOSE_FACTOR, FailureInfo.SET_CLOSE_FACTOR_VALIDATION);
        }

        uint oldCloseFactorMantissa = closeFactorMantissa;
        closeFactorMantissa = newCloseFactorMantissa;
        emit NewCloseFactor(oldCloseFactorMantissa, closeFactorMantissa);

        return uint(Error.NO_ERROR);
    }

    /**
      * @notice Sets the collateralFactor for a market
      * @dev Admin function to set per-market collateralFactor
      * @param pToken The market to set the factor on
      * @param newCollateralFactorMantissa The new collateral factor, scaled by 1e18
      * @return uint 0=success, otherwise a failure. (See ErrorReporter for details)
      */
    function _setCollateralFactor(address pToken, uint newCollateralFactorMantissa) external returns (uint) {
        // Check caller is admin
        if (msg.sender != getAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_COLLATERAL_FACTOR_OWNER_CHECK);
        }

        // Verify market is listed
        Market storage market = markets[pToken];
        if (!market.isListed) {
            return fail(Error.MARKET_NOT_LISTED, FailureInfo.SET_COLLATERAL_FACTOR_NO_EXISTS);
        }

        Exp memory newCollateralFactorExp = Exp({mantissa: newCollateralFactorMantissa});

        // Check collateral factor <= 0.9
        Exp memory highLimit = Exp({mantissa: collateralFactorMaxMantissa});
        if (lessThanExp(highLimit, newCollateralFactorExp)) {
            return fail(Error.INVALID_COLLATERAL_FACTOR, FailureInfo.SET_COLLATERAL_FACTOR_VALIDATION);
        }

        getOracle().updateUnderlyingPrice(pToken);
        // If collateral factor != 0, fail if price == 0
        if (newCollateralFactorMantissa != 0 && getOracle().getUnderlyingPrice(pToken) == 0) {
            return fail(Error.PRICE_ERROR, FailureInfo.SET_COLLATERAL_FACTOR_WITHOUT_PRICE);
        }

        // Set market's collateral factor to new collateral factor, remember old value
        uint oldCollateralFactorMantissa = market.collateralFactorMantissa;
        market.collateralFactorMantissa = newCollateralFactorMantissa;

        // Emit event with asset, old collateral factor, and new collateral factor
        emit NewCollateralFactor(pToken, oldCollateralFactorMantissa, newCollateralFactorMantissa);

        return uint(Error.NO_ERROR);
    }

    /**
      * @notice Sets the max fee factor for a markets
      * @dev Admin function to set max fee factor
      * @param newFeeFactorMaxMantissa The new max fee factor, scaled by 1e18
      * @return uint 0=success, otherwise a failure. (See ErrorReporter for details)
      */
    function _setFeeFactorMaxMantissa(uint newFeeFactorMaxMantissa) external returns (uint) {
        if (msg.sender != getAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_MAX_FEE_FACTOR);
        }

        uint oldFeeFactorMaxMantissa = feeFactorMaxMantissa;
        feeFactorMaxMantissa = newFeeFactorMaxMantissa;

        emit NewFeeFactorMaxMantissa(oldFeeFactorMaxMantissa, newFeeFactorMaxMantissa);

        return uint(Error.NO_ERROR);
    }

    /**
      * @notice Sets the feeFactor for a market
      * @dev Admin function to set per-market fee factor (also market can set fee factor after calc)
      * @param pToken The market to set the factor on
      * @param newFeeFactorMantissa The new fee factor, scaled by 1e18
      * @return uint 0=success, otherwise a failure. (See ErrorReporter for details)
      */
    function _setFeeFactor(address pToken, uint newFeeFactorMantissa) public override returns (uint) {
        if (msg.sender != getAdmin() && !markets[msg.sender].isListed) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_FEE_FACTOR);
        }

        require(newFeeFactorMantissa <= feeFactorMaxMantissa, 'SET_FEE_FACTOR_FAILED');
        require(markets[pToken].isListed, 'market is not listed');

        uint oldFeeFactorMantissa = feeFactorMantissa[pToken];
        feeFactorMantissa[pToken] = newFeeFactorMantissa;

        emit NewFeeFactor(pToken, oldFeeFactorMantissa, newFeeFactorMantissa);

        return uint(Error.NO_ERROR);
    }

    /**
      * @notice Sets the feeFactors for a markets
      * @dev Admin function to set per-market fee factors (also market can set fee factor after calc)
      * @param pTokens Markets to set the factor on
      * @param newFeeFactors The new fee factors for markets, scaled by 1e18
      * @return uint 0=success, otherwise a failure. (See ErrorReporter for details)
      */
    function _setFeeFactors(address[] calldata pTokens, uint[] calldata newFeeFactors) external returns (uint) {
        require(pTokens.length != 0 && newFeeFactors.length == pTokens.length, "invalid input");

        uint result;
        for(uint i = 0; i < pTokens.length; i++ ) {
            result = _setFeeFactor(pTokens[i], newFeeFactors[i]);

            if (result != uint(Error.NO_ERROR)) {
                return fail(Error.REJECTION, FailureInfo.SET_FEE_FACTOR);
            }
        }

        return uint(Error.NO_ERROR);
    }

    /**
      * @notice Sets maxAssets which controls how many markets can be entered
      * @dev Admin function to set maxAssets
      * @param newMaxAssets New max assets
      * @return uint 0=success, otherwise a failure. (See ErrorReporter for details)
      */
    function _setMaxAssets(uint newMaxAssets) external returns (uint) {
        // Check caller is admin
        if (msg.sender != getAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_MAX_ASSETS_OWNER_CHECK);
        }

        uint oldMaxAssets = maxAssets;
        maxAssets = newMaxAssets;
        emit NewMaxAssets(oldMaxAssets, newMaxAssets);

        return uint(Error.NO_ERROR);
    }

    /**
      * @notice Sets liquidationIncentive
      * @dev Admin function to set liquidationIncentive
      * @param newLiquidationIncentiveMantissa New liquidationIncentive scaled by 1e18
      * @return uint 0=success, otherwise a failure. (See ErrorReporter for details)
      */
    function _setLiquidationIncentive(uint newLiquidationIncentiveMantissa) external returns (uint) {
        // Check caller is admin
        if (msg.sender != getAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_LIQUIDATION_INCENTIVE_OWNER_CHECK);
        }

        // Check de-scaled min <= newLiquidationIncentive <= max
        Exp memory newLiquidationIncentive = Exp({mantissa: newLiquidationIncentiveMantissa});
        Exp memory minLiquidationIncentive = Exp({mantissa: liquidationIncentiveMinMantissa});
        if (lessThanExp(newLiquidationIncentive, minLiquidationIncentive)) {
            return fail(Error.INVALID_LIQUIDATION_INCENTIVE, FailureInfo.SET_LIQUIDATION_INCENTIVE_VALIDATION);
        }

        Exp memory maxLiquidationIncentive = Exp({mantissa: liquidationIncentiveMaxMantissa});
        if (lessThanExp(maxLiquidationIncentive, newLiquidationIncentive)) {
            return fail(Error.INVALID_LIQUIDATION_INCENTIVE, FailureInfo.SET_LIQUIDATION_INCENTIVE_VALIDATION);
        }

        // Save current value for use in log
        uint oldLiquidationIncentiveMantissa = liquidationIncentiveMantissa;

        // Set liquidation incentive to new incentive
        liquidationIncentiveMantissa = newLiquidationIncentiveMantissa;

        // Emit event with old incentive, new incentive
        emit NewLiquidationIncentive(oldLiquidationIncentiveMantissa, newLiquidationIncentiveMantissa);

        return uint(Error.NO_ERROR);
    }

    /**
      * @notice Add the market to the markets mapping and set it as listed
      * @dev Admin function to set isListed and add support for the market
      * @param pToken The address of the market (token) to list
      * @return uint 0=success, otherwise a failure. (See enum Error for details)
      */
    function _supportMarket(address pToken) external returns (uint) {
        if (msg.sender != getAdmin() && msg.sender != registry.factory()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SUPPORT_MARKET_OWNER_CHECK);
        }

        if (markets[pToken].isListed) {
            return fail(Error.MARKET_ALREADY_LISTED, FailureInfo.SUPPORT_MARKET_EXISTS);
        }

        PTokenInterface(pToken).isPToken(); // Sanity check to make sure its really a PToken

        _addMarketInternal(pToken);

        Market storage newMarket = markets[pToken];
        newMarket.isListed = true;

        emit MarketListed(pToken);

        return uint(Error.NO_ERROR);
    }

    function _addMarketInternal(address pToken) internal {
        require(markets[pToken].isListed == false, "market already added");
        allMarkets.push(pToken);
    }

    /**
     * @notice Admin function to change the Pause Guardian
     * @param newPauseGuardian The address of the new Pause Guardian
     * @return uint 0=success, otherwise a failure. (See enum Error for details)
     */
    function _setPauseGuardian(address newPauseGuardian) public returns (uint) {
        if (msg.sender != getAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_GUARDIAN_OWNER_CHECK);
        }

        // Save current value for inclusion in log
        address oldPauseGuardian = pauseGuardian;

        // Store pauseGuardian with value newPauseGuardian
        pauseGuardian = newPauseGuardian;

        // Emit NewPauseGuardian(OldPauseGuardian, NewPauseGuardian)
        emit NewPauseGuardian(oldPauseGuardian, pauseGuardian);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Admin function to change the Liquidate Guardian
     * @param newLiquidateGuardian The address of the new Liquidate Guardian
     * @return uint 0=success, otherwise a failure. (See enum Error for details)
     */
    function _setLiquidateGuardian(address newLiquidateGuardian) public returns (uint) {
        if (msg.sender != getAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_GUARDIAN_OWNER_CHECK);
        }

        // Save current value for inclusion in log
        address oldLiquidateGuardian = liquidateGuardian;

        // Store pauseGuardian with value newLiquidateGuardian
        liquidateGuardian = newLiquidateGuardian;

        // Emit newLiquidateGuardian(OldPauseGuardian, NewLiquidateGuardian)
        emit NewLiquidateGuardian(oldLiquidateGuardian, liquidateGuardian);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Admin function to change the Distributor
     * @param newDistributor The address of the new Distributor
     * @return uint 0=success, otherwise a failure. (See enum Error for details)
     */
    function _setDistributor(address newDistributor) public returns (uint) {
        if (msg.sender != getAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_GUARDIAN_OWNER_CHECK);
        }

        // Save current value for inclusion in log
        address oldDistributor = address(distributor);

        // Store distributor with value newDistributor
        distributor = DistributorInterface(newDistributor);

        // Emit NewDistributor(OldDistributor, NewDistributor)
        emit NewDistributor(oldDistributor, address(distributor));

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Admin function to change the mint status for market
     * @param pToken The address of the market
     * @param state The flag of the mint status for market
     * @return uint 0=success, otherwise a failure. (See enum Error for details)
     */
    function _setMintPaused(address pToken, bool state) public returns (bool) {
        require(markets[pToken].isListed, "cannot pause a market that is not listed");
        require(msg.sender == pauseGuardian || msg.sender == getAdmin(), "only pause guardian and admin can pause");
        require(msg.sender == getAdmin() || state == true, "only admin can unpause");

        mintGuardianPaused[pToken] = state;

        emit ActionPaused(pToken, "Mint", state);

        return state;
    }

    /**
     * @notice Factory function to get reward for moderate pool
     * @param pToken The address of the market
     * @param createPoolFeeAmount The token amount for freeze
     */
    function setFreezePoolAmount(address pToken, uint createPoolFeeAmount) public override {
        require(msg.sender == registry.factory(), "only factory can set freeze");
        moderatePools[pToken].freezePoolAmount = createPoolFeeAmount;
        totalFreeze = add_(totalFreeze, createPoolFeeAmount);

        emit FreezePoolAmount(pToken, createPoolFeeAmount);
    }

    /**
     * @notice Admin function to change the borrow status for market
     * @param pToken The address of the market
     * @param state The flag of the borrow status for market
     * @return uint 0=success, otherwise a failure. (See enum Error for details)
     */
    function _setBorrowPaused(address pToken, bool state) public returns (bool) {
        require(markets[pToken].isListed, "cannot pause a market that is not listed");

        if (msg.sender == getAdmin()) {
            // nothing
        } else if (msg.sender == pauseGuardian) {
            uint startBorrowTimestamp = PErc20ExtInterface(pToken).startBorrowTimestamp();

            if (block.timestamp > startBorrowTimestamp + guardianModerateTime) {
                require(state == true, "only pause after start borrow and moderate time");
            } else {
                if (state == true) {
                    // nothing
                } else {
                    ModerateData storage pool = moderatePools[pToken];
                    require(pool.rewardState == RewardState.PENDING, "bad reward state"); // only admin can unpause after pause guardian
                    pool.rewardState = RewardState.REJECTED;
                }
            }
        } else {
            require(!borrowGuardianPaused[pToken] && state == true, "only pause");

            uint startBorrowTimestamp = PErc20ExtInterface(pToken).startBorrowTimestamp();
            require(block.timestamp < startBorrowTimestamp, "only before startBorrow");

            EIP20Interface(distributor.getPieAddress()).transferFrom(msg.sender, address(this), userPauseDepositAmount);

            ModerateData storage pool = moderatePools[pToken];
            require(pool.rewardState == RewardState.CREATED, "bad reward state");

            pool.userModerate = msg.sender;
            pool.freezePoolAmount += userPauseDepositAmount;
            pool.rewardState = RewardState.PENDING;

            totalFreeze = add_(totalFreeze, userPauseDepositAmount);
        }

        borrowGuardianPaused[pToken] = state;

        emit ActionPaused(pToken, "Borrow", state);

        return state;
    }

    /**
     * @notice User function to get reward for moderate pool
     * @param pToken The address of the market
     * @return uint 0=success, otherwise a failure. (See enum Error for details)
     */
    function getModerateUserReward(address pToken) public returns(uint) {
        uint startBorrowTimestamp = PErc20ExtInterface(pToken).startBorrowTimestamp();
        require(block.timestamp > startBorrowTimestamp + guardianModerateTime, "only after start borrow and guardian time");

        ModerateData storage pool = moderatePools[pToken];
        require(msg.sender == pool.userModerate, "only moderate pool user can get reward");
        require(pool.rewardState == RewardState.PENDING, "only once");

        pool.rewardState = RewardState.CONFIRMED;

        uint unfreezeAmount = pool.freezePoolAmount;
        totalFreeze = sub_(totalFreeze, unfreezeAmount);

        EIP20Interface(distributor.getPieAddress()).transfer(msg.sender, unfreezeAmount);

        emit ModerateUserReward(pToken, msg.sender, unfreezeAmount);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Function to harvest unused reward
     * @param pToken The address of the market
     */
    function harvestUnusedReward(address pToken) public {
        uint startBorrowTimestamp = PErc20ExtInterface(pToken).startBorrowTimestamp();
        require(block.timestamp > startBorrowTimestamp + guardianModerateTime, "current time is less than user end moderate pool time");

        ModerateData storage pool = moderatePools[pToken];
        require(pool.rewardState == RewardState.CREATED || pool.rewardState == RewardState.REJECTED, "reward must be unused");

        pool.rewardState = RewardState.HARVESTED;

        uint freezePoolAmount = pool.freezePoolAmount;
        totalFreeze = sub_(totalFreeze, freezePoolAmount);

        emit UnfreezePoolAmount(pToken, freezePoolAmount);
    }

    function harvestUnusedRewards(address[] calldata pTokens) public {
        for(uint i = 0; i < pTokens.length; i++) {
            harvestUnusedReward(pTokens[i]);
        }
    }

    /**
     * @notice Function to transfer all not freeze tokens to ppie pool
     */
    function transferModeratePoolReward() public {
        address ppieAddress = RegistryInterface(registry).pPIE();
        address pieAddress = distributor.getPieAddress();
        uint balance = EIP20Interface(pieAddress).balanceOf(address(this));

        uint poolReward = sub_(balance, totalFreeze);

        if (poolReward > 0 ) {
            EIP20Interface(pieAddress).transfer(ppieAddress, poolReward);

            emit ModeratePoolReward(poolReward);
        }
    }

    /**
     * @notice Admin function to change the Borrow Delay
     * @param newBorrowDelay The value of the new Borrow Delay in seconds
     * @return uint 0=success, otherwise a failure. (See enum Error for details)
     */
    function _setBorrowDelay(uint newBorrowDelay) public returns (uint) {
        if (msg.sender != getAdmin()) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_BORROW_DELAY_OWNER_CHECK);
        }

        // Save current value for inclusion in log
        uint oldBorrowDelay = borrowDelay;

        // Store dorrowDelay with value newBorrowDelay
        borrowDelay = newBorrowDelay;

        // Emit newBorrowDelay(OldBorrowDelay, NewBorrowDelay)
        emit NewBorrowDelay(oldBorrowDelay, borrowDelay);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Admin function to change the transfer status for markets
     * @param state The flag of the transfer status
     * @return uint 0=success, otherwise a failure. (See enum Error for details)
     */
    function _setTransferPaused(bool state) public returns (bool) {
        require(msg.sender == pauseGuardian || msg.sender == getAdmin(), "only pause guardian and admin can pause");
        require(msg.sender == getAdmin() || state == true, "only admin can unpause");

        transferGuardianPaused = state;

        emit ActionPaused("Transfer", state);

        return state;
    }

    /**
     * @notice Admin function to change the seize status for markets
     * @param state The flag of the transfer status
     * @return uint 0=success, otherwise a failure. (See enum Error for details)
     */
    function _setSeizePaused(bool state) public returns (bool) {
        require(msg.sender == pauseGuardian || msg.sender == getAdmin(), "only pause guardian and admin can pause");
        require(msg.sender == getAdmin() || state == true, "only admin can unpause");

        seizeGuardianPaused = state;

        emit ActionPaused("Seize", state);

        return state;
    }

    /**
     * @notice Admin function to change the user moderate data
     * @param userPauseDepositAmount_ The Pie amount for pause from user
     * @param guardianModerateTime_ The time for guardian check pool
     * @return uint 0=success, otherwise a failure. (See enum Error for details)
     */
    function _setUserModeratePoolData(uint userPauseDepositAmount_, uint guardianModerateTime_) public returns(uint) {
        require(msg.sender == getAdmin(), "only admin can change");

        uint oldUserPauseDepositAmount = userPauseDepositAmount;
        uint oldGuardianModerateTime = guardianModerateTime;

        userPauseDepositAmount = userPauseDepositAmount_;
        guardianModerateTime = guardianModerateTime_;

        emit NewUserModeratePoolData(oldUserPauseDepositAmount, userPauseDepositAmount_, oldGuardianModerateTime, guardianModerateTime_);

        return uint(Error.NO_ERROR);
    }

    function _become(address unitroller) public {
        require(msg.sender == Unitroller(payable(unitroller)).getAdmin(), "only unitroller admin can change brains");
        require(Unitroller(payable(unitroller))._acceptImplementation() == 0, "change not authorized");
    }

    /**
     * @notice Return all of the markets
     * @dev The automatic getter may be used to access an individual market.
     * @return The list of market addresses
     */
    function getAllMarkets() public view override returns (address[] memory) {
        return allMarkets;
    }

    /**
     * @notice Return the number of current block
     * @return The block number
     */
    function getBlockNumber() public view virtual returns (uint) {
        return block.number;
    }

    /**
     * @notice Return the address of the oracle
     * @return The interface (address) of oracle
     */
    function getOracle() public view override returns (PriceOracle) {
        return PriceOracle(registry.oracle());
    }

    /**
     * @notice Return the address of the admin
     * @return The address of admin
     */
    function getAdmin() public view virtual returns (address) {
        return registry.admin();
    }

    /**
     * @notice Return the fee factor of the pToken
     * @param pToken PToken address
     * @return The address of admin
     */
    function getFeeFactorMantissa(address pToken) public view override returns (uint) {
        return feeFactorMantissa[pToken];
    }

    /**
     * @notice Return the borrow delay for markets
     * @return The borrow delay
     */
    function getBorrowDelay() public view override returns (uint) {
        return borrowDelay;
    }
}