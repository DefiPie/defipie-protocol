pragma solidity ^0.7.4;

import "./PErc20.sol";
import "./PToken.sol";
import "./PriceOracle.sol";

interface V1PriceOracleInterface {
    function assetPrices(address asset) external view returns (uint);
}

contract PriceOracleProxy is PriceOracle {
    /// @notice The v1 price oracle, which will continue to serve prices for v1 assets
    V1PriceOracleInterface public v1PriceOracle;

    /// @notice Address of the guardian, which may set the SAI price once
    address public guardian;

    /// @notice Address of the pEther contract, which has a constant price
    address public pETHAddress;

    /// @notice Address of the pUSDC contract, which we hand pick a key for
    address public pUsdcAddress;

    /// @notice Address of the pUSDT contract, which uses the pUSDC price
    address public pUsdtAddress;

    /// @notice Address of the pSAI contract, which may have its price set
    address public pSaiAddress;

    /// @notice Address of the pDAI contract, which we hand pick a key for
    address public pDaiAddress;

    /// @notice Handpicked key for USDC
    address public constant usdcOracleKey = address(1);

    /// @notice Handpicked key for DAI
    address public constant daiOracleKey = address(2);

    /// @notice Frozen SAI price (or 0 if not set yet)
    uint public saiPrice;

    /**
     * @param guardian_ The address of the guardian, which may set the SAI price once
     * @param v1PriceOracle_ The address of the v1 price oracle, which will continue to operate and hold prices for collateral assets
     * @param pETHAddress_ The address of pETH, which will return a constant 1e18, since all prices relative to ether
     * @param pUsdcAddress_ The address of pUSDC, which will be read from a special oracle key
     * @param pSaiAddress_ The address of pSAI, which may be read directly from storage
     * @param pDaiAddress_ The address of pDAI, which will be read from a special oracle key
     * @param pUsdtAddress_ The address of pUSDT, which uses the pUSDC price
     */
    constructor(address guardian_,
        address v1PriceOracle_,
        address pETHAddress_,
        address pUsdcAddress_,
        address pSaiAddress_,
        address pDaiAddress_,
        address pUsdtAddress_
    ) {
        guardian = guardian_;
        v1PriceOracle = V1PriceOracleInterface(v1PriceOracle_);

        pETHAddress = pETHAddress_;
        pUsdcAddress = pUsdcAddress_;
        pSaiAddress = pSaiAddress_;
        pDaiAddress = pDaiAddress_;
        pUsdtAddress = pUsdtAddress_;
    }

    /**
     * @notice Get the underlying price of a listed pToken asset
     * @param pToken The pToken to get the underlying price of
     * @return The underlying asset price mantissa (scaled by 1e18)
     */
    function getUnderlyingPrice(PToken pToken) public view override returns (uint) {
        address pTokenAddress = address(pToken);

        if (pTokenAddress == pETHAddress) {
            // ether always worth 1
            return 1e18;
        }

        if (pTokenAddress == pUsdcAddress || pTokenAddress == pUsdtAddress) {
            return v1PriceOracle.assetPrices(usdcOracleKey);
        }

        if (pTokenAddress == pDaiAddress) {
            return v1PriceOracle.assetPrices(daiOracleKey);
        }

        if (pTokenAddress == pSaiAddress) {
            // use the frozen SAI price if set, otherwise use the DAI price
            return saiPrice > 0 ? saiPrice : v1PriceOracle.assetPrices(daiOracleKey);
        }

        // otherwise just read from v1 oracle
        address underlying = PErc20(pTokenAddress).underlying();
        return v1PriceOracle.assetPrices(underlying);
    }

    /**
     * @notice Set the price of SAI, permanently
     * @param price The price for SAI
     */
    function setSaiPrice(uint price) public {
        require(msg.sender == guardian, "only guardian may set the SAI price");
        require(saiPrice == 0, "SAI price may only be set once");
        require(price < 0.1e18, "SAI price must be < 0.1 ETH");
        saiPrice = price;
    }

    function updateUnderlyingPrice(PToken pToken) external override returns (uint) {
        pToken; //shh
        return 0;
    }
}
