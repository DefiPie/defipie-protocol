import { Event } from '../Event';
import { World } from '../World';
import { Pie } from '../Contract/Pie';
import {
  getAddressV
} from '../CoreValue';
import {
  AddressV,
  NumberV,
  StringV,
  Value
} from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { getPie } from '../ContractLookup';

export function pieFetchers() {
  return [
    new Fetcher<{ pie: Pie }, AddressV>(`
        #### Address

        * "<Pie> Address" - Returns the address of Pie token
          * E.g. "Pie Address"
      `,
      "Address",
      [
        new Arg("pie", getPie, { implicit: true })
      ],
      async (world, { pie }) => new AddressV(pie._address)
    ),

    new Fetcher<{ pie: Pie }, StringV>(`
        #### Name

        * "<Pie> Name" - Returns the name of the Pie token
          * E.g. "Pie Name"
      `,
      "Name",
      [
        new Arg("pie", getPie, { implicit: true })
      ],
      async (world, { pie }) => new StringV(await pie.methods.name().call())
    ),

    new Fetcher<{ pie: Pie }, StringV>(`
        #### Symbol

        * "<Pie> Symbol" - Returns the symbol of the Pie token
          * E.g. "Pie Symbol"
      `,
      "Symbol",
      [
        new Arg("pie", getPie, { implicit: true })
      ],
      async (world, { pie }) => new StringV(await pie.methods.symbol().call())
    ),

    new Fetcher<{ pie: Pie }, NumberV>(`
        #### Decimals

        * "<Pie> Decimals" - Returns the number of decimals of the Pie token
          * E.g. "Pie Decimals"
      `,
      "Decimals",
      [
        new Arg("pie", getPie, { implicit: true })
      ],
      async (world, { pie }) => new NumberV(await pie.methods.decimals().call())
    ),

    new Fetcher<{ pie: Pie }, NumberV>(`
        #### TotalSupply

        * "Pie TotalSupply" - Returns Pie token's total supply
      `,
      "TotalSupply",
      [
        new Arg("pie", getPie, { implicit: true })
      ],
      async (world, { pie }) => new NumberV(await pie.methods.totalSupply().call())
    ),

    new Fetcher<{ pie: Pie, address: AddressV }, NumberV>(`
        #### TokenBalance

        * "Pie TokenBalance <Address>" - Returns the Pie token balance of a given address
          * E.g. "Pie TokenBalance Geoff" - Returns Geoff's Pie balance
      `,
      "TokenBalance",
      [
        new Arg("pie", getPie, { implicit: true }),
        new Arg("address", getAddressV)
      ],
      async (world, { pie, address }) => new NumberV(await pie.methods.balanceOf(address.val).call())
    ),

    new Fetcher<{ pie: Pie, owner: AddressV, spender: AddressV }, NumberV>(`
        #### Allowance

        * "Pie Allowance owner:<Address> spender:<Address>" - Returns the Pie allowance from owner to spender
          * E.g. "Pie Allowance Geoff Torrey" - Returns the Pie allowance of Geoff to Torrey
      `,
      "Allowance",
      [
        new Arg("pie", getPie, { implicit: true }),
        new Arg("owner", getAddressV),
        new Arg("spender", getAddressV)
      ],
      async (world, { pie, owner, spender }) => new NumberV(await pie.methods.allowance(owner.val, spender.val).call())
    ),
  ];
}

export async function getPieValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("Pie", pieFetchers(), world, event);
}
