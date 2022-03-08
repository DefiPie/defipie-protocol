// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

contract MockUniswapV3Pool {
    address public token0;
    address public token1;
    uint24 public fee;

    mapping(uint32 => int56) public tickCumulatives;
    mapping(uint32 => uint160) public secondsPerLiquidityCumulativeX128s;

    uint160 public sqrtPriceX96;
    int24 public tick;
    uint16 public observationIndex;
    uint16 public observationCardinality;
    uint16 public observationCardinalityNext;
    uint8 public feeProtocol;
    bool public unlocked;

    int24 public tickSpacing;
    uint160 public liquidity;

    constructor(address token0_, address token1_, uint24 fee_) {
        token0 = token0_;
        token1 = token1_;
        fee = fee_;

        sqrtPriceX96 = 1850565200137126965133439857;
        tick = -75141;
        observationIndex = 18;
        observationCardinality = 80;
        observationCardinalityNext = 80;
        feeProtocol = 0;
        unlocked = true;

        tickSpacing = 60;
        liquidity = 892113542588111978562302;
    }

    function slot0() public view returns (
        uint160,
        int24,
        uint16,
        uint16,
        uint16,
        uint8,
        bool
    ) {
        return (
            sqrtPriceX96,
            tick,
            observationIndex,
            observationCardinality,
            observationCardinalityNext,
            feeProtocol,
            unlocked
        );
    }

    function setSlot0(
        uint160 sqrtPriceX96_,
        int24 tick_,
        uint16 observationIndex_,
        uint16 observationCardinality_,
        uint16 observationCardinalityNext_,
        uint8 feeProtocol_,
        bool unlocked_
    ) public returns (bool) {
        sqrtPriceX96 = sqrtPriceX96_;
        tick = tick_;
        observationIndex = observationIndex_;
        observationCardinality = observationCardinality_;
        observationCardinalityNext = observationCardinalityNext_;
        feeProtocol = feeProtocol_;
        unlocked = unlocked_;

        return true;
    }

    function setTickSpacing(int24 tickSpacing_) public returns (bool) {
        tickSpacing = tickSpacing_;

        return true;
    }

    function setLiquidity(uint160 liquidity_) public returns (bool) {
        liquidity = liquidity_;

        return true;
    }

    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory, uint160[] memory)
    {
        int56[] memory retTickCumulatives = new int56[](secondsAgos.length);
        uint160[] memory retSecondsPerLiquidityCumulativeX128s = new uint160[](secondsAgos.length);

        for(uint i = 0; i < secondsAgos.length; i++) {
            retTickCumulatives[i] = tickCumulatives[secondsAgos[i]];
            retSecondsPerLiquidityCumulativeX128s[i] = secondsPerLiquidityCumulativeX128s[secondsAgos[i]];
        }

        // returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s)
        return (retTickCumulatives, retSecondsPerLiquidityCumulativeX128s);
    }

    function setTokens(address token0_, address token1_) public returns(bool) {
        token0 = token0_;
        token1 = token1_;

        return true;
    }

    function setObserves(uint32[] calldata secondsAgos_, int56[] calldata tickCumulatives_, uint160[] calldata secondsPerLiquidityCumulativeX128s_) public returns(bool) {
        require(secondsAgos_.length == secondsPerLiquidityCumulativeX128s_.length);
        require(secondsAgos_.length == tickCumulatives_.length);

        for(uint i = 0; i < secondsAgos_.length; i++) {
            tickCumulatives[secondsAgos_[i]] = tickCumulatives_[i];
            secondsPerLiquidityCumulativeX128s[secondsAgos_[i]] = secondsPerLiquidityCumulativeX128s_[i];
        }

        return true;
    }

    function setFee(uint24 fee_) public returns(bool) {
        fee = fee_;

        return true;
    }
}
    // eth ~ $2800
    // SECONDS AGO
    // [10800,7200,3600,600,0]



    // usdc usdt
    // https://etherscan.io/address/0x3416cf6c708da44db2624d63ea0aaef7113527c6
    // fee 100
    //tickCumulatives   int56[] :  -24633124,-24646242,-24659846,-24671846,-24674246
    //secondsPerLiquidityCumulativeX128s   uint160[] :  28912059930771248280737027294,28914872576393499648064410851,28917676302288209908829365904,28920000551571856913778294685,28920465401428586314768080441

    // usdc busd
    // https://etherscan.io/address/0x5e35c4eba72470ee1177dcb14dddf4d9e6d915f4#code
    // fee 100
    //tickCumulatives   int56[] :  -1222142377231,-1223137147231,-1224131917231,-1224960892231,-1225126687231
    //secondsPerLiquidityCumulativeX128s   uint160[] :  414153182540202932414165,414441118856218580168989,414729055172234227923813,414969002102247267719499,415016991488249875678637

    // usdc busd 2
    // https://etherscan.io/address/0x00cef0386ed94d738c8f8a74e8bfd0376926d24c
    // fee 500
    //tickCumulatives   int56[] :  -6100386511100,-6101381291900,-6102376072700,-6103205056700,-6103370853500
    //secondsPerLiquidityCumulativeX128s   uint160[] :  17167015404909110673568989,17167024997409955411974414,17167034589910800150379839,17167042583661504099051027,17167044182411644888785264

    // dai usdc
    // https://etherscan.io/address/0x5777d92f208679db4b9778590fa3cab3ac9e2168
    // fee 100
    //tickCumulatives   int56[] :  -1987030585607,-1988025352007,-1989020118407,-1989849090407,-1990014884807
    //secondsPerLiquidityCumulativeX128s   uint160[] :  945950324796684973565600,945951154145688171999210,945951983494691370432820,945952674618860702460828,945952812843694568866430

    // dai usdc 2
    // https://etherscan.io/address/0x6c6bc977e13df9b0de53b251522280bb72383700
    // fee 500
    //tickCumulatives   int56[] :  -6577591604293,-6578586374293,-6579581144293,-6580410119293,-6580575914293
    //secondsPerLiquidityCumulativeX128s   uint160[] :  62481634642019832329557357,62481650197385550534598527,62481665752751268739639697,62481678715556033910507338,62481681308116986944680867

    // dai usdt
    // https://etherscan.io/address/0x6f48eca74b38d2936b02ab603ff4e36a6c0e3a77
    // fee 500
    //tickCumulatives   int56[] :  -6576663196473,-6577657977273,-6578652758073,-6579481742073,-6579647538873
    //secondsPerLiquidityCumulativeX128s   uint160[] :  30081637163723944438816629,30081720421396637548403868,30081803679069330657991107,30081873060463241582647139,30081886936742023767578346

