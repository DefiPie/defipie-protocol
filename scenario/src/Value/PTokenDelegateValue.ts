import { Event } from '../Event';
import { World } from '../World';
import { PErc20Delegate } from '../Contract/PErc20Delegate';
import {
  getCoreValue,
  mapValue
} from '../CoreValue';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import {
  AddressV,
  Value,
} from '../Value';
import { getWorldContractByAddress, getPTokenDelegateAddress } from '../ContractLookup';

export async function getPTokenDelegateV(world: World, event: Event): Promise<PErc20Delegate> {
  const address = await mapValue<AddressV>(
    world,
    event,
    (str) => new AddressV(getPTokenDelegateAddress(world, str)),
    getCoreValue,
    AddressV
  );

  return getWorldContractByAddress<PErc20Delegate>(world, address.val);
}

async function pTokenDelegateAddress(world: World, pTokenDelegate: PErc20Delegate): Promise<AddressV> {
  return new AddressV(pTokenDelegate._address);
}

export function pTokenDelegateFetchers() {
  return [
    new Fetcher<{ pTokenDelegate: PErc20Delegate }, AddressV>(`
        #### Address

        * "PTokenDelegate <PTokenDelegate> Address" - Returns address of PTokenDelegate contract
          * E.g. "PTokenDelegate pDaiDelegate Address" - Returns pDaiDelegate's address
      `,
      "Address",
      [
        new Arg("pTokenDelegate", getPTokenDelegateV)
      ],
      (world, { pTokenDelegate }) => pTokenDelegateAddress(world, pTokenDelegate),
      { namePos: 1 }
    ),
  ];
}

export async function getPTokenDelegateValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("PTokenDelegate", pTokenDelegateFetchers(), world, event);
}
