import { Event } from '../Event';
import { addAction, World } from '../World';
import { DistributorProxy } from '../Contract/DistributorProxy';
import { invoke } from '../Invokation';
import { getAddressV, getEventV, getNumberV, getStringV } from '../CoreValue';
import { AddressV, EventV, NumberV, StringV } from '../Value';
import { Arg, Command, processCommandEvent } from '../Command';
import { buildDistributorProxy } from '../Builder/DistributorProxyBuilder';
import {DistributorErrorReporter} from '../ErrorReporter';
import {getDistributorProxy} from '../ContractLookup';
import {getPTokenV} from '../Value/PTokenValue';
import {PToken} from '../Contract/PToken';

async function genDistributorProxy(world: World, from: string, params: Event): Promise<World> {
  let { world: nextWorld, distributorProxy, distributorProxyData } = await buildDistributorProxy(
    world,
    from,
    params
  );
  world = nextWorld;

  world = addAction(
    world,
    `Added Distributor Proxy (${distributorProxyData.description}) at address ${distributorProxy._address}`,
    distributorProxyData.invokation
  );

  return world;
}

async function setImplementation(
  world: World,
  from: string,
  distributorProxy: DistributorProxy,
  newImplementation: string
): Promise<World> {
  let invokation = await invoke(
    world,
    distributorProxy.methods._setDistributorImplementation(newImplementation),
    from,
    DistributorErrorReporter
  );

  world = addAction(world, `Called set new Implementation ${newImplementation} for Distributor`, invokation);

  return world;
}

async function setPieRate(world: World, from: string, distributorProxy: DistributorProxy, rate: NumberV): Promise<World> {
  let invokation = await invoke(world, distributorProxy.methods._setPieRate(rate.encode()), from, DistributorErrorReporter);

  world = addAction(
      world,
      `Pie rate set to ${rate.show()}`,
      invokation
  );

  return world;
}

async function setPieSpeed(world: World, from: string, distributorProxy: DistributorProxy, pToken: PToken, speed: NumberV): Promise<World> {
    let invokation = await invoke(world, distributorProxy.methods._setPieSpeed(pToken._address, speed.encode()), from, DistributorErrorReporter);

    world = addAction(
        world,
        `Pie speed for market ${pToken._address} set to ${speed.show()}`,
        invokation
    );

    return world;
}

async function refreshPieSpeeds(world: World, from: string, distributorProxy: DistributorProxy): Promise<World> {
  let invokation = await invoke(world, distributorProxy.methods.harnessRefreshPieSpeeds(), from, DistributorErrorReporter);

  world = addAction(
    world,
    `Refreshed PIE speeds`,
    invokation
  );

  return world;
}

async function claimPie(world: World, from: string, distributorProxy: DistributorProxy, holder: string): Promise<World> {
  let invokation = await invoke(world, distributorProxy.methods.claimPie(holder), from, DistributorErrorReporter);

  world = addAction(
    world,
    `Pie claimed by ${holder}`,
    invokation
  );

  return world;
}

async function setPieAddress(world: World, from: string, distributorProxy: DistributorProxy, pie: string): Promise<World> {
  let invokation = await invoke(world, distributorProxy.methods._setPieAddress(pie), from, DistributorErrorReporter);

  world = addAction(
      world,
      `Pie address set to ${pie}`,
      invokation
  );

  return world;
}

async function fastForward(world: World, from: string, distributorProxy: DistributorProxy, blocks: NumberV): Promise<World> {
  let invokation = await invoke(world, distributorProxy.methods.fastForward(blocks.encode()), from, DistributorErrorReporter);

  world = addAction(
      world,
      `Fast forward ${blocks.show()} blocks to #${invokation.value}`,
      invokation
  );

  return world;
}

