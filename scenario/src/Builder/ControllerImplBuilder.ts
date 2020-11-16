import { Event } from '../Event';
import { World } from '../World';
import { ControllerImpl } from '../Contract/ControllerImpl';
import { Invokation } from '../Invokation';
import { getStringV } from '../CoreValue';
import { StringV } from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { storeAndSaveContract } from '../Networks';
import { getContract, getTestContract } from '../Contract';

const ControllerContract = getContract('Controller');
const ControllerScenarioG1Contract = getTestContract('ControllerScenarioG1');
const ControllerScenarioG2Contract = getContract('ControllerScenarioG2');
const ControllerScenarioG3Contract = getContract('ControllerScenarioG3');
const ControllerScenarioContract = getTestContract('ControllerScenario');

const ControllerBorkedContract = getTestContract('ControllerBorked');

export interface ControllerImplData {
  invokation: Invokation<ControllerImpl>;
  name: string;
  contract: string;
  description: string;
}

export async function buildControllerImpl(
  world: World,
  from: string,
  event: Event
): Promise<{ world: World; controllerImpl: ControllerImpl; controllerImplData: ControllerImplData }> {
  const fetchers = [
    new Fetcher<{ name: StringV }, ControllerImplData>(
      `
        #### ScenarioG1

        * "ScenarioG1 name:<String>" - The Controller Scenario for local testing (G1)
          * E.g. "ControllerImpl Deploy ScenarioG1 MyScen"
      `,
      'ScenarioG1',
      [new Arg('name', getStringV)],
      async (world, { name }) => ({
        invokation: await ControllerScenarioG1Contract.deploy<ControllerImpl>(world, from, []),
        name: name.val,
        contract: 'ControllerScenarioG1',
        description: 'ScenarioG1 Controller Impl'
      })
    ),

    new Fetcher<{ name: StringV }, ControllerImplData>(
      `
        #### ScenarioG2

        * "ScenarioG2 name:<String>" - The Controller Scenario for local testing (G2)
          * E.g. "ControllerImpl Deploy ScenarioG2 MyScen"
      `,
      'ScenarioG2',
      [new Arg('name', getStringV)],
      async (world, { name }) => ({
        invokation: await ControllerScenarioG2Contract.deploy<ControllerImpl>(world, from, []),
        name: name.val,
        contract: 'ControllerScenarioG2Contract',
        description: 'ScenarioG2 Controller Impl'
      })
    ),

    new Fetcher<{ name: StringV }, ControllerImplData>(
      `
        #### ScenarioG3

        * "ScenarioG3 name:<String>" - The Controller Scenario for local testing (G3)
          * E.g. "ControllerImpl Deploy ScenarioG3 MyScen"
      `,
      'ScenarioG3',
      [new Arg('name', getStringV)],
      async (world, { name }) => ({
        invokation: await ControllerScenarioG3Contract.deploy<ControllerImpl>(world, from, []),
        name: name.val,
        contract: 'ControllerScenarioG3Contract',
        description: 'ScenarioG3 Controller Impl'
      })
    ),

    new Fetcher<{ name: StringV }, ControllerImplData>(
      `
        #### Scenario

        * "Scenario name:<String>" - The Controller Scenario for local testing
          * E.g. "ControllerImpl Deploy Scenario MyScen"
      `,
      'Scenario',
      [new Arg('name', getStringV)],
      async (world, { name }) => ({
        invokation: await ControllerScenarioContract.deploy<ControllerImpl>(world, from, []),
        name: name.val,
        contract: 'ControllerScenario',
        description: 'Scenario Controller Impl'
      })
    ),

    new Fetcher<{ name: StringV }, ControllerImplData>(
      `
        #### StandardG3

        * "StandardG3 name:<String>" - The standard generation 2 Controller contract
          * E.g. "Controller Deploy StandardG3 MyStandard"
      `,
      'StandardG3',
      [new Arg('name', getStringV)],
      async (world, { name }) => {
        return {
          invokation: await ControllerContract.deploy<ControllerImpl>(world, from, []),
          name: name.val,
          contract: 'ControllerG3',
          description: 'StandardG3 Controller Impl'
        };
      }
    ),

    new Fetcher<{ name: StringV }, ControllerImplData>(
      `
        #### Borked

        * "Borked name:<String>" - A Borked Controller for testing
          * E.g. "ControllerImpl Deploy Borked MyBork"
      `,
      'Borked',
      [new Arg('name', getStringV)],
      async (world, { name }) => ({
        invokation: await ControllerBorkedContract.deploy<ControllerImpl>(world, from, []),
        name: name.val,
        contract: 'ControllerBorked',
        description: 'Borked Controller Impl'
      })
    ),
    new Fetcher<{ name: StringV }, ControllerImplData>(
      `
        #### Default

        * "name:<String>" - The standard Controller contract
          * E.g. "ControllerImpl Deploy MyDefault"
      `,
      'Default',
      [new Arg('name', getStringV)],
      async (world, { name }) => {
        if (world.isLocalNetwork()) {
          // Note: we're going to use the scenario contract as the standard deployment on local networks
          return {
            invokation: await ControllerScenarioContract.deploy<ControllerImpl>(world, from, []),
            name: name.val,
            contract: 'ControllerScenario',
            description: 'Scenario Controller Impl'
          };
        } else {
          return {
            invokation: await ControllerContract.deploy<ControllerImpl>(world, from, []),
            name: name.val,
            contract: 'Controller',
            description: 'Standard Controller Impl'
          };
        }
      },
      { catchall: true }
    )
  ];

  let controllerImplData = await getFetcherValue<any, ControllerImplData>(
    'DeployControllerImpl',
    fetchers,
    world,
    event
  );
  let invokation = controllerImplData.invokation;
  delete controllerImplData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }
  const controllerImpl = invokation.value!;

  world = await storeAndSaveContract(world, controllerImpl, controllerImplData.name, invokation, [
    {
      index: ['Controller', controllerImplData.name],
      data: {
        address: controllerImpl._address,
        contract: controllerImplData.contract,
        description: controllerImplData.description
      }
    }
  ]);

  return { world, controllerImpl, controllerImplData };
}
