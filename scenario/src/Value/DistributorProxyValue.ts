import {Event} from '../Event';
import {World} from '../World';
import {DistributorProxy} from '../Contract/DistributorProxy';
import {AddressV, ListV, NumberV, StringV, Value} from '../Value';
import {Arg, Fetcher, getFetcherValue} from '../Command';
import {getDistributorProxy} from '../ContractLookup';
import {Controller} from "../Contract/Controller";
import {getPTokenV} from './PTokenValue';
import {getAddressV, getStringV} from "../CoreValue";
import {PToken} from '../Contract/PToken';

export async function getDistributorProxyAddress(world: World, distributorProxy: DistributorProxy): Promise<AddressV> {
  return new AddressV(distributorProxy._address);
}

async function getRegistry(world: World, distributorProxy: DistributorProxy): Promise<AddressV> {
  return new AddressV(await distributorProxy.methods.registry().call());
}

async function getController(world: World, distributorProxy: DistributorProxy): Promise<AddressV> {
  return new AddressV(await distributorProxy.methods.controller().call());
}

async function getImplementation(world: World, distributorProxy: DistributorProxy): Promise<AddressV> {
  return new AddressV(await distributorProxy.methods.implementation().call());
}

async function getPieMarkets(world: World, distributorProxy: DistributorProxy): Promise<ListV> {
  let mkts = await distributorProxy.methods.getPieMarkets().call();

  return new ListV(mkts.map((a) => new AddressV(a)));
}

async function getDistributorProxyAdmin(world: World, distributorProxy: DistributorProxy): Promise<AddressV> {
  return new AddressV(await distributorProxy.methods.getAdmin().call());
}

async function getPieAddress(world: World, distributorProxy: DistributorProxy): Promise<AddressV> {
  return new AddressV(await distributorProxy.methods.getPieAddress().call());
}

async function getBlockNumber(world: World, distributorProxy: DistributorProxy): Promise<NumberV> {
  return new NumberV(await distributorProxy.methods.getBlockNumber().call());
}

async function getAllMarkets(world: World, distributorProxy: DistributorProxy): Promise<ListV> {
  let mkts = await distributorProxy.methods.getAllMarkets().call();

  return new ListV(mkts.map((a) => new AddressV(a)));
}

