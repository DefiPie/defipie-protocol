// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "contracts/Tokens/EIP20Interface.sol";

interface IVotingEscrow {
    function createLock(uint _value, uint _duration) external;

    function depositFor(address _user, uint _amount) external;

    function createLockFor(address user, uint value, uint duration) external;
}

contract LockCreatorHarness {
    constructor() {}

    function approve(address underlyingContract, address spender, uint256 amount) public {
        EIP20Interface(underlyingContract).approve(spender, amount);
    }

    function create_lock(address votingContract) public {
        IVotingEscrow(votingContract).createLock(100, 100);
    }

    function create_lock_for(address user, address votingContract, address pToken) public {
        EIP20Interface(pToken).approve(votingContract, 10000000000000000000000);
        IVotingEscrow(votingContract).createLockFor(user, 10000000000000000000000, 125798400);
    }

    function deposit_for(address votingContract, address user, uint amount) public {
        IVotingEscrow(votingContract).depositFor(user, amount);
    }
}