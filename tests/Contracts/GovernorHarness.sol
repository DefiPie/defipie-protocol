pragma solidity ^0.7.6;
pragma abicoder v2;

import "../../contracts/Governance/Governor.sol";

contract GovernorHarness is Governor {
    constructor(address timelock_, address pie_, address guardian_) Governor(timelock_, pie_, guardian_) {}

    function votingPeriod() public pure override returns (uint) { return 240; }
}
