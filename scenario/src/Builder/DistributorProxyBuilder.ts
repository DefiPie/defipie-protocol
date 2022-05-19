import {Event} from '../Event';
import {World} from '../World';
import {DistributorProxy} from '../Contract/DistributorProxy';
import {Invokation} from '../Invokation';
import {
    getAddressV,
} from '../CoreValue';
import {
    AddressV,
} from '../Value';
import {Arg, Fetcher, getFetcherValue} from '../Command';
import {storeAndSaveContract} from '../Networks';
import {getContract} from '../Contract';

const DistributorProxyContract = getContract("DistributorProxyHarness");

export interface DistributorProxyData {
    invokation: Invokation<DistributorProxy>,
    description: string,
    address?: string,
    contract: string
}

export async function buildDistributorProxy(
    world: World,
    from: string,
    event: Event
): Promise<{ world: World, distributorProxy: DistributorProxy, distributorProxyData: DistributorProxyData }> {
  const fetchers = [
    new Fetcher<
    {
      implementation: AddressV,
      registry: AddressV,
      controller: AddressV;
    }, DistributorProxyData>(`
      #### Default
      * "" - The RegistryProxy contract
      * " implementation:<String> registry:<String> controller:<String> " - The DistributorProxy contract
      * E.g. "DistributorProxy Deploy (Impl Address) (RegistryProxy Address) (Controller Address)"
      `,
      'Default',
      [
        new Arg('implementation', getAddressV),
        new Arg('registry', getAddressV),
        new Arg('controller', getAddressV),
      ],
      async (world, {
        implementation,
        registry,
        controller
      }) => {
        return {
          invokation: await DistributorProxyContract.deploy<DistributorProxy>(world, from, [
            implementation.val,
            registry.val,
            controller.val
          ]),
          contract: 'DistributorProxy',
          description: 'Default DistributorProxy'
        };
      },
     { catchall: true }
    )
  ];

  let distributorProxyData = await getFetcherValue<any, DistributorProxyData>("DeployDistributorProxy", fetchers, world, event);
  let invokation = distributorProxyData.invokation;
  delete distributorProxyData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }
  const distributorProxy = invokation.value!;
  distributorProxyData.address = distributorProxy._address;

  world = await storeAndSaveContract(world, distributorProxy,"DistributorProxy", invokation,
    [
      {
        index: ['DistributorProxy'],
        data: {
          address: distributorProxyData.address,
          contract: distributorProxyData.contract,
          description: distributorProxyData.description
        }
      }
    ]
  );

  return {world, distributorProxy, distributorProxyData};
}