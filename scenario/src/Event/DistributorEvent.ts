import {Event} from '../Event';
import {addAction, describeUser, World} from '../World';
import {decodeCall, getPastEvents} from '../Contract';
import {Distributor} from '../Contract/Distributor';
import {PToken} from '../Contract/PToken';
import {invoke} from '../Invokation';
import {
  getAddressV,
  getEventV,
  getNumberV,
  getStringV,
  getCoreValue
} from '../CoreValue';
import {
  AddressV,
  EventV,
  NumberV,
  StringV
} from '../Value';
import {Arg, Command, View, processCommandEvent} from '../Command';
import {buildDistributor} from '../Builder/DistributorBuilder';
import {DistributorErrorReporter} from '../ErrorReporter';
import {getDistributor} from '../ContractLookup';
import {getPTokenV} from '../Value/PTokenValue';
import {encodeABI, rawValues} from "../Utils";

async function genDistributor(world: World, from: string, params: Event): Promise<World> {
  let {world: nextWorld, distributor: distributor, distributorData: distributorData} = await buildDistributor(world, from, params);
  world = nextWorld;

  world = addAction(
    world,
    `Added Distributor (${distributorData.description}) at address ${distributor._address}`,
    distributorData.invokation
  );

  return world;
}

async function setPieAddress(world: World, from: string, distributor: Distributor, pieAddress: string): Promise<World> {
    let invokation = await invoke(world, distributor.methods._setPieAddress(pieAddress), from, DistributorErrorReporter);

    world = addAction(
        world,
        `Set pie address for to ${pieAddress} as ${describeUser(world, from)}`,
        invokation
    );

    return world;
}

async function fastForward(world: World, from: string, distributor: Distributor, blocks: NumberV): Promise<World> {
  let invokation = await invoke(world, distributor.methods.fastForward(blocks.encode()), from, DistributorErrorReporter);

  world = addAction(
    world,
    `Fast forward ${blocks.show()} blocks to #${invokation.value}`,
    invokation
  );

  return world;
}

async function sendAny(world: World, from:string, distributor: Distributor, signature: string, callArgs: string[]): Promise<World> {
  const fnData = encodeABI(world, signature, callArgs);
  await world.web3.eth.sendTransaction({
      to: distributor._address,
      data: fnData,
      from: from
    });
  return world;
}

async function addPieMarkets(world: World, from: string, distributor: Distributor, pTokens: PToken[]): Promise<World> {
  let invokation = await invoke(world, distributor.methods._addPieMarkets(pTokens.map(c => c._address)), from, DistributorErrorReporter);

  world = addAction(
    world,
    `Added PIE markets ${pTokens.map(c => c.name)}`,
    invokation
  );

  return world;
}

async function dropPieMarket(world: World, from: string, distributor: Distributor, pToken: PToken): Promise<World> {
  let invokation = await invoke(world, distributor.methods._dropPieMarket(pToken._address), from, DistributorErrorReporter);

  world = addAction(
    world,
    `Drop PIE market ${pToken.name}`,
    invokation
  );

  return world;
}

async function refreshPieSpeeds(world: World, from: string, distributor: Distributor): Promise<World> {
  let invokation = await invoke(world, distributor.methods.harnessRefreshPieSpeeds(), from, DistributorErrorReporter);

  world = addAction(
    world,
    `Refreshed PIE speeds`,
    invokation
  );

  return world;
}

async function claimPie(world: World, from: string, distributor: Distributor, holder: string): Promise<World> {
  let invokation = await invoke(world, distributor.methods.claimPie(holder), from, DistributorErrorReporter);

  world = addAction(
    world,
    `Pie claimed by ${holder}`,
    invokation
  );

  return world;
}

async function setPieRate(world: World, from: string, distributor: Distributor, rate: NumberV): Promise<World> {
  let invokation = await invoke(world, distributor.methods._setPieRate(rate.encode()), from, DistributorErrorReporter);

  world = addAction(
    world,
    `Pie rate set to ${rate.show()}`,
    invokation
  );

  return world;
}

async function setPieSpeed(world: World, from: string, distributor: Distributor, pToken: PToken, speed: NumberV): Promise<World> {
    let invokation = await invoke(world, distributor.methods._setPieSpeed(pToken._address, speed.encode()), from, DistributorErrorReporter);

    world = addAction(
        world,
        `Pie speed for market ${pToken._address} set to ${speed.show()}`,
        invokation
    );

    return world;
}

