import {Event} from '../Event';
import {World} from '../World';
import {Distributor} from '../Contract/Distributor';
import {PToken} from '../Contract/PToken';
import {
  getAddressV,
  getCoreValue,
  getStringV
} from '../CoreValue';
import {
  AddressV,
  ListV,
  NumberV,
  StringV,
  Value
} from '../Value';
import {Arg, Fetcher, getFetcherValue} from '../Command';
import {getDistributor} from '../ContractLookup';
import {getPTokenV} from './PTokenValue';
import { encodeABI } from '../Utils';

export async function getDistributorAddress(world: World, distributor: Distributor): Promise<AddressV> {
  return new AddressV(distributor._address);
}

async function getRegistry(world: World, distributor: Distributor): Promise<AddressV> {
    return new AddressV(await distributor.methods.registry().call());
}

async function getController(world: World, distributor: Distributor): Promise<AddressV> {
  return new AddressV(await distributor.methods.controller().call());
}

async function getPieAddress(world: World, distributor: Distributor): Promise<AddressV> {
    return new AddressV(await distributor.methods.getPieAddress().call());
}

async function getImplementation(world: World, distributor: Distributor): Promise<AddressV> {
  return new AddressV(await distributor.methods.distributorImplementation().call());
}

async function getAdmin(world: World, distributor: Distributor): Promise<AddressV> {
  return new AddressV(await distributor.methods.getAdmin().call());
}

async function getPieMarkets(world: World, distributor: Distributor): Promise<ListV> {
  let mkts = await distributor.methods.getPieMarkets().call();

  return new ListV(mkts.map((a) => new AddressV(a)));
}

