import { Event } from '../Event';
import { World } from '../World';
import { PErc20Delegate, PErc20DelegateScenario } from '../Contract/PErc20Delegate';
import { PPIEDelegate } from '../Contract/PPIEDelegate';
import { Invokation } from '../Invokation';
import { getStringV } from '../CoreValue';
import { StringV } from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { storeAndSaveContract } from '../Networks';
import { getContract, getTestContract } from '../Contract';

const PDaiDelegateContract = getContract('PDaiDelegate');
const PDaiDelegateScenarioContract = getTestContract('PDaiDelegateScenario');
const PErc20DelegateContract = getContract('PErc20Delegate');
const PErc20DelegateScenarioContract = getTestContract('PErc20DelegateScenario');
const PPIEDelegateContract = getContract('PPIEDelegate');

export interface PTokenDelegateData {
  invokation: Invokation<PErc20Delegate>;
  name: string;
  contract: string;
  description?: string;
}

export async function buildPTokenDelegate(
  world: World,
  from: string,
  params: Event
): Promise<{ world: World; pTokenDelegate: PErc20Delegate; delegateData: PTokenDelegateData }> {
  const fetchers = [
    new Fetcher<{ name: StringV; }, PTokenDelegateData>(
      `
        #### PDaiDelegate

        * "PDaiDelegate name:<String>"
          * E.g. "PTokenDelegate Deploy PDaiDelegate pDAIDelegate"
      `,
      'PDaiDelegate',
      [
        new Arg('name', getStringV)
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await PDaiDelegateContract.deploy<PErc20Delegate>(world, from, []),
          name: name.val,
          contract: 'PDaiDelegate',
          description: 'Standard PDai Delegate'
        };
      }
    ),

    new Fetcher<{ name: StringV; }, PTokenDelegateData>(
      `
        #### PDaiDelegateScenario

        * "PDaiDelegateScenario name:<String>" - A PDaiDelegate Scenario for local testing
          * E.g. "PTokenDelegate Deploy PDaiDelegateScenario pDAIDelegate"
      `,
      'PDaiDelegateScenario',
      [
        new Arg('name', getStringV)
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await PDaiDelegateScenarioContract.deploy<PErc20DelegateScenario>(world, from, []),
          name: name.val,
          contract: 'PDaiDelegateScenario',
          description: 'Scenario PDai Delegate'
        };
      }
    ),

    new Fetcher<{ name: StringV; }, PTokenDelegateData>(
      `
        #### PErc20Delegate

        * "PErc20Delegate name:<String>"
          * E.g. "PTokenDelegate Deploy PErc20Delegate pDAIDelegate"
      `,
      'PErc20Delegate',
      [
        new Arg('name', getStringV)
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await PErc20DelegateContract.deploy<PErc20Delegate>(world, from, []),
          name: name.val,
          contract: 'PErc20Delegate',
          description: 'Standard PErc20 Delegate'
        };
      }
    ),

    new Fetcher<{ name: StringV; }, PTokenDelegateData>(
        `
      #### PPIEDelegate

      * "PPIEDelegate name:<String>"
        * E.g. "PTokenDelegate Deploy PPIEDelegate pPIEDelegate"
    `,
        'PPIEDelegate',
        [
            new Arg('name', getStringV)
        ],
        async (
            world,
            { name }
        ) => {
            return {
                invokation: await PPIEDelegateContract.deploy<PPIEDelegate>(world, from, []),
                name: name.val,
                contract: 'PPIEDelegate',
                description: 'Standard PPIE Delegate'
            };
        }
    ),

    new Fetcher<{ name: StringV; }, PTokenDelegateData>(
      `
        #### PErc20DelegateScenario

        * "PErc20DelegateScenario name:<String>" - A PErc20Delegate Scenario for local testing
          * E.g. "PTokenDelegate Deploy PErc20DelegateScenario pDAIDelegate"
      `,
      'PErc20DelegateScenario',
      [
        new Arg('name', getStringV),
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await PErc20DelegateScenarioContract.deploy<PErc20DelegateScenario>(world, from, []),
          name: name.val,
          contract: 'PErc20DelegateScenario',
          description: 'Scenario PErc20 Delegate'
        };
      }
    )
  ];

  let delegateData = await getFetcherValue<any, PTokenDelegateData>("DeployPToken", fetchers, world, params);
  let invokation = delegateData.invokation;
  delete delegateData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }

  const pTokenDelegate = invokation.value!;

  world = await storeAndSaveContract(
    world,
    pTokenDelegate,
    delegateData.name,
    invokation,
    [
      {
        index: ['PTokenDelegate', delegateData.name],
        data: {
          address: pTokenDelegate._address,
          contract: delegateData.contract,
          description: delegateData.description
        }
      }
    ]
  );

  return { world, pTokenDelegate, delegateData };
}