export function distributorProxyFetchers() {
  return [
    new Fetcher<{distributorProxy: DistributorProxy}, AddressV>(`
      #### Address

      * "DistributorProxy Address" - Returns address of distributor proxy
      `,
      "Address",
      [new Arg("distributorProxy", getDistributorProxy, {implicit: true})],
      (world, {distributorProxy}) => getDistributorProxyAddress(world, distributorProxy)
    ),
    new Fetcher<{ distributorProxy: DistributorProxy }, AddressV>(`
      #### Admin

      * "DistributorProxy Admin" - Returns the admin of DistributorProxy contract
      * E.g. "DistributorProxy Admin" - Returns address of admin
      `,
      'Admin',
      [new Arg('distributorProxy', getDistributorProxy, { implicit: true })],
      (world, { distributorProxy }) => getDistributorProxyAdmin(world, distributorProxy)
    ),
    new Fetcher<{distributorProxy: DistributorProxy}, AddressV>(`
      #### Registry

      * "DistributorProxy Registry" - Returns the Distributor's Registry
      * E.g. "DistributorProxy Registry"
      `,
        "Registry",
        [new Arg("distributorProxy", getDistributorProxy, {implicit: true})],
        (world, {distributorProxy}) => getRegistry(world, distributorProxy)
    ),
    new Fetcher<{distributorProxy: DistributorProxy}, AddressV>(`
      #### Controller

      * "DistributorProxy Controller" - Returns the Distributor's Controller
      * E.g. "DistributorProxy Controller"
      `,
        "Controller",
        [new Arg("distributorProxy", getDistributorProxy, {implicit: true})],
        (world, {distributorProxy}) => getController(world, distributorProxy)
    ),
    new Fetcher<{distributorProxy: DistributorProxy}, AddressV>(`
      #### Implementation

      * "DistributorProxy Implementation" - Returns the Distributor's Implementation
      * E.g. "DistributorProxy Implementation"
      `,
        "Implementation",
        [new Arg("distributorProxy", getDistributorProxy, {implicit: true})],
        (world, {distributorProxy}) => getImplementation(world, distributorProxy)
    ),
    new Fetcher<{distributorProxy: DistributorProxy}, ListV>(`
      #### GetPieMarkets

      * "GetPieMarkets" - Returns an array of the currently enabled Pie markets. To use the auto-gen array getter pieMarkets(uint), use PieMarkets
      * E.g. "DistributorProxy GetPieMarkets"
      `,
      "GetPieMarkets",
      [new Arg("distributorProxy", getDistributorProxy, {implicit: true})],
      async(world, {distributorProxy}) => await getPieMarkets(world, distributorProxy)
    ),
    new Fetcher<{distributorProxy: DistributorProxy, PToken: PToken, key: StringV}, NumberV>(`
        #### PieSupplyState(address)

        * "DistributorProxy PieSupplyState pZRX "index"
      `,
        "PieSupplyState",
        [
          new Arg("distributorProxy", getDistributorProxy, {implicit: true}),
          new Arg("PToken", getPTokenV),
          new Arg("key", getStringV),
        ],
        async (world, {distributorProxy, PToken, key}) => {
          const result = await distributorProxy.methods.pieSupplyState(PToken._address).call();
          return new NumberV(result[key.val]);
        }
    ),
    new Fetcher<{distributorProxy: DistributorProxy, PToken: PToken, key: StringV}, NumberV>(`
        #### PieBorrowState(address)

        * "DistributorProxy PieBorrowState pZRX "index"
      `,
        "PieBorrowState",
        [
          new Arg("distributorProxy", getDistributorProxy, {implicit: true}),
          new Arg("PToken", getPTokenV),
          new Arg("key", getStringV),
        ],
        async (world, {distributorProxy, PToken, key}) => {
          const result = await distributorProxy.methods.pieBorrowState(PToken._address).call();
          return new NumberV(result[key.val]);
        }
    ),
    new Fetcher<{distributorProxy: DistributorProxy, account: AddressV, key: StringV}, NumberV>(`
        #### PieAccrued(address)

        * "DistributorProxy PieAccrued Coburn
      `,
        "PieAccrued",
        [
          new Arg("distributorProxy", getDistributorProxy, {implicit: true}),
          new Arg("account", getAddressV),
        ],
        async (world, {distributorProxy,account}) => {
          const result = await distributorProxy.methods.pieAccrued(account.val).call();
          return new NumberV(result);
        }
    ),
    new Fetcher<{distributorProxy: DistributorProxy, PToken: PToken, account: AddressV}, NumberV>(`
        #### pieSupplierIndex

        * "DistributorProxy PieSupplierIndex pZRX Coburn
      `,
        "PieSupplierIndex",
        [
          new Arg("distributorProxy", getDistributorProxy, {implicit: true}),
          new Arg("PToken", getPTokenV),
          new Arg("account", getAddressV),
        ],
        async (world, {distributorProxy, PToken, account}) => {
          return new NumberV(await distributorProxy.methods.pieSupplierIndex(PToken._address, account.val).call());
        }
    ),
    new Fetcher<{distributorProxy: DistributorProxy, PToken: PToken, account: AddressV}, NumberV>(`
        #### PieBorrowerIndex

        * "DistributorProxy PieBorrowerIndex pZRX Coburn
      `,
        "PieBorrowerIndex",
        [
          new Arg("distributorProxy", getDistributorProxy, {implicit: true}),
          new Arg("PToken", getPTokenV),
          new Arg("account", getAddressV),
        ],
        async (world, {distributorProxy, PToken, account}) => {
          return new NumberV(await distributorProxy.methods.pieBorrowerIndex(PToken._address, account.val).call());
        }
    ),
    new Fetcher<{distributorProxy: DistributorProxy}, AddressV>(`
      #### PieAddress

      * "DistributorProxy PieAddress" - Returns the Distributor's PieAddress
      * E.g. "DistributorProxy PieAddress"
      `,
        "PieAddress",
        [new Arg("distributorProxy", getDistributorProxy, {implicit: true})],
        (world, {distributorProxy}) => getPieAddress(world, distributorProxy)
    ),
    new Fetcher<{distributorProxy: DistributorProxy}, NumberV>(`
        #### BlockNumber

        * "DistributorProxy BlockNumber" - Returns the DistributorProxy's mocked block number (for scenario runner)
          * E.g. "DistributorProxy BlockNumber"
      `,
        "BlockNumber",
        [new Arg("distributorProxy", getDistributorProxy, {implicit: true})],
        (world, {distributorProxy}) => getBlockNumber(world, distributorProxy)
    ),
    new Fetcher<{distributorProxy: DistributorProxy}, ListV>(`
      #### GetAllMarkets

      * "GetAllMarkets" - Returns an array of all markets.
      * E.g. "DistributorProxy GetAllMarkets"
      `,
        "GetAllMarkets",
        [new Arg("distributorProxy", getDistributorProxy, {implicit: true})],
        async(world, {distributorProxy}) => await getAllMarkets(world, distributorProxy)
    ),
    new Fetcher<{distributorProxy: DistributorProxy}, NumberV>(`
      #### PieRate

      * "PieRate" - Returns the current pie rate.
      * E.g. "DistributorProxy PieRate"
      `,
        "PieRate",
        [new Arg("distributorProxy", getDistributorProxy, {implicit: true})],
        async(world, {distributorProxy}) => new NumberV(await distributorProxy.methods.pieRate().call())
    ),
    new Fetcher<{distributorProxy: DistributorProxy, PToken: PToken}, NumberV>(`
        #### PieSpeed

        * "Distributor PieSpeed pZRX
      `,
        "PieSpeed",
        [
          new Arg("distributorProxy", getDistributorProxy, {implicit: true}),
          new Arg("PToken", getPTokenV),
        ],
        async (world, {distributorProxy, PToken}) => {
          return new NumberV(await distributorProxy.methods.pieSpeeds(PToken._address).call());
        }
    )
  ];
}

export async function getDistributorProxyValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("DistributorProxy", distributorProxyFetchers(), world, event);
}
