// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "../../contracts/Governance/VotingEscrow.sol";

contract VotingEscrowHarness is VotingEscrow {

    constructor(
        RegistryInterface _registry,
        address _token,
        string memory _name,
        string memory _symbol,
        uint _interval,
        uint _minDuration,
        uint _maxDuration,
        uint _minLockAmount,
        address _governor
    ) {
        initialize(
            _registry,
            _token,
            _name,
            _symbol,
            _interval,
            _minDuration,
            _maxDuration,
            _minLockAmount,
            _governor
        );
    }

}
