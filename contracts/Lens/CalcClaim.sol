pragma solidity ^0.7.4;
pragma experimental ABIEncoderV2;

import "../Exponential.sol";

interface PTokenInterface {
    function borrowIndex() external view returns (uint);
    function totalBorrows() external view returns (uint);
    function borrowBalanceStored(address account) external view returns (uint);
    function balanceOf(address owner) external view returns (uint);
    function totalSupply() external view returns (uint);
}

interface ControllerInterface {
    struct PieMarketState {
        uint224 index;
        uint32 block;
    }

    function pieInitialIndex() external view returns (uint);

    // mapping(address => uint) public pieSpeeds;
    function pieSpeeds(address market) external view returns (uint);

    // mapping(address => PieMarketState) public pieSupplyState;
    function pieSupplyState(address market) external view returns (PieMarketState memory);

    // mapping(address => PieMarketState) public pieBorrowState;
    function pieBorrowState(address market) external view returns (PieMarketState memory);

    // mapping(address => mapping(address => uint)) public pieSupplierIndex;
    function pieSupplierIndex(address market, address user) external view returns (uint);
    // mapping(address => mapping(address => uint)) public pieBorrowerIndex;
    function pieBorrowerIndex(address market, address user) external view returns (uint);

    // mapping(address => uint) public pieAccrued;
    function pieAccrued(address market) external view returns (uint);

    function getAllMarkets() external view returns (address[] memory);
    function getBlockNumber() external view returns (uint);
}

