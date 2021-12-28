// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "../../contracts/Governance/Pie.sol";

contract PieScenario is Pie {
    constructor(address account) Pie(account) {}

    function transferScenario(address[] calldata destinations, uint256 amount) external returns (bool) {
        for (uint i = 0; i < destinations.length; i++) {
            address dst = destinations[i];
            _transferTokens(msg.sender, dst, uint96(amount));
        }
        return true;
    }

    function transferFromScenario(address[] calldata froms, uint256 amount) external returns (bool) {
        for (uint i = 0; i < froms.length; i++) {
            address from = froms[i];
            _transferTokens(from, msg.sender, uint96(amount));
        }
        return true;
    }
}