export function distributorCommands() {
  return [
    new Command<{distributorParams: EventV}>(`
      #### Deploy
      * "Distributor Deploy ...distributorParams" - Generates a new Distributor
      * E.g. "Distributor Deploy ..."
      `,
      "Deploy",
      [new Arg("distributorParams", getEventV, {variadic: true})],
      (world, from, {distributorParams}) => genDistributor(world, from, distributorParams.val)
    ),
    new Command<{distributor: Distributor, pieAddress: AddressV}>(`
        #### SetPieAddress
    
        * "Distributor SetPieAddress:<Address>" - Sets the pie address
          * E.g. "Distributor SetPieAddress 0x..."
        `,
      "SetPieAddress",
      [
          new Arg("distributor", getDistributor, {implicit: true}),
          new Arg("pieAddress", getAddressV)
      ],
      (world, from, {distributor, pieAddress}) => setPieAddress(world, from, distributor, pieAddress.val)
    ),
    new Command<{distributor: Distributor, blocks: NumberV, _keyword: StringV}>(`
        #### FastForward

        * "FastForward n:<Number> Blocks" - Moves the block number forward "n" blocks. Note: in "PTokenScenario" and "DistributorScenario" the current block number is mocked (starting at 100000). This is the only way for the protocol to see a higher block number (for accruing interest).
          * E.g. "Distributor FastForward 5 Blocks" - Move block number forward 5 blocks.
      `,
      "FastForward",
      [
        new Arg("distributor", getDistributor, {implicit: true}),
        new Arg("blocks", getNumberV),
        new Arg("_keyword", getStringV)
      ],
      (world, from, {distributor, blocks}) => fastForward(world, from, distributor, blocks)
    ),
    new View<{distributor: Distributor, input: StringV}>(`
        #### Decode

        * "Decode input:<String>" - Prints information about a call to a Distributor contract
      `,
      "Decode",
      [
        new Arg("distributor", getDistributor, {implicit: true}),
        new Arg("input", getStringV)

      ],
      (world, {distributor, input}) => decodeCall(world, distributor, input.val)
    ),

    new Command<{distributor: Distributor, signature: StringV, callArgs: StringV[]}>(`
      #### Send
      * Distributor Send functionSignature:<String> callArgs[] - Sends any transaction to distributor
      * E.g: Distributor Send "setPieAddress(address)" (Address PIE)
      `,
      "Send",
      [
        new Arg("distributor", getDistributor, {implicit: true}),
        new Arg("signature", getStringV),
        new Arg("callArgs", getCoreValue, {variadic: true, mapped: true})
      ],
      (world, from, {distributor, signature, callArgs}) => sendAny(world, from, distributor, signature.val, rawValues(callArgs))
    ),
    new Command<{distributor: Distributor, pTokens: PToken[]}>(`
      #### AddPieMarkets

      * "Distributor AddPieMarkets (<Address> ...)" - Makes a market PIE-enabled
      * E.g. "Distributor AddPieMarkets (pZRX cBAT)
      `,
      "AddPieMarkets",
      [
        new Arg("distributor", getDistributor, {implicit: true}),
        new Arg("pTokens", getPTokenV, {mapped: true})
      ],
      (world, from, {distributor, pTokens}) => addPieMarkets(world, from, distributor, pTokens)
     ),
    new Command<{distributor: Distributor, pToken: PToken}>(`
      #### DropPieMarket

      * "Distributor DropPieMarket <Address>" - Makes a market PIE
      * E.g. "Distributor DropPieMarket pZRX
      `,
      "DropPieMarket",
      [
        new Arg("distributor", getDistributor, {implicit: true}),
        new Arg("pToken", getPTokenV)
      ],
      (world, from, {distributor, pToken}) => dropPieMarket(world, from, distributor, pToken)
     ),

    new Command<{distributor: Distributor}>(`
      #### RefreshPieSpeeds

      * "Distributor RefreshPieSpeeds" - Recalculates all the PIE market speeds
      * E.g. "Distributor RefreshPieSpeeds
      `,
      "RefreshPieSpeeds",
      [
        new Arg("distributor", getDistributor, {implicit: true})
      ],
      (world, from, {distributor}) => refreshPieSpeeds(world, from, distributor)
    ),
    new Command<{distributor: Distributor, holder: AddressV}>(`
      #### ClaimPie

      * "Distributor ClaimPie <holder>" - Claims pie
      * E.g. "Distributor ClaimPie Geoff
      `,
      "ClaimPie",
      [
        new Arg("distributor", getDistributor, {implicit: true}),
        new Arg("holder", getAddressV)
      ],
      (world, from, {distributor, holder}) => claimPie(world, from, distributor, holder.val)
    ),
    new Command<{distributor: Distributor, rate: NumberV}>(`
      #### SetPieRate

      * "Distributor SetPieRate <rate>" - Sets PIE rate
      * E.g. "Distributor SetPieRate 1e18
      `,
      "SetPieRate",
      [
        new Arg("distributor", getDistributor, {implicit: true}),
        new Arg("rate", getNumberV)
      ],
      (world, from, {distributor, rate}) => setPieRate(world, from, distributor, rate)
    ),
      new Command<{distributor: Distributor, pToken: PToken, speed: NumberV}>(`
      #### SetPieSpeed
      * "Distributor SetPieSpeed <pToken> <rate>" - Sets PIE speed for market
      * E.g. "Distributor SetPieSpeed pToken 1000
      `,
          "SetPieSpeed",
          [
              new Arg("distributor", getDistributor, {implicit: true}),
              new Arg("pToken", getPTokenV),
              new Arg("speed", getNumberV)
          ],
          (world, from, {distributor, pToken, speed}) => setPieSpeed(world, from, distributor, pToken, speed)
      ),
  ];
}

export async function processDistributorEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("Distributor", distributorCommands(), world, event, from);
}
