pragma solidity ^0.7.4;

contract MockPriceFeed {
    int public latestPrice = 400e8; // chainlink USD with 8 decimals of precision
    bool public pairExist = true;

    uint public reserve0 = 1265853603707383427790000;
    uint public reserve1 = 253170720741476685558;
    uint public blockTimestampLast = block.timestamp;
    uint public price0CumLast =       16605707706021539124070921915727672600000000;
    uint public price1CumLast = 39194436442927457763557598254579840882221574000000;

    address public token0;
    address public token1;

    constructor() {

    }

    function getPair(address, address) public view returns (address) {
        if (pairExist) {
            return address(this);
        } else {
            return address(0);
        }
    }

    function setPairExist(bool pairExist_) public {
        pairExist = pairExist_;
    }

    function getReserves() public view returns (uint, uint, uint) {
        return (reserve0, reserve1, blockTimestampLast);
    }

    function setBlockTimestampLast(uint32 blockTimestampLast_) public {
        blockTimestampLast = blockTimestampLast_;
    }

    function price0CumulativeLast() public view returns (uint) {
        return price0CumLast;
    }

    function price1CumulativeLast() public view returns (uint) {
        return price1CumLast;
    }

    function setPricesCumulativeLast(uint price0_, uint price1_) public {
        price0CumLast = price0_;
        price1CumLast = price1_;
    }

    function setReserves(uint reserve0_, uint reserve1_) public {
        reserve0 = reserve0_;
        reserve1 = reserve1_;
    }

    function latestAnswer() public view returns (int256) {
        return latestPrice;
    }

    function setLatestAnswer(int256 latestAnswer_) public {
        latestPrice = latestAnswer_;
    }

    function setToken0Address(address token0_) public {
        token0 = token0_;
    }

    function setToken1Address(address token1_) public {
        token1 = token1_;
    }

}
