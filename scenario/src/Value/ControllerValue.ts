import {Event} from '../Event';
import {World} from '../World';
import {Controller} from '../Contract/Controller';
import {PToken} from '../Contract/PToken';
import {
  getAddressV,
  getCoreValue,
  getStringV,
  getNumberV
} from '../CoreValue';
import {
  AddressV,
  BoolV,
  ListV,
  NumberV,
  StringV,
  Value
} from '../Value';
import {Arg, Fetcher, getFetcherValue} from '../Command';
import {getController} from '../ContractLookup';
import {encodedNumber} from '../Encoding';
import {getPTokenV} from './PTokenValue';
import { encodeABI } from '../Utils';

export async function getControllerAddress(world: World, controller: Controller): Promise<AddressV> {
  return new AddressV(controller._address);
}

export async function getLiquidity(world: World, controller: Controller, user: string): Promise<NumberV> {
  let {0: error, 1: liquidity, 2: shortfall} = await controller.methods.getAccountLiquidity(user).call();
  if (Number(error) != 0) {
    throw new Error(`Failed to compute account liquidity: error code = ${error}`);
  }
  return new NumberV(Number(liquidity) - Number(shortfall));
}

export async function getHypotheticalLiquidity(world: World, controller: Controller, account: string, asset: string, redeemTokens: encodedNumber, borrowAmount: encodedNumber): Promise<NumberV> {
  let {0: error, 1: liquidity, 2: shortfall} = await controller.methods.getHypotheticalAccountLiquidity(account, asset, redeemTokens, borrowAmount).call();
  if (Number(error) != 0) {
    throw new Error(`Failed to compute account hypothetical liquidity: error code = ${error}`);
  }
  return new NumberV(Number(liquidity) - Number(shortfall));
}

async function getPriceOracle(world: World, controller: Controller): Promise<AddressV> {
    return new AddressV(await controller.methods.getOracle().call());
}

async function getRegistry(world: World, controller: Controller): Promise<AddressV> {
    return new AddressV(await controller.methods.registry().call());
}

async function getLiquidateGuardian(world: World, controller: Controller): Promise<AddressV> {
    return new AddressV(await controller.methods.liquidateGuardian().call());
}

async function getPieAddress(world: World, controller: Controller): Promise<AddressV> {
    return new AddressV(await controller.methods.getPieAddress().call());
}

async function getCloseFactor(world: World, controller: Controller): Promise<NumberV> {
  return new NumberV(await controller.methods.closeFactorMantissa().call(), 1e18);
}

async function getMaxAssets(world: World, controller: Controller): Promise<NumberV> {
  return new NumberV(await controller.methods.maxAssets().call());
}

async function getLiquidationIncentive(world: World, controller: Controller): Promise<NumberV> {
  return new NumberV(await controller.methods.liquidationIncentiveMantissa().call(), 1e18);
}

async function getImplementation(world: World, controller: Controller): Promise<AddressV> {
  return new AddressV(await controller.methods.controllerImplementation().call());
}

async function getBlockNumber(world: World, controller: Controller): Promise<NumberV> {
  return new NumberV(await controller.methods.getBlockNumber().call());
}

async function getFeeFactorMantissa(world: World, controller: Controller, pToken: PToken): Promise<NumberV> {
  return new NumberV(await controller.methods.getFeeFactorMantissa(pToken._address).call());
}

async function getAdmin(world: World, controller: Controller): Promise<AddressV> {
  return new AddressV(await controller.methods.getAdmin().call());
}

async function getCollateralFactor(world: World, controller: Controller, pToken: PToken): Promise<NumberV> {
  let {0: _isListed, 1: collateralFactorMantissa} = await controller.methods.markets(pToken._address).call();
  return new NumberV(collateralFactorMantissa, 1e18);
}

async function membershipLength(world: World, controller: Controller, user: string): Promise<NumberV> {
  return new NumberV(await controller.methods.membershipLength(user).call());
}

async function checkMembership(world: World, controller: Controller, user: string, pToken: PToken): Promise<BoolV> {
  return new BoolV(await controller.methods.checkMembership(user, pToken._address).call());
}

async function getAssetsIn(world: World, controller: Controller, user: string): Promise<ListV> {
  let assetsList = await controller.methods.getAssetsIn(user).call();

  return new ListV(assetsList.map((a) => new AddressV(a)));
}

async function getPieMarkets(world: World, controller: Controller): Promise<ListV> {
  let mkts = await controller.methods.getPieMarkets().call();

  return new ListV(mkts.map((a) => new AddressV(a)));
}

