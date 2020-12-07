pragma solidity ^0.7.4;

import "../../contracts/PriceOracle.sol";

contract FixedPriceOracle is PriceOracle {
    uint public price;

    constructor(uint _price) {
        price = _price;
    }

    function getUnderlyingPrice(address pToken) public view override returns (uint) {
        pToken;
        return price;
    }

    function assetPrices(address asset) public view returns (uint) {
        asset;
        return price;
    }

    function updateUnderlyingPrice(address pToken) external override returns (uint) {
        pToken; //shh
        return 0;
    }
}