export function distributorProxyCommands() {
  return [
    new Command<{ distributorProxyParams: EventV }>(`
      #### Deploy

      * "DistributorProxy Deploy ...distributorProxyParams" - Generates a new Distributor Proxy
      * E.g. "DistributorProxy Deploy"
      `,
      'Deploy',
      [new Arg('distributorProxyParams', getEventV, { variadic: true })],
      (world, from, { distributorProxyParams }) => genDistributorProxy(world, from, distributorProxyParams.val)
    ),
    new Command<{
      distributorProxy: DistributorProxy,
      newImplementation: AddressV;
    }>(`
      #### SetImplementation

      * "DistributorProxy SetImplementation newImplementation:<Address>" - SetImplementation the distributor, if possible.
      * E.g. "DistributorProxy SetImplementation 0x.."
      `,
      'SetImplementation',
      [
        new Arg('distributorProxy', getDistributorProxy, { implicit: true }),
        new Arg('newImplementation', getAddressV)
      ],
      (
          world,
          from,
          { distributorProxy, newImplementation}
      ) => setImplementation(world, from, distributorProxy, newImplementation.val)
    ),
    new Command<{distributorProxy: DistributorProxy, rate: NumberV}>(`
      #### SetPieRate

      * "DistributorProxy SetPieRate <rate>" - Sets PIE rate
      * E.g. "DistributorProxy SetPieRate 1e18
      `,
      "SetPieRate",
      [
        new Arg("distributorProxy", getDistributorProxy, {implicit: true}),
        new Arg("rate", getNumberV)
      ],
      (world, from, {distributorProxy, rate}) => setPieRate(world, from, distributorProxy, rate)
    ),
    new Command<{distributorProxy: DistributorProxy, pToken: PToken, speed: NumberV}>(`
      #### SetPieSpeed
      * "DistributorProxy SetPieSpeed <pToken> <rate>" - Sets PIE speed for market
      * E.g. "DistributorProxy SetPieSpeed pToken 1000
      `,
      "SetPieSpeed",
      [
          new Arg("distributorProxy", getDistributorProxy, {implicit: true}),
          new Arg("pToken", getPTokenV),
          new Arg("speed", getNumberV)
      ],
      (world, from, {distributorProxy, pToken, speed}) => setPieSpeed(world, from, distributorProxy, pToken, speed)
    ),
    new Command<{distributorProxy: DistributorProxy}>(`
      #### RefreshPieSpeeds

      * "DistributorProxy RefreshPieSpeeds" - Recalculates all the PIE market speeds
      * E.g. "DistributorProxy RefreshPieSpeeds
      `,
      "RefreshPieSpeeds",
      [
        new Arg("distributorProxy", getDistributorProxy, {implicit: true})
      ],
      (world, from, {distributorProxy}) => refreshPieSpeeds(world, from, distributorProxy)
    ),
    new Command<{distributorProxy: DistributorProxy, holder: AddressV}>(`
      #### ClaimPie

      * "DistributorProxy ClaimPie <holder>" - Claims pie
      * E.g. "DistributorProxy ClaimPie Geoff
      `,
      "ClaimPie",
      [
        new Arg("distributorProxy", getDistributorProxy, {implicit: true}),
        new Arg("holder", getAddressV)
      ],
      (world, from, {distributorProxy, holder}) => claimPie(world, from, distributorProxy, holder.val)
    ),
    new Command<{distributorProxy: DistributorProxy, pie: AddressV}>(`
      #### SetPieAddress

      * "DistributorProxy SetPieAddress <pie>" - Set pie address
      * E.g. "DistributorProxy SetPieAddress (Address Pie)
      `,
        "SetPieAddress",
        [
          new Arg("distributorProxy", getDistributorProxy, {implicit: true}),
          new Arg("pie", getAddressV)
        ],
        (world, from, {distributorProxy, pie}) => setPieAddress(world, from, distributorProxy, pie.val)
    ),
    new Command<{distributorProxy: DistributorProxy, blocks: NumberV, _keyword: StringV}>(`
        #### FastForward

        * "FastForward n:<Number> Blocks" - Moves the block number forward "n" blocks.
          * E.g. "DistributorProxy FastForward 5 Blocks" - Move block number forward 5 blocks.
      `,
        "FastForward",
        [
          new Arg("distributorProxy", getDistributorProxy, {implicit: true}),
          new Arg("blocks", getNumberV),
          new Arg("_keyword", getStringV)
        ],
        (world, from, {distributorProxy, blocks}) => fastForward(world, from, distributorProxy, blocks)
    ),
  ];
}

export async function processDistributorProxyEvent(
  world: World,
  event: Event,
  from: string | null
): Promise<World> {
  return await processCommandEvent<any>('DistributorProxy', distributorProxyCommands(), world, event, from);
}