contract ClaimCalc is Exponential {
    ControllerInterface public controller;

    constructor(address _controller) {
        controller = ControllerInterface(_controller);
    }

    function allMarkets() public view returns (address[] memory) {
        return controller.getAllMarkets();
    }

    function getBlockNumber() public view returns (uint) {
        return controller.getBlockNumber() + 1;
    }

    function calcClaimPie(address holder) public view returns (uint) {
        return calcClaimPie(holder, controller.getAllMarkets());
    }

    function calcClaimPie(address holder, address[] memory pTokens) public view returns (uint) {
        address[] memory holders = new address[](1);
        holders[0] = holder;
        uint claimAmount = calcClaimPie(holders, pTokens);

        uint accrued = controller.pieAccrued(holder);
        return claimAmount + accrued;
    }

    function checkClaimPieMarkets(address holder) public view returns (address[] memory) {
        return checkClaimPieMarkets(holder, controller.getAllMarkets());
    }

    function checkClaimPieMarkets(address holder, address[] memory pTokens) public view returns (address[] memory) {
        address[] memory holders = new address[](1);
        holders[0] = holder;

        return checkClaimPieMarkets(holders, pTokens);
    }

    function updatePieBorrowIndex(address pToken, Exp memory marketBorrowIndex) public view returns (Double memory) {
        ControllerInterface.PieMarketState memory borrowState = controller.pieBorrowState(pToken);

        Double memory newBorrowindex = Double({mantissa: borrowState.index});

        uint borrowSpeed = controller.pieSpeeds(pToken);
        uint blockNumber = getBlockNumber();
        uint deltaBlocks = sub_(blockNumber, uint(borrowState.block));
        if (deltaBlocks > 0 && borrowSpeed > 0) {
            uint borrowAmount = div_(PTokenInterface(pToken).totalBorrows(), marketBorrowIndex);
            uint pieAccrued = mul_(deltaBlocks, borrowSpeed);
            Double memory ratio = borrowAmount > 0 ? fraction(pieAccrued, borrowAmount) : Double({mantissa: 0});
            newBorrowindex = add_(Double({mantissa: borrowState.index}), ratio);
        }

        return newBorrowindex;
    }

    function updatePieSupplyIndex(address pToken)  public view returns (Double memory) {
        ControllerInterface.PieMarketState memory supplyState = controller.pieSupplyState(pToken);

        Double memory newSupplyIndex = Double({mantissa: supplyState.index});

        uint supplySpeed = controller.pieSpeeds(pToken);
        uint blockNumber = getBlockNumber();
        uint deltaBlocks = sub_(blockNumber, uint(supplyState.block));
        if (deltaBlocks > 0 && supplySpeed > 0) {
            uint supplyTokens = PTokenInterface(pToken).totalSupply();
            uint pieAccrued = mul_(deltaBlocks, supplySpeed);
            Double memory ratio = supplyTokens > 0 ? fraction(pieAccrued, supplyTokens) : Double({mantissa: 0});
            newSupplyIndex = add_(Double({mantissa: supplyState.index}), ratio);
        }

        return newSupplyIndex;
    }

    function calcClaimPie(address[] memory holders, address[] memory pTokens) public view returns (uint) {
        uint accrued;

        for (uint i = 0; i < pTokens.length; i++) {
            address pToken = pTokens[i];

            Exp memory marketBorrowIndex = Exp({mantissa: PTokenInterface(pToken).borrowIndex()});
            Double memory borrowIndex = updatePieBorrowIndex(pToken, marketBorrowIndex);

            for (uint j = 0; j < holders.length; j++) {
                Double memory borrowerIndex = Double({mantissa: controller.pieBorrowerIndex(pToken, holders[j])});

                if (borrowerIndex.mantissa > 0) {
                    Double memory deltaIndex = sub_(borrowIndex, borrowerIndex);
                    uint borrowerAmount = div_(PTokenInterface(pToken).borrowBalanceStored(holders[j]), marketBorrowIndex);
                    uint borrowerDelta = mul_(borrowerAmount, deltaIndex);
                    accrued = add_(accrued, borrowerDelta);
                }
            }

            Double memory supplyIndex = updatePieSupplyIndex(pToken);

            for (uint j = 0; j < holders.length; j++) {
                Double memory supplierIndex = Double({mantissa:  controller.pieSupplierIndex(pToken, holders[j])});

                if (supplierIndex.mantissa == 0 && supplyIndex.mantissa > 0) {
                    supplierIndex.mantissa =  controller.pieInitialIndex();
                }

                Double memory deltaIndex = sub_(supplyIndex, supplierIndex);
                uint supplierTokens = PTokenInterface(pToken).balanceOf(holders[j]);
                uint supplierDelta = mul_(supplierTokens, deltaIndex);
                accrued = add_(accrued, supplierDelta);
            }
        }

        return accrued;
    }

    function checkClaimPieMarkets(address[] memory holders, address[] memory pTokens) public view returns (address[] memory) {
        address[] memory markets = new address[](pTokens.length);
        uint count;

        for (uint i = 0; i < pTokens.length; i++) {
            uint delta;

            Exp memory marketBorrowIndex = Exp({mantissa: PTokenInterface(pTokens[i]).borrowIndex()});
            Double memory index = updatePieBorrowIndex(pTokens[i], marketBorrowIndex);

            for (uint j = 0; j < holders.length; j++) {
                Double memory borrowerIndex = Double({mantissa: controller.pieBorrowerIndex(pTokens[i], holders[j])});

                if (borrowerIndex.mantissa > 0) {
                    uint borrowerAmount = div_(PTokenInterface(pTokens[i]).borrowBalanceStored(holders[j]), marketBorrowIndex);
                    delta = mul_(borrowerAmount, sub_(index, borrowerIndex));
                }
            }

            index = updatePieSupplyIndex(pTokens[i]);

            for (uint j = 0; j < holders.length; j++) {
                Double memory supplierIndex = Double({mantissa:  controller.pieSupplierIndex(pTokens[i], holders[j])});

                if (supplierIndex.mantissa == 0 && index.mantissa > 0) {
                    supplierIndex.mantissa =  controller.pieInitialIndex();
                }

                uint supplierTokens = PTokenInterface(pTokens[i]).balanceOf(holders[j]);
                delta = delta + mul_(supplierTokens, sub_(index, supplierIndex));
            }

            if (delta > 0) {
                markets[count] = pTokens[i];
                count++;
            }
        }

        address[] memory claimPieMarkets = new address[](count);

        for(uint i = 0; i < count; i++) {
            claimPieMarkets[i] = markets[i];
        }

        return claimPieMarkets;
    }
}