// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

/**
 * @title PriceOracle's Interface
 */
interface IPriceOracle {

    /// @notice Possible underlying types of an asset
    enum UnderlyingType {
        BadUnderlying,
        RegularAsset,
        UniswapV2LP
    }

    /**
     * @notice Get the underlying price of a pToken asset
     * @param pToken The pToken to get the underlying price of
     * @return The underlying asset price mantissa (scaled by 1e18).
     *  Zero means the price is unavailable.
     */
    function getUnderlyingPrice(address pToken) external view returns (uint);

    function updateUnderlyingPrice(address pToken) external returns (uint);
}
