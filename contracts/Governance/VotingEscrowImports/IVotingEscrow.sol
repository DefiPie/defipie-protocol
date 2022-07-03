// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

interface IVotingEscrow {
    event Deposit(
        address indexed provider,
        uint value,
        uint indexed unlockTime,
        int128 indexed depositType,
        uint ts
    );

    event Withdraw(address indexed provider, uint value, uint ts);

    event Supply(uint prevSupply, uint supply);

    event NewMinLockAmount(uint oldMinLockAmount, uint newMinLockAmount);

    event NewMinDuration(uint oldMinDuration, uint newMinDuration);

    event NewMaxDuration(uint oldMaxDuration, uint newMaxDuration);

    function delegateAt(address user, uint index) external view returns (address);
    function delegateOf(address user) external view returns (address);

    function locked(address user)
    external
    view
    returns (
        int128 amount,
        uint start,
        uint end
    );

    function epoch() external view returns (uint);

    function pointHistory(uint epoch)
    external
    view
    returns (
        int128 bias,
        int128 slope,
        uint ts,
        uint blk
    );

    function userPointHistory(address account, uint epoch)
    external
    view
    returns (
        int128 bias,
        int128 slope,
        uint ts,
        uint blk
    );

    function userPointEpoch(address account) external view returns (uint);

    function slopeChanges(uint epoch) external view returns (int128);

    function delegateLength(address user) external view returns (uint);

    function getLastUserSlope(address user) external view returns (int128);

    function getCheckpointTime(address user, uint id) external view returns (uint);

    function getUnlockTime(address user) external view returns (uint);
    function getStartTime(address user) external view returns (uint);
    function getAmount(address user) external view returns (int128);
        
    function checkpoint() external;

    function depositFor(address user, uint value) external;

    function createLockFor(
        address user,
        uint value,
        uint duration
    ) external;

    function createLock(uint _value, uint _duration) external;

    function increaseAmountFor(
        address user,
        uint value
    ) external;

    function increaseAmount(uint value) external;

    function increaseUnlockTime(uint duration) external;

    function withdraw() external;

    function balanceOf(address user) external view returns (uint);

    function balanceOf(address user, uint t) external view returns (uint);

    function balanceOfAt(address user, uint block) external view returns (uint);

    function totalSupply() external view returns (uint);

    function totalSupply(uint t) external view returns (uint);

    function totalSupplyAt(uint block) external view returns (uint);
}