import {Event} from '../Event';
import {World} from '../World';
import {RegistryProxy} from '../Contract/RegistryProxy';
import { AddressV, Value} from '../Value';
import {Arg, Fetcher, getFetcherValue} from '../Command';
import {getRegistryProxy} from '../ContractLookup';

export async function getRegistryProxyAddress(world: World, registryProxy: RegistryProxy): Promise<AddressV> {
  return new AddressV(registryProxy._address);
}

export async function getRegistryProxyAdmin(world: World, registryProxy: RegistryProxy): Promise<AddressV> {
    return new AddressV(await registryProxy.methods.admin().call());
}

export async function getRegistryProxyPengidnAdmin(world: World, registryProxy: RegistryProxy): Promise<AddressV> {
    return new AddressV(await registryProxy.methods.pendingAdmin().call());
}

export async function getRegistryProxyImplementaion(world: World, registryProxy: RegistryProxy): Promise<AddressV> {
    return new AddressV(await registryProxy.methods.implementaion().call());
}

export async function getRegistryProxyPPIE(world: World, registryProxy: RegistryProxy): Promise<AddressV> {
    return new AddressV(await registryProxy.methods.pPIE().call());
}

export async function getPriceOracle(world: World, registryProxy: RegistryProxy): Promise<AddressV> {
    return new AddressV(await registryProxy.methods.oracle().call());
}

export function registryProxyFetchers() {
  return [
    new Fetcher<{registryProxy: RegistryProxy}, AddressV>(`
      #### Address

      * "RegistryProxy Address" - Returns address of registry proxy
      `,
      "Address",
      [new Arg("registryProxy", getRegistryProxy, {implicit: true})],
      (world, { registryProxy }) => getRegistryProxyAddress(world, registryProxy)
    ),
      new Fetcher<{registryProxy: RegistryProxy}, AddressV>(`
      #### Admin

      * "RegistryProxy Admin" - Returns the admin of Registry proxy contract
        * E.g. "Registry Proxy Admin"
    `,
          "Admin",
          [new Arg("registryProxy", getRegistryProxy, {implicit: true})],
          (world, {registryProxy}) => getRegistryProxyAdmin(world, registryProxy)
      ),
      new Fetcher<{registryProxy: RegistryProxy}, AddressV>(`
      #### PendingAdmin

      * "RegistryProxy PendingAdmin" - Returns the pending admin of Registry proxy contract
        * E.g. "Registry Proxy PendingAdmin"
    `,
          "PendingAdmin",
          [new Arg("registryProxy", getRegistryProxy, {implicit: true})],
          (world, {registryProxy}) => getRegistryProxyPengidnAdmin(world, registryProxy)
      ),
      new Fetcher<{registryProxy: RegistryProxy}, AddressV>(`
      #### Implementaion

      * "RegistryProxy Admin" - Returns the implementaion of Registry proxy contract
        * E.g. "Registry Proxy Implementaion"
    `,
          "Implementaion",
          [new Arg("registryProxy", getRegistryProxy, {implicit: true})],
          (world, {registryProxy}) => getRegistryProxyImplementaion(world, registryProxy)
      ),
      new Fetcher<{registryProxy: RegistryProxy}, AddressV>(`
      #### pPIE
  
      * "RegistryProxy pPIE" - Returns the pPIE of Registry contract
        * E.g. "RegistryProxy pPIE"
    `,
          "pPIE",
          [new Arg("registryProxy", getRegistryProxy, {implicit: true})],
          (world, {registryProxy}) => getRegistryProxyPPIE(world, registryProxy)
      ),
      new Fetcher<{registryProxy: RegistryProxy}, AddressV>(`
      #### PriceOracle

      * "RegistryProxy PriceOracle" - Returns the Registry's price oracle
        * E.g. "RegistryProxy PriceOracle"
    `,
          "PriceOracle",
          [new Arg("registryProxy", getRegistryProxy, {implicit: true})],
          (world, {registryProxy}) => getPriceOracle(world, registryProxy)
      ),
  ];
}

export async function getRegistryProxyValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("RegistryProxy", registryProxyFetchers(), world, event);
}