export function distributorFetchers() {
  return [
    new Fetcher<{distributor: Distributor}, AddressV>(`
      #### Address

      * "Distributor Address" - Returns address of distributor
      `,
      "Address",
      [new Arg("distributor", getDistributor, {implicit: true})],
      (world, {distributor}) => getDistributorAddress(world, distributor)
    ),
    new Fetcher<{distributor: Distributor}, AddressV>(`
      #### Admin

      * "Distributor Admin" - Returns the Distributors's admin
      * E.g. "Distributor Admin"
      `,
      "Admin",
      [new Arg("distributor", getDistributor, {implicit: true})],
      (world, {distributor}) => getAdmin(world, distributor)
    ),
    new Fetcher<{distributor: Distributor}, AddressV>(`
      #### PieAddress

      * "Distributor PieAddress" - Returns the Distributors's pie address
      * E.g. "Distributor PieAddress"
    ` ,
      "PieAddress",
      [new Arg("distributor", getDistributor, {implicit: true})],
      (world, {distributor}) => getPieAddress(world, distributor)
    ),
    new Fetcher<{distributor: Distributor}, AddressV>(`
        #### Implementation

        * "Distributor Implementation" - Returns the Distributors's implementation
          * E.g. "Distributor Implementation"
      `,
      "Implementation",
      [new Arg("distributor", getDistributor, {implicit: true})],
      (world, {distributor}) => getImplementation(world, distributor)
    ),
    new Fetcher<{distributor: Distributor}, AddressV>(`
    #### Registry

      * "Distributor Registry" - Returns the Distributors's Oracle
      * E.g. "Distributor Registry"
      `,
        "Registry",
        [new Arg("distributor", getDistributor, {implicit: true})],
        (world, {distributor}) => getRegistry(world, distributor)
    ),
    new Fetcher<{distributor: Distributor}, ListV>(`
      #### GetPieMarkets

      * "GetPieMarkets" - Returns an array of the currently enabled Pie markets. To use the auto-gen array getter pieMarkets(uint), use PieMarkets
      * E.g. "Distributor GetPieMarkets"
      `,
      "GetPieMarkets",
      [new Arg("distributor", getDistributor, {implicit: true})],
      async(world, {distributor}) => await getPieMarkets(world, distributor)
    ),

    new Fetcher<{distributor: Distributor}, NumberV>(`
      #### PieRate

      * "PieRate" - Returns the current pie rate.
      * E.g. "Distributor PieRate"
      `,
      "PieRate",
      [new Arg("distributor", getDistributor, {implicit: true})],
      async(world, {distributor}) => new NumberV(await distributor.methods.pieRate().call())
    ),

    new Fetcher<{distributor: Distributor, signature: StringV, callArgs: StringV[]}, NumberV>(`
        #### CallNum

        * "CallNum signature:<String> ...callArgs<CoreValue>" - Simple direct call method
          * E.g. "Distributor CallNum \"pieSpeeds(address)\" (Address Coburn)"
      `,
      "CallNum",
      [
        new Arg("distributor", getDistributor, {implicit: true}),
        new Arg("signature", getStringV),
        new Arg("callArgs", getCoreValue, {variadic: true, mapped: true})
      ],
      async (world, {distributor, signature, callArgs}) => {
        const fnData = encodeABI(world, signature.val, callArgs.map(a => a.val));
        const res = await world.web3.eth.call({
            to: distributor._address,
            data: fnData
          });
        const resNum : any = world.web3.eth.abi.decodeParameter('uint256',res);
        return new NumberV(resNum);
      }
    ),
    new Fetcher<{distributor: Distributor, PToken: PToken, key: StringV}, NumberV>(`
        #### PieSupplyState(address)

        * "Distributor PieSupplyState pZRX "index"
      `,
      "PieSupplyState",
      [
        new Arg("distributor", getDistributor, {implicit: true}),
        new Arg("PToken", getPTokenV),
        new Arg("key", getStringV),
      ],
      async (world, {distributor, PToken, key}) => {
        const result = await distributor.methods.pieSupplyState(PToken._address).call();
        return new NumberV(result[key.val]);
      }
    ),
    new Fetcher<{distributor: Distributor, PToken: PToken, key: StringV}, NumberV>(`
        #### PieBorrowState(address)

        * "Distributor PieBorrowState pZRX "index"
      `,
      "PieBorrowState",
      [
        new Arg("distributor", getDistributor, {implicit: true}),
        new Arg("PToken", getPTokenV),
        new Arg("key", getStringV),
      ],
      async (world, {distributor, PToken, key}) => {
        const result = await distributor.methods.pieBorrowState(PToken._address).call();
        return new NumberV(result[key.val]);
      }
    ),
    new Fetcher<{distributor: Distributor, account: AddressV, key: StringV}, NumberV>(`
        #### PieAccrued(address)

        * "Distributor PieAccrued Coburn
      `,
      "PieAccrued",
      [
        new Arg("distributor", getDistributor, {implicit: true}),
        new Arg("account", getAddressV),
      ],
      async (world, {distributor,account}) => {
        const result = await distributor.methods.pieAccrued(account.val).call();
        return new NumberV(result);
      }
    ),
    new Fetcher<{distributor: Distributor, PToken: PToken, account: AddressV}, NumberV>(`
        #### pieSupplierIndex

        * "Distributor PieSupplierIndex pZRX Coburn
      `,
      "PieSupplierIndex",
      [
        new Arg("distributor", getDistributor, {implicit: true}),
        new Arg("PToken", getPTokenV),
        new Arg("account", getAddressV),
      ],
      async (world, {distributor, PToken, account}) => {
        return new NumberV(await distributor.methods.pieSupplierIndex(PToken._address, account.val).call());
      }
    ),
    new Fetcher<{distributor: Distributor, PToken: PToken, account: AddressV}, NumberV>(`
        #### PieBorrowerIndex

        * "Distributor PieBorrowerIndex pZRX Coburn
      `,
      "PieBorrowerIndex",
      [
        new Arg("distributor", getDistributor, {implicit: true}),
        new Arg("PToken", getPTokenV),
        new Arg("account", getAddressV),
      ],
      async (world, {distributor, PToken, account}) => {
        return new NumberV(await distributor.methods.pieBorrowerIndex(PToken._address, account.val).call());
      }
    ),
    new Fetcher<{distributor: Distributor, PToken: PToken}, NumberV>(`
        #### PieSpeed

        * "Distributor PieSpeed pZRX
      `,
      "PieSpeed",
      [
        new Arg("distributor", getDistributor, {implicit: true}),
        new Arg("PToken", getPTokenV),
      ],
      async (world, {distributor, PToken}) => {
        return new NumberV(await distributor.methods.pieSpeeds(PToken._address).call());
      }
    )
  ];
}

export async function getDistributorValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("Distributor", distributorFetchers(), world, event);
}
