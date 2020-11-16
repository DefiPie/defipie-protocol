import { Event } from '../Event';
import { World } from '../World';
import { Pie, PieScenario } from '../Contract/Pie';
import { Invokation } from '../Invokation';
import { getAddressV } from '../CoreValue';
import { AddressV } from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { storeAndSaveContract } from '../Networks';
import { getContract } from '../Contract';

const PieContract = getContract('Pie');
const PieScenarioContract = getContract('PieScenario');

export interface TokenData {
  invokation: Invokation<Pie>;
  contract: string;
  address?: string;
  symbol: string;
  name: string;
  decimals?: number;
}

export async function buildPie(
  world: World,
  from: string,
  params: Event
): Promise<{ world: World; pie: Pie; tokenData: TokenData }> {
  const fetchers = [
    new Fetcher<{ account: AddressV }, TokenData>(
      `
      #### Scenario

      * "Pie Deploy Scenario account:<Address>" - Deploys Scenario Pie Token
        * E.g. "Pie Deploy Scenario Geoff"
    `,
      'Scenario',
      [
        new Arg("account", getAddressV),
      ],
      async (world, { account }) => {
        return {
          invokation: await PieScenarioContract.deploy<PieScenario>(world, from, [account.val]),
          contract: 'PieScenario',
          symbol: 'PIE',
          name: 'DeFiPie Governance Token',
          decimals: 18
        };
      }
    ),

    new Fetcher<{ account: AddressV }, TokenData>(
      `
      #### Pie

      * "Pie Deploy account:<Address>" - Deploys Pie Token
        * E.g. "Pie Deploy Geoff"
    `,
      'Pie',
      [
        new Arg("account", getAddressV),
      ],
      async (world, { account }) => {
        if (world.isLocalNetwork()) {
          return {
            invokation: await PieScenarioContract.deploy<PieScenario>(world, from, [account.val]),
            contract: 'PieScenario',
            symbol: 'PIE',
            name: 'DeFiPie Governance Token',
            decimals: 18
          };
        } else {
          return {
            invokation: await PieContract.deploy<Pie>(world, from, [account.val]),
            contract: 'Pie',
            symbol: 'PIE',
            name: 'DeFiPie Governance Token',
            decimals: 18
          };
        }
      },
      { catchall: true }
    )
  ];

  let tokenData = await getFetcherValue<any, TokenData>("DeployPie", fetchers, world, params);
  let invokation = tokenData.invokation;
  delete tokenData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }

  const pie = invokation.value!;
  tokenData.address = pie._address;

  world = await storeAndSaveContract(
    world,
    pie,
    'Pie',
    invokation,
    [
      { index: ['Pie'], data: tokenData },
      { index: ['Tokens', tokenData.symbol], data: tokenData }
    ]
  );

  tokenData.invokation = invokation;

  return { world, pie, tokenData };
}
