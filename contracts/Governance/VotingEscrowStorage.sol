// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "../RegistryInterface.sol";

contract VotingEscrowStorage {
    address public implementation;
    RegistryInterface public registry;
}

contract VotingEscrowStorageV1 is VotingEscrowStorage {

}