// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import '../../contracts/ProxyProtocol/ProxyProtocol.sol';

contract ProxyProtocolHarness is ProxyProtocol {
    constructor(
        address factory_,
        address payable pETH_,
        address payable maximillion_,
        address admin_,
        address feeToken_,
        address feeRecipient_,
        uint feeAmountCreatePool_,
        uint feePercentMint_,
        uint feePercentRepayBorrow_
    ) ProxyProtocol(
        factory_,
        pETH_,
        maximillion_,
        admin_,
        feeToken_,
        feeRecipient_,
        feeAmountCreatePool_,
        feePercentMint_,
        feePercentRepayBorrow_
    ) {}

    fallback() external payable {

    }

    receive() external payable {

    }

}
