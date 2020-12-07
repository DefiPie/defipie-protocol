pragma solidity ^0.7.4;

import "./PriceOracle.sol";
import "./PErc20.sol";

contract SimplePriceOracle is PriceOracle {
    mapping(address => uint) prices;
    event PricePosted(address asset, uint previousPriceMantissa, uint requestedPriceMantissa, uint newPriceMantissa);

    function getUnderlyingPrice(address pToken) public view override returns (uint) {
        if (compareStrings(PErc20(pToken).symbol(), "pETH")) {
            return 1e18;
        } else {
            return prices[address(PErc20(pToken).underlying())];
        }
    }

    function setUnderlyingPrice(address pToken, uint underlyingPriceMantissa) public {
        address asset = address(PErc20(pToken).underlying());
        emit PricePosted(asset, prices[asset], underlyingPriceMantissa, underlyingPriceMantissa);
        prices[asset] = underlyingPriceMantissa;
    }

    function setDirectPrice(address asset, uint price) public {
        emit PricePosted(asset, prices[asset], price, price);
        prices[asset] = price;
    }

    // v1 price oracle interface for use as backing of proxy
    function assetPrices(address asset) external view returns (uint) {
        return prices[asset];
    }

    function compareStrings(string memory a, string memory b) internal pure returns (bool) {
        return (keccak256(abi.encodePacked((a))) == keccak256(abi.encodePacked((b))));
    }

    function updateUnderlyingPrice(address pToken) external override returns (uint) {
        pToken; //shh
        return 0;
    }
}