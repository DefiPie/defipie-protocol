import {Event} from '../Event';
import {World} from '../World';
import {Registry} from '../Contract/Registry';
import {Invokation} from '../Invokation';
import {getAddressV} from '../CoreValue';
import {
    AddressV,
} from '../Value';
import {Arg, Fetcher, getFetcherValue} from '../Command';
import {storeAndSaveContract} from '../Networks';
import {getContract} from '../Contract';

const ExistingRegistry = getContract("RegistryInterface");
const RegistryContract = getContract("Registry");

export interface RegistryData {
    invokation: Invokation<Registry>,
    description: string,
    address?: string,
    contract: string
}

export async function buildRegistry(
    world: World,
    from: string,
    event: Event
): Promise<{ world: World, registry: Registry, registryData: RegistryData }> {
  const fetchers = [
    new Fetcher<{ address: AddressV }, RegistryData>(`
      #### Existing
      * "Existing Registry address:<Address>" - Wrap an existing Registry
      * E.g. "Registry Deploy Existing 0x123...
      `,
      "Existing",
      [
        new Arg("address", getAddressV)
      ],
      async (world, { address }) => {
        const existingRegistry = await ExistingRegistry.at<Registry>(world, address.val);

        return {
          invokation: new Invokation<Registry>(existingRegistry, null, null, null),
          description: "Existing Registry",
          contract: 'Registry'
        };
      }
    ),
    new Fetcher<{}, RegistryData>(`
      #### Default
      * "" - The Registry contract
      * E.g. "Registry Deploy"
      `,
      'Default',
      [],
      async (world, {}) => {
        return {
          invokation: await RegistryContract.deploy<Registry>(world, from, []),
          contract: 'Registry',
          description: 'Default Registry'
        };
      },
      { catchall: true }
    )
  ];

  let registryData = await getFetcherValue<any, RegistryData>("DeployRegistry", fetchers, world, event);
  let invokation = registryData.invokation;
  delete registryData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }
  const registry = invokation.value!;
  registryData.address = registry._address;

  world = await storeAndSaveContract(world, registry,"Registry", invokation, [
    {
      index: ['Registry'],
      data: {
        address: registryData.address,
        contract: registryData.contract,
        description: registryData.description
      }
    }
  ]);

  return {world, registry, registryData};
}