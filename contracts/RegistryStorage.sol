// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

contract RegistryStorage {
    address public implementation;
    address public admin;
    address public pendingAdmin;
}