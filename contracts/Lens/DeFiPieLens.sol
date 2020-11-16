// SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;
pragma experimental ABIEncoderV2;

import "../PErc20.sol";
import "../PToken.sol";
import "../PriceOracle.sol";
import "../EIP20Interface.sol";
import "../Governance/GovernorAlpha.sol";
import "../Governance/Pie.sol";
import "../PPIE.sol";

interface ControllerLensInterface {
    function markets(address) external view returns (bool, uint);
    function oracle() external view returns (PriceOracle);
    function getAccountLiquidity(address) external view returns (uint, uint, uint);
    function getAssetsIn(address) external view returns (PToken[] memory);
    function claimPie(address) external;
    function pieAccrued(address) external view returns (uint);
    function getAllMarkets() external view returns (PToken[] memory);
}

contract DeFiPieLens {
    struct PTokenMetadata {
        address pToken;
        uint exchangeRateCurrent;
        uint supplyRatePerBlock;
        uint borrowRatePerBlock;
        uint reserveFactorMantissa;
        uint totalBorrows;
        uint totalReserves;
        uint totalSupply;
        uint totalCash;
        bool isListed;
        uint collateralFactorMantissa;
        address underlyingAssetAddress;
        uint pTokenDecimals;
        uint underlyingDecimals;
    }

    function pTokenMetadata(PToken pToken) public returns (PTokenMetadata memory) {
        uint exchangeRateCurrent = pToken.exchangeRateCurrent();
        ControllerLensInterface controller = ControllerLensInterface(address(pToken.controller()));
        (bool isListed, uint collateralFactorMantissa) = controller.markets(address(pToken));
        address underlyingAssetAddress;
        uint underlyingDecimals;

        if (compareStrings(pToken.symbol(), "pETH")) {
            underlyingAssetAddress = address(0);
            underlyingDecimals = 18;
        } else {
            PErc20 pErc20 = PErc20(address(pToken));
            underlyingAssetAddress = pErc20.underlying();
            underlyingDecimals = EIP20Interface(pErc20.underlying()).decimals();
        }

        return PTokenMetadata({
            pToken: address(pToken),
            exchangeRateCurrent: exchangeRateCurrent,
            supplyRatePerBlock: pToken.supplyRatePerBlock(),
            borrowRatePerBlock: pToken.borrowRatePerBlock(),
            reserveFactorMantissa: pToken.reserveFactorMantissa(),
            totalBorrows: pToken.totalBorrows(),
            totalReserves: pToken.totalReserves(),
            totalSupply: pToken.totalSupply(),
            totalCash: pToken.getCash(),
            isListed: isListed,
            collateralFactorMantissa: collateralFactorMantissa,
            underlyingAssetAddress: underlyingAssetAddress,
            pTokenDecimals: pToken.decimals(),
            underlyingDecimals: underlyingDecimals
        });
    }

    function pTokenMetadataAll(PToken[] calldata pTokens) external returns (PTokenMetadata[] memory) {
        uint pTokenCount = pTokens.length;
        PTokenMetadata[] memory res = new PTokenMetadata[](pTokenCount);
        for (uint i = 0; i < pTokenCount; i++) {
            res[i] = pTokenMetadata(pTokens[i]);
        }
        return res;
    }

    struct PTokenBalances {
        address pToken;
        uint balanceOf;
        uint borrowBalanceCurrent;
        uint balanceOfUnderlying;
        uint tokenBalance;
        uint tokenAllowance;
    }

    function pTokenBalances(PToken pToken, address payable account) public returns (PTokenBalances memory) {
        uint balanceOf = pToken.balanceOf(account);
        uint borrowBalanceCurrent = pToken.borrowBalanceCurrent(account);
        uint balanceOfUnderlying = pToken.balanceOfUnderlying(account);
        uint tokenBalance;
        uint tokenAllowance;

        if (compareStrings(pToken.symbol(), "pETH")) {
            tokenBalance = account.balance;
            tokenAllowance = account.balance;
        } else {
            PErc20 pErc20 = PErc20(address(pToken));
            EIP20Interface underlying = EIP20Interface(pErc20.underlying());
            tokenBalance = underlying.balanceOf(account);
            tokenAllowance = underlying.allowance(account, address(pToken));
        }

        return PTokenBalances({
            pToken: address(pToken),
            balanceOf: balanceOf,
            borrowBalanceCurrent: borrowBalanceCurrent,
            balanceOfUnderlying: balanceOfUnderlying,
            tokenBalance: tokenBalance,
            tokenAllowance: tokenAllowance
        });
    }

    function pTokenBalancesAll(PToken[] calldata pTokens, address payable account) external returns (PTokenBalances[] memory) {
        uint pTokenCount = pTokens.length;
        PTokenBalances[] memory res = new PTokenBalances[](pTokenCount);
        for (uint i = 0; i < pTokenCount; i++) {
            res[i] = pTokenBalances(pTokens[i], account);
        }
        return res;
    }

    function pTokenBalancesAllMarkets(address controller, address payable account) external returns (PTokenBalances[] memory) {
        PToken[] memory pTokens = ControllerLensInterface(controller).getAllMarkets();
        PTokenBalances[] memory res = new PTokenBalances[](pTokens.length);
        for (uint i = 0; i < pTokens.length; i++) {
            res[i] = pTokenBalances(pTokens[i], account);
        }
        return res;
    }

    struct PTokenUnderlyingPrice {
        address pToken;
        uint underlyingPrice;
    }

    function pTokenUnderlyingPrice(PToken pToken) public view returns (PTokenUnderlyingPrice memory) {
        ControllerLensInterface controller = ControllerLensInterface(address(pToken.controller()));
        PriceOracle priceOracle = controller.oracle();

        return PTokenUnderlyingPrice({
            pToken: address(pToken),
            underlyingPrice: priceOracle.getUnderlyingPrice(pToken)
        });
    }

    function pTokenUnderlyingPriceAll(PToken[] calldata pTokens) external view returns (PTokenUnderlyingPrice[] memory) {
        uint pTokenCount = pTokens.length;
        PTokenUnderlyingPrice[] memory res = new PTokenUnderlyingPrice[](pTokenCount);
        for (uint i = 0; i < pTokenCount; i++) {
            res[i] = pTokenUnderlyingPrice(pTokens[i]);
        }
        return res;
    }

    struct AccountLimits {
        PToken[] markets;
        uint liquidity;
        uint shortfall;
    }

    function getAccountLimits(ControllerLensInterface controller, address account) public view returns (AccountLimits memory) {
        (uint errorCode, uint liquidity, uint shortfall) = controller.getAccountLiquidity(account);
        require(errorCode == 0);

        return AccountLimits({
            markets: controller.getAssetsIn(account),
            liquidity: liquidity,
            shortfall: shortfall
        });
    }

    struct GovReceipt {
        uint proposalId;
        bool hasVoted;
        bool support;
        uint96 votes;
    }

    function getGovReceipts(GovernorAlpha governor, address voter, uint[] memory proposalIds) public view returns (GovReceipt[] memory) {
        uint proposalCount = proposalIds.length;
        GovReceipt[] memory res = new GovReceipt[](proposalCount);
        for (uint i = 0; i < proposalCount; i++) {
            GovernorAlpha.Receipt memory receipt = governor.getReceipt(proposalIds[i], voter);
            res[i] = GovReceipt({
                proposalId: proposalIds[i],
                hasVoted: receipt.hasVoted,
                support: receipt.support,
                votes: receipt.votes
            });
        }
        return res;
    }

    struct GovProposal {
        uint proposalId;
        address proposer;
        uint eta;
        address[] targets;
        uint[] values;
        string[] signatures;
        bytes[] calldatas;
        uint startBlock;
        uint endBlock;
        uint forVotes;
        uint againstVotes;
        bool canceled;
        bool executed;
    }

    function setProposal(GovProposal memory res, GovernorAlpha governor, uint proposalId) internal view {
        (
            ,
            address proposer,
            uint eta,
            uint startBlock,
            uint endBlock,
            uint forVotes,
            uint againstVotes,
            bool canceled,
            bool executed
        ) = governor.proposals(proposalId);
        res.proposalId = proposalId;
        res.proposer = proposer;
        res.eta = eta;
        res.startBlock = startBlock;
        res.endBlock = endBlock;
        res.forVotes = forVotes;
        res.againstVotes = againstVotes;
        res.canceled = canceled;
        res.executed = executed;
    }

    function getGovProposals(GovernorAlpha governor, uint[] calldata proposalIds) external view returns (GovProposal[] memory) {
        GovProposal[] memory res = new GovProposal[](proposalIds.length);
        for (uint i = 0; i < proposalIds.length; i++) {
            (
                address[] memory targets,
                uint[] memory values,
                string[] memory signatures,
                bytes[] memory calldatas
            ) = governor.getActions(proposalIds[i]);
            res[i] = GovProposal({
                proposalId: 0,
                proposer: address(0),
                eta: 0,
                targets: targets,
                values: values,
                signatures: signatures,
                calldatas: calldatas,
                startBlock: 0,
                endBlock: 0,
                forVotes: 0,
                againstVotes: 0,
                canceled: false,
                executed: false
            });
            setProposal(res[i], governor, proposalIds[i]);
        }
        return res;
    }

    struct PPieBalanceMetadata {
        uint balance;
        uint votes;
        address delegate;
    }

    function getPPieBalanceMetadata(PPIE pPIE, address account) external view returns (PPieBalanceMetadata memory) {
        return PPieBalanceMetadata({
            balance: pPIE.balanceOf(account),
            votes: uint256(pPIE.getCurrentVotes(account)),
            delegate: pPIE.delegates(account)
        });
    }

    struct PPieBalanceMetadataExt {
        uint balance;
        uint votes;
        address delegate;
        uint allocated;
    }

    function getPPieBalanceMetadataExt(PPIE pPIE, ControllerLensInterface controller, address account) external returns (PPieBalanceMetadataExt memory) {
        uint balance = pPIE.balanceOf(account);
        controller.claimPie(account);
        uint newBalance = pPIE.balanceOf(account);
        uint accrued = controller.pieAccrued(account);
        uint total = add(accrued, newBalance, "sum pPIE total");
        uint allocated = sub(total, balance, "sub allocated");

        return PPieBalanceMetadataExt({
            balance: balance,
            votes: uint256(pPIE.getCurrentVotes(account)),
            delegate: pPIE.delegates(account),
            allocated: allocated
        });
    }

    struct PPieVotes {
        uint blockNumber;
        uint votes;
    }

    function getPPieVotes(PPIE pPIE, address account, uint32[] calldata blockNumbers) external view returns (PPieVotes[] memory) {
        PPieVotes[] memory res = new PPieVotes[](blockNumbers.length);
        for (uint i = 0; i < blockNumbers.length; i++) {
            res[i] = PPieVotes({
                blockNumber: uint256(blockNumbers[i]),
                votes: uint256(pPIE.getPriorVotes(account, blockNumbers[i]))
            });
        }
        return res;
    }

    function compareStrings(string memory a, string memory b) internal pure returns (bool) {
        return (keccak256(abi.encodePacked((a))) == keccak256(abi.encodePacked((b))));
    }

    function add(uint a, uint b, string memory errorMessage) internal pure returns (uint) {
        uint c = a + b;
        require(c >= a, errorMessage);
        return c;
    }

    function sub(uint a, uint b, string memory errorMessage) internal pure returns (uint) {
        require(b <= a, errorMessage);
        uint c = a - b;
        return c;
    }
}
