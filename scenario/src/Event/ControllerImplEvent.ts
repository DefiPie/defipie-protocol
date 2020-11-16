import { Event } from '../Event';
import { addAction, World } from '../World';
import { ControllerImpl } from '../Contract/ControllerImpl';
import { Unitroller } from '../Contract/Unitroller';
import { invoke } from '../Invokation';
import { getAddressV, getArrayV, getEventV, getNumberV, getStringV } from '../CoreValue';
import { ArrayV, AddressV, EventV, NumberV, StringV } from '../Value';
import { Arg, Command, View, processCommandEvent } from '../Command';
import { buildControllerImpl } from '../Builder/ControllerImplBuilder';
import { ControllerErrorReporter } from '../ErrorReporter';
import { getControllerImpl, getControllerImplData, getUnitroller } from '../ContractLookup';
import { verify } from '../Verify';
import { mergeContractABI } from '../Networks';
import { encodedNumber } from '../Encoding';

async function genControllerImpl(world: World, from: string, params: Event): Promise<World> {
  let { world: nextWorld, controllerImpl, controllerImplData } = await buildControllerImpl(
    world,
    from,
    params
  );
  world = nextWorld;

  world = addAction(
    world,
    `Added Controller Implementation (${controllerImplData.description}) at address ${controllerImpl._address}`,
    controllerImplData.invokation
  );

  return world;
}

async function mergeABI(
  world: World,
  from: string,
  controllerImpl: ControllerImpl,
  unitroller: Unitroller
): Promise<World> {
  if (!world.dryRun) {
    // Skip this specifically on dry runs since it's likely to crash due to a number of reasons
    world = await mergeContractABI(world, 'Controller', unitroller, unitroller.name, controllerImpl.name);
  }

  return world;
}

// Recome calls `become` on the G1 Controller, but passes a flag to not modify any of the initialization variables.
async function recome(
  world: World,
  from: string,
  controllerImpl: ControllerImpl,
  unitroller: Unitroller
): Promise<World> {
  let invokation = await invoke(
    world,
    controllerImpl.methods._become(
      unitroller._address,
      0,
      []
    ),
    from,
    ControllerErrorReporter
  );

  world = await mergeContractABI(world, 'Controller', unitroller, unitroller.name, controllerImpl.name);

  world = addAction(world, `Recome ${unitroller._address}'s Controller Impl`, invokation);

  return world;
}

async function become(
  world: World,
  from: string,
  controllerImpl: ControllerImpl,
  unitroller: Unitroller,
  pieRate: encodedNumber,
  pieMarkets: string[]
): Promise<World> {
  let invokation = await invoke(
    world,
    controllerImpl.methods._become(unitroller._address, pieRate, pieMarkets),
    from,
    ControllerErrorReporter
  );

  if (!world.dryRun) {
    // Skip this specifically on dry runs since it's likely to crash due to a number of reasons
    world = await mergeContractABI(world, 'Controller', unitroller, unitroller.name, controllerImpl.name);
  }

  world = addAction(world, `Become ${unitroller._address}'s Controller Impl`, invokation);

  return world;
}

async function verifyControllerImpl(
  world: World,
  controllerImpl: ControllerImpl,
  name: string,
  contract: string,
  apiKey: string
): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, name, contract, controllerImpl._address);
  }

  return world;
}

export function controllerImplCommands() {
  return [
    new Command<{ controllerImplParams: EventV }>(
      `
        #### Deploy

        * "ControllerImpl Deploy ...controllerImplParams" - Generates a new Controller Implementation
          * E.g. "ControllerImpl Deploy MyScen Scenario"
      `,
      'Deploy',
      [new Arg('controllerImplParams', getEventV, { variadic: true })],
      (world, from, { controllerImplParams }) => genControllerImpl(world, from, controllerImplParams.val)
    ),
    new View<{ controllerImplArg: StringV; apiKey: StringV }>(
      `
        #### Verify

        * "ControllerImpl <Impl> Verify apiKey:<String>" - Verifies Controller Implemetation in Etherscan
          * E.g. "ControllerImpl Verify "myApiKey"
      `,
      'Verify',
      [new Arg('controllerImplArg', getStringV), new Arg('apiKey', getStringV)],
      async (world, { controllerImplArg, apiKey }) => {
        let [controllerImpl, name, data] = await getControllerImplData(world, controllerImplArg.val);

        return await verifyControllerImpl(world, controllerImpl, name, data.get('contract')!, apiKey.val);
      },
      { namePos: 1 }
    ),

    new Command<{
      unitroller: Unitroller;
      controllerImpl: ControllerImpl;
      pieRate: NumberV;
      pieMarkets: ArrayV<AddressV>;
    }>(
      `
        #### Become

        * "ControllerImpl <Impl> Become <Rate> <PieMarkets>" - Become the controller, if possible.
          * E.g. "ControllerImpl MyImpl Become 0.1e18 [pDAI, pETH, pUSDC]
      `,
      'Become',
      [
        new Arg('unitroller', getUnitroller, { implicit: true }),
        new Arg('controllerImpl', getControllerImpl),
        new Arg('pieRate', getNumberV, { default: new NumberV(1e18) }),
        new Arg('pieMarkets', getArrayV(getAddressV),  {default: new ArrayV([]) })
      ],
      (world, from, { unitroller, controllerImpl, pieRate, pieMarkets }) => {
        return become(world, from, controllerImpl, unitroller, pieRate.encode(), pieMarkets.val.map(a => a.val))
      },
      { namePos: 1 }
    ),

    new Command<{
      unitroller: Unitroller;
      controllerImpl: ControllerImpl;
    }>(
      `
        #### MergeABI

        * "ControllerImpl <Impl> MergeABI" - Merges the ABI, as if it was a become.
          * E.g. "ControllerImpl MyImpl MergeABI
      `,
      'MergeABI',
      [
        new Arg('unitroller', getUnitroller, { implicit: true }),
        new Arg('controllerImpl', getControllerImpl)
      ],
      (world, from, { unitroller, controllerImpl }) => mergeABI(world, from, controllerImpl, unitroller),
      { namePos: 1 }
    ),
    new Command<{ unitroller: Unitroller; controllerImpl: ControllerImpl }>(
      `
        #### Recome

        * "ControllerImpl <Impl> Recome" - Recome the controller
          * E.g. "ControllerImpl MyImpl Recome
      `,
      'Recome',
      [
        new Arg('unitroller', getUnitroller, { implicit: true }),
        new Arg('controllerImpl', getControllerImpl)
      ],
      (world, from, { unitroller, controllerImpl }) => recome(world, from, controllerImpl, unitroller),
      { namePos: 1 }
    )
  ];
}

export async function processControllerImplEvent(
  world: World,
  event: Event,
  from: string | null
): Promise<World> {
  return await processCommandEvent<any>('ControllerImpl', controllerImplCommands(), world, event, from);
}
