pragma solidity ^0.7.4;
pragma experimental ABIEncoderV2;

import "../../contracts/Governance/GovernorAlpha.sol";

contract GovernorAlphaHarness is GovernorAlpha {
    constructor(address timelock_, address pie_, address guardian_) GovernorAlpha(timelock_, pie_, guardian_) {}

    function votingPeriod() public pure override returns (uint) { return 240; }
}
