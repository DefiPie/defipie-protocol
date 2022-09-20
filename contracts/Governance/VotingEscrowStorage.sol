// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "../RegistryInterface.sol";
import "./Governor.sol";

contract VotingEscrowStorage {
    address public implementation;
    RegistryInterface public registry;
}

contract VotingEscrowStorageV1 is VotingEscrowStorage {
    struct Point {
        int128 bias;
        int128 slope; // - dweight / dt
        uint ts;
        uint blk; // block
    }

    struct LockedBalance {
        int128 amount;
        uint start;
        uint end;
    }

    int128 public constant DEPOSIT_FOR_TYPE = 0;
    int128 public constant CREATE_LOCK_TYPE = 1;
    int128 public constant INCREASE_LOCK_AMOUNT = 2;
    int128 public constant INCREASE_UNLOCK_TIME = 3;
    uint internal constant MULTIPLIER = 1e18;

    uint public interval;
    uint public minDuration;
    uint public maxDuration;
    address public token;
    string public name;
    string public symbol;
    uint8 public decimals;
    uint public supply;
    uint public minLockAmount;

    mapping(address => address[]) public delegateAt;
    mapping(address => LockedBalance) public locked;
    mapping(address => address) public delegateOf;

    uint public epoch;
    mapping(uint => Point) public pointHistory; // epoch -> unsigned point
    mapping(address => mapping(uint => Point)) public userPointHistory; // user -> Point[user_epoch]
    mapping(address => uint) public userPointEpoch;
    mapping(uint => int128) public slopeChanges; // time -> signed slope change

    Governor public governor;
    mapping(address => bool) public isWhiteListed;

    address public controller;
}