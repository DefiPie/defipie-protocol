import {Event} from '../Event';
import {World} from '../World';
import {Registry} from '../Contract/Registry';
import {AddressV, Value} from '../Value';
import {Arg, Fetcher, getFetcherValue} from '../Command';
import {getRegistry} from '../ContractLookup';

export async function getRegistryAddress(world: World, registry: Registry): Promise<AddressV> {
  return new AddressV(registry._address);
}

export async function getRegistryAdmin(world: World, registry: Registry): Promise<AddressV> {
    return new AddressV(await registry.methods.admin().call());
}

export async function getRegistryPPIE(world: World, registry: Registry): Promise<AddressV> {
    return new AddressV(await registry.methods.pPIE().call());
}

export function registryFetchers() {
  return [
    new Fetcher<{registry: Registry}, AddressV>(`
        #### Address

        * "Registry Address" - Returns address of registry
      `,
      "Address",
      [new Arg("registry", getRegistry, {implicit: true})],
      (world, { registry }) => getRegistryAddress(world, registry)
    ),
    new Fetcher<{registry: Registry}, AddressV>(`
      #### Admin

      * "Registry Admin" - Returns the admin of Registry contract
        * E.g. "Registry Admin"
    `,
        "Admin",
        [new Arg("registry", getRegistry, {implicit: true})],
        (world, {registry}) => getRegistryAdmin(world, registry)
    ),
    new Fetcher<{registry: Registry}, AddressV>(`
      #### pPIE
  
      * "Registry pPIE" - Returns the pPIE of Registry contract
        * E.g. "Registry pPIE"
    `,
          "pPIE",
          [new Arg("registry", getRegistry, {implicit: true})],
          (world, {registry}) => getRegistryPPIE(world, registry)
    )
  ];
}

export async function getRegistryValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("Registry", registryFetchers(), world, event);
}
