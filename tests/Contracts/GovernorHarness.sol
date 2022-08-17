// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "../../contracts/Governance/Governor.sol";

contract GovernorHarness is Governor {
    constructor(address timelock_, address pie_, address guardian_, uint period_) Governor(timelock_, pie_, guardian_, period_) {}

    function votingPeriod() public pure override returns (uint) { return 240; }
}