async function checkListed(world: World, controller: Controller, pToken: PToken): Promise<BoolV> {
  let {0: isListed, 1: _collateralFactorMantissa} = await controller.methods.markets(pToken._address).call();

  return new BoolV(isListed);
}

async function checkIsPied(world: World, controller: Controller, pToken: PToken): Promise<BoolV> {
  let {0: isListed, 1: _collateralFactorMantissa, 2: isPied} = await controller.methods.markets(pToken._address).call();
  return new BoolV(isPied);
}


export function controllerFetchers() {
  return [
    new Fetcher<{controller: Controller}, AddressV>(`
        #### Address

        * "Controller Address" - Returns address of controller
      `,
      "Address",
      [new Arg("controller", getController, {implicit: true})],
      (world, {controller}) => getControllerAddress(world, controller)
    ),
    new Fetcher<{controller: Controller, account: AddressV}, NumberV>(`
        #### Liquidity

        * "Controller Liquidity <User>" - Returns a given user's trued up liquidity
          * E.g. "Controller Liquidity Geoff"
      `,
      "Liquidity",
      [
        new Arg("controller", getController, {implicit: true}),
        new Arg("account", getAddressV)
      ],
      (world, {controller, account}) => getLiquidity(world, controller, account.val)
    ),
    new Fetcher<{controller: Controller, account: AddressV, action: StringV, amount: NumberV, pToken: PToken}, NumberV>(`
        #### Hypothetical

        * "Controller Hypothetical <User> <Action> <Asset> <Number>" - Returns a given user's trued up liquidity given a hypothetical change in asset with redeeming a certain number of tokens and/or borrowing a given amount.
          * E.g. "Controller Hypothetical Geoff Redeems 6.0 pZRX"
          * E.g. "Controller Hypothetical Geoff Borrows 5.0 pZRX"
      `,
      "Hypothetical",
      [
        new Arg("controller", getController, {implicit: true}),
        new Arg("account", getAddressV),
        new Arg("action", getStringV),
        new Arg("amount", getNumberV),
        new Arg("pToken", getPTokenV)
      ],
      async (world, {controller, account, action, pToken, amount}) => {
        let redeemTokens: NumberV;
        let borrowAmount: NumberV;

        switch (action.val.toLowerCase()) {
          case "borrows":
            redeemTokens = new NumberV(0);
            borrowAmount = amount;
            break;
          case "redeems":
            redeemTokens = amount;
            borrowAmount = new NumberV(0);
            break;
          default:
            throw new Error(`Unknown hypothetical: ${action.val}`);
        }

        return await getHypotheticalLiquidity(world, controller, account.val, pToken._address, redeemTokens.encode(), borrowAmount.encode());
      }
    ),
    new Fetcher<{controller: Controller}, AddressV>(`
        #### Admin

        * "Controller Admin" - Returns the Controllers's admin
          * E.g. "Controller Admin"
      `,
      "Admin",
      [new Arg("controller", getController, {implicit: true})],
      (world, {controller}) => getAdmin(world, controller)
    ),
      new Fetcher<{controller: Controller}, AddressV>(`
        #### LiquidateGuardian

        * "Controller LiquidateGuardian" - Returns the Controllers's liquidate guardian
          * E.g. "Controller LiquidateGuardian"
      `,
          "LiquidateGuardian",
          [new Arg("controller", getController, {implicit: true})],
          (world, {controller}) => getLiquidateGuardian(world, controller)
      ),
      new Fetcher<{controller: Controller}, AddressV>(`
        #### PieAddress

        * "Controller PieAddress" - Returns the Controllers's pie address
          * E.g. "Controller PieAddress"
      `,
          "PieAddress",
          [new Arg("controller", getController, {implicit: true})],
          (world, {controller}) => getPieAddress(world, controller)
      ),
    new Fetcher<{controller: Controller}, NumberV>(`
        #### CloseFactor

        * "Controller CloseFactor" - Returns the Controllers's close factor
          * E.g. "Controller CloseFactor"
      `,
      "CloseFactor",
      [new Arg("controller", getController, {implicit: true})],
      (world, {controller}) => getCloseFactor(world, controller)
    ),
    new Fetcher<{controller: Controller}, NumberV>(`
        #### MaxAssets

        * "Controller MaxAssets" - Returns the Controllers's max assets
          * E.g. "Controller MaxAssets"
      `,
      "MaxAssets",
      [new Arg("controller", getController, {implicit: true})],
      (world, {controller}) => getMaxAssets(world, controller)
    ),
    new Fetcher<{controller: Controller}, NumberV>(`
        #### LiquidationIncentive

        * "Controller LiquidationIncentive" - Returns the Controllers's liquidation incentive
          * E.g. "Controller LiquidationIncentive"
      `,
      "LiquidationIncentive",
      [new Arg("controller", getController, {implicit: true})],
      (world, {controller}) => getLiquidationIncentive(world, controller)
    ),
    new Fetcher<{controller: Controller}, AddressV>(`
        #### Implementation

        * "Controller Implementation" - Returns the Controllers's implementation
          * E.g. "Controller Implementation"
      `,
      "Implementation",
      [new Arg("controller", getController, {implicit: true})],
      (world, {controller}) => getImplementation(world, controller)
    ),
    new Fetcher<{controller: Controller}, NumberV>(`
        #### BlockNumber

        * "Controller BlockNumber" - Returns the Controllers's mocked block number (for scenario runner)
          * E.g. "Controller BlockNumber"
      `,
      "BlockNumber",
      [new Arg("controller", getController, {implicit: true})],
      (world, {controller}) => getBlockNumber(world, controller)
    ),
    new Fetcher<{controller: Controller, pToken: PToken}, NumberV>(`
      #### FeeFactorMantissa

        * "Controller FeeFactorMantissa <PToken>" - Returns the feeFactorMantissa associated with a given asset
        * E.g. "Controller FeeFactorMantissa pZRX"
      `,
      "FeeFactorMantissa",
      [
          new Arg("controller", getController, {implicit: true}),
          new Arg("pToken", getPTokenV)
      ],
      (world, {controller, pToken}) => getFeeFactorMantissa(world, controller, pToken)
    ),
    new Fetcher<{controller: Controller, pToken: PToken}, NumberV>(`
        #### CollateralFactor

        * "Controller CollateralFactor <PToken>" - Returns the collateralFactor associated with a given asset
          * E.g. "Controller CollateralFactor pZRX"
      `,
      "CollateralFactor",
      [
        new Arg("controller", getController, {implicit: true}),
        new Arg("pToken", getPTokenV)
      ],
      (world, {controller, pToken}) => getCollateralFactor(world, controller, pToken)
    ),
    new Fetcher<{controller: Controller, account: AddressV}, NumberV>(`
        #### MembershipLength

        * "Controller MembershipLength <User>" - Returns a given user's length of membership
          * E.g. "Controller MembershipLength Geoff"
      `,
      "MembershipLength",
      [
        new Arg("controller", getController, {implicit: true}),
        new Arg("account", getAddressV)
      ],
      (world, {controller, account}) => membershipLength(world, controller, account.val)
    ),
    new Fetcher<{controller: Controller, account: AddressV, pToken: PToken}, BoolV>(`
        #### CheckMembership

        * "Controller CheckMembership <User> <PToken>" - Returns one if user is in asset, zero otherwise.
          * E.g. "Controller CheckMembership Geoff pZRX"
      `,
      "CheckMembership",
      [
        new Arg("controller", getController, {implicit: true}),
        new Arg("account", getAddressV),
        new Arg("pToken", getPTokenV)
      ],
      (world, {controller, account, pToken}) => checkMembership(world, controller, account.val, pToken)
    ),
    new Fetcher<{controller: Controller, account: AddressV}, ListV>(`
        #### AssetsIn

        * "Controller AssetsIn <User>" - Returns the assets a user is in
          * E.g. "Controller AssetsIn Geoff"
      `,
      "AssetsIn",
      [
        new Arg("controller", getController, {implicit: true}),
        new Arg("account", getAddressV)
      ],
      (world, {controller, account}) => getAssetsIn(world, controller, account.val)
    ),
    new Fetcher<{controller: Controller, pToken: PToken}, BoolV>(`
        #### CheckListed

        * "Controller CheckListed <PToken>" - Returns true if market is listed, false otherwise.
          * E.g. "Controller CheckListed pZRX"
      `,
      "CheckListed",
      [
        new Arg("controller", getController, {implicit: true}),
        new Arg("pToken", getPTokenV)
      ],
      (world, {controller, pToken}) => checkListed(world, controller, pToken)
    ),
    new Fetcher<{controller: Controller, pToken: PToken}, BoolV>(`
        #### CheckIsPied

        * "Controller CheckIsPied <PToken>" - Returns true if market is listed, false otherwise.
          * E.g. "Controller CheckIsPied pZRX"
      `,
      "CheckIsPied",
      [
        new Arg("controller", getController, {implicit: true}),
        new Arg("pToken", getPTokenV)
      ],
      (world, {controller, pToken}) => checkIsPied(world, controller, pToken)
    ),
    new Fetcher<{controller: Controller}, AddressV>(`
        #### PauseGuardian

        * "PauseGuardian" - Returns the Controllers's PauseGuardian
        * E.g. "Controller PauseGuardian"
        `,
        "PauseGuardian",
        [
          new Arg("controller", getController, {implicit: true})
        ],
        async (world, {controller}) => new AddressV(await controller.methods.pauseGuardian().call())
    ),
      new Fetcher<{controller: Controller}, AddressV>(`
      #### Oracle

        * "Controller Oracle" - Returns the Controllers's Oracle
        * E.g. "Controller Oracle"
        `,
          "Oracle",
          [new Arg("controller", getController, {implicit: true})],
          (world, {controller}) => getPriceOracle(world, controller)
      ),
      new Fetcher<{controller: Controller}, AddressV>(`
      #### Registry

        * "Controller Registry" - Returns the Controllers's Oracle
        * E.g. "Controller Registry"
        `,
          "Registry",
          [new Arg("controller", getController, {implicit: true})],
          (world, {controller}) => getRegistry(world, controller)
      ),

    new Fetcher<{controller: Controller}, BoolV>(`
        #### _MintGuardianPaused

        * "_MintGuardianPaused" - Returns the Controllers's original global Mint paused status
        * E.g. "Controller _MintGuardianPaused"
        `,
        "_MintGuardianPaused",
        [new Arg("controller", getController, {implicit: true})],
        async (world, {controller}) => new BoolV(await controller.methods._mintGuardianPaused().call())
    ),
    new Fetcher<{controller: Controller}, BoolV>(`
        #### _BorrowGuardianPaused

        * "_BorrowGuardianPaused" - Returns the Controllers's original global Borrow paused status
        * E.g. "Controller _BorrowGuardianPaused"
        `,
        "_BorrowGuardianPaused",
        [new Arg("controller", getController, {implicit: true})],
        async (world, {controller}) => new BoolV(await controller.methods._borrowGuardianPaused().call())
    ),

    new Fetcher<{controller: Controller}, BoolV>(`
        #### TransferGuardianPaused

        * "TransferGuardianPaused" - Returns the Controllers's Transfer paused status
        * E.g. "Controller TransferGuardianPaused"
        `,
        "TransferGuardianPaused",
        [new Arg("controller", getController, {implicit: true})],
        async (world, {controller}) => new BoolV(await controller.methods.transferGuardianPaused().call())
    ),
    new Fetcher<{controller: Controller}, BoolV>(`
        #### SeizeGuardianPaused

        * "SeizeGuardianPaused" - Returns the Controllers's Seize paused status
        * E.g. "Controller SeizeGuardianPaused"
        `,
        "SeizeGuardianPaused",
        [new Arg("controller", getController, {implicit: true})],
        async (world, {controller}) => new BoolV(await controller.methods.seizeGuardianPaused().call())
    ),

    new Fetcher<{controller: Controller, pToken: PToken}, BoolV>(`
        #### MintGuardianMarketPaused

        * "MintGuardianMarketPaused" - Returns the Controllers's Mint paused status in market
        * E.g. "Controller MintGuardianMarketPaused cREP"
        `,
        "MintGuardianMarketPaused",
        [
          new Arg("controller", getController, {implicit: true}),
          new Arg("pToken", getPTokenV)
        ],
        async (world, {controller, pToken}) => new BoolV(await controller.methods.mintGuardianPaused(pToken._address).call())
    ),
    new Fetcher<{controller: Controller, pToken: PToken}, BoolV>(`
        #### BorrowGuardianMarketPaused

        * "BorrowGuardianMarketPaused" - Returns the Controllers's Borrow paused status in market
        * E.g. "Controller BorrowGuardianMarketPaused cREP"
        `,
        "BorrowGuardianMarketPaused",
        [
          new Arg("controller", getController, {implicit: true}),
          new Arg("pToken", getPTokenV)
        ],
        async (world, {controller, pToken}) => new BoolV(await controller.methods.borrowGuardianPaused(pToken._address).call())
    ),

    new Fetcher<{controller: Controller}, ListV>(`
      #### GetPieMarkets

      * "GetPieMarkets" - Returns an array of the currently enabled Pie markets. To use the auto-gen array getter pieMarkets(uint), use PieMarkets
      * E.g. "Controller GetPieMarkets"
      `,
      "GetPieMarkets",
      [new Arg("controller", getController, {implicit: true})],
      async(world, {controller}) => await getPieMarkets(world, controller)
     ),

    new Fetcher<{controller: Controller}, NumberV>(`
      #### PieRate

      * "PieRate" - Returns the current pie rate.
      * E.g. "Controller PieRate"
      `,
      "PieRate",
      [new Arg("controller", getController, {implicit: true})],
      async(world, {controller}) => new NumberV(await controller.methods.pieRate().call())
    ),

    new Fetcher<{controller: Controller, signature: StringV, callArgs: StringV[]}, NumberV>(`
        #### CallNum

        * "CallNum signature:<String> ...callArgs<CoreValue>" - Simple direct call method
          * E.g. "Controller CallNum \"pieSpeeds(address)\" (Address Coburn)"
      `,
      "CallNum",
      [
        new Arg("controller", getController, {implicit: true}),
        new Arg("signature", getStringV),
        new Arg("callArgs", getCoreValue, {variadic: true, mapped: true})
      ],
      async (world, {controller, signature, callArgs}) => {
        const fnData = encodeABI(world, signature.val, callArgs.map(a => a.val));
        const res = await world.web3.eth.call({
            to: controller._address,
            data: fnData
          });
        const resNum : any = world.web3.eth.abi.decodeParameter('uint256',res);
        return new NumberV(resNum);
      }
    ),
    new Fetcher<{controller: Controller, PToken: PToken, key: StringV}, NumberV>(`
        #### PieSupplyState(address)

        * "Controller PieBorrowState pZRX "index"
      `,
      "PieSupplyState",
      [
        new Arg("controller", getController, {implicit: true}),
        new Arg("PToken", getPTokenV),
        new Arg("key", getStringV),
      ],
      async (world, {controller, PToken, key}) => {
        const result = await controller.methods.pieSupplyState(PToken._address).call();
        return new NumberV(result[key.val]);
      }
    ),
    new Fetcher<{controller: Controller, PToken: PToken, key: StringV}, NumberV>(`
        #### PieBorrowState(address)

        * "Controller PieBorrowState pZRX "index"
      `,
      "PieBorrowState",
      [
        new Arg("controller", getController, {implicit: true}),
        new Arg("PToken", getPTokenV),
        new Arg("key", getStringV),
      ],
      async (world, {controller, PToken, key}) => {
        const result = await controller.methods.pieBorrowState(PToken._address).call();
        return new NumberV(result[key.val]);
      }
    ),
    new Fetcher<{controller: Controller, account: AddressV, key: StringV}, NumberV>(`
        #### PieAccrued(address)

        * "Controller PieAccrued Coburn
      `,
      "PieAccrued",
      [
        new Arg("controller", getController, {implicit: true}),
        new Arg("account", getAddressV),
      ],
      async (world, {controller,account}) => {
        const result = await controller.methods.pieAccrued(account.val).call();
        return new NumberV(result);
      }
    ),
    new Fetcher<{controller: Controller, PToken: PToken, account: AddressV}, NumberV>(`
        #### pieSupplierIndex

        * "Controller PieSupplierIndex pZRX Coburn
      `,
      "PieSupplierIndex",
      [
        new Arg("controller", getController, {implicit: true}),
        new Arg("PToken", getPTokenV),
        new Arg("account", getAddressV),
      ],
      async (world, {controller, PToken, account}) => {
        return new NumberV(await controller.methods.pieSupplierIndex(PToken._address, account.val).call());
      }
    ),
    new Fetcher<{controller: Controller, PToken: PToken, account: AddressV}, NumberV>(`
        #### PieBorrowerIndex

        * "Controller PieBorrowerIndex pZRX Coburn
      `,
      "PieBorrowerIndex",
      [
        new Arg("controller", getController, {implicit: true}),
        new Arg("PToken", getPTokenV),
        new Arg("account", getAddressV),
      ],
      async (world, {controller, PToken, account}) => {
        return new NumberV(await controller.methods.pieBorrowerIndex(PToken._address, account.val).call());
      }
    ),
    new Fetcher<{controller: Controller, PToken: PToken}, NumberV>(`
        #### PieSpeed

        * "Controller PieSpeed pZRX
      `,
      "PieSpeed",
      [
        new Arg("controller", getController, {implicit: true}),
        new Arg("PToken", getPTokenV),
      ],
      async (world, {controller, PToken}) => {
        return new NumberV(await controller.methods.pieSpeeds(PToken._address).call());
      }
    )
  ];
}

export async function getControllerValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("Controller", controllerFetchers(), world, event);
}
