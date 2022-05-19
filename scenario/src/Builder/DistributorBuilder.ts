import { Event } from '../Event';
import { World } from '../World';
import { Distributor } from '../Contract/Distributor';
import { Invokation } from '../Invokation';
import { Fetcher, getFetcherValue } from '../Command';
import { storeAndSaveContract } from '../Networks';
import { getContract } from '../Contract';

const DistributorContract = getContract('DistributorHarness');

export interface DistributorData {
  invokation: Invokation<Distributor>;
  description: string;
  address?: string,
  contract: string;
}

export async function buildDistributor(
  world: World,
  from: string,
  event: Event
): Promise<{ world: World; distributor: Distributor; distributorData: DistributorData }> {
  const fetchers = [
    new Fetcher<{}, DistributorData>(`
      #### Default
      * "" - The standard Distributor contract
      * E.g. "Distributor Deploy"
      `,
      'Default',
      [],
      async (world, {}) => {
          return {
            invokation: await DistributorContract.deploy<Distributor>(world, from, []),
            contract: 'Distributor',
            description: 'Distributor'
          };
      },
      { catchall: true }
    )
  ];

  let distributorData = await getFetcherValue<any, DistributorData>(
    'DeployDistributor',
    fetchers,
    world,
    event
  );
  let invokation = distributorData.invokation;
  delete distributorData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }
  const distributor = invokation.value!;
  distributorData.address = distributor._address;

  world = await storeAndSaveContract(world, distributor, "Distributor", invokation, [
    {
      index: ['Distributor'],
      data: {
        address: distributorData.address,
        contract: distributorData.contract,
        description: distributorData.description
      }
    }
  ]);

  return { world, distributor, distributorData };
}
