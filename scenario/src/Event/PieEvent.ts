import { Event } from '../Event';
import { addAction, World } from '../World';
import { Pie, PieScenario } from '../Contract/Pie';
import { buildPie } from '../Builder/PieBuilder';
import { invoke } from '../Invokation';
import {
  getAddressV,
  getEventV,
  getNumberV,
  getStringV,
} from '../CoreValue';
import {
  AddressV,
  EventV,
  NumberV,
  StringV
} from '../Value';
import { Arg, Command, processCommandEvent, View } from '../Command';
import { getPie } from '../ContractLookup';
import { NoErrorReporter } from '../ErrorReporter';
import { verify } from '../Verify';

async function genPie(world: World, from: string, params: Event): Promise<World> {
  let { world: nextWorld, pie, tokenData } = await buildPie(world, from, params);
  world = nextWorld;

  world = addAction(
    world,
    `Deployed Pie (${pie.name}) to address ${pie._address}`,
    tokenData.invokation
  );

  return world;
}

async function verifyPie(world: World, pie: Pie, apiKey: string, modelName: string, contractName: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, modelName, contractName, pie._address);
  }

  return world;
}

async function approve(world: World, from: string, pie: Pie, address: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, pie.methods.approve(address, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Approved Pie token for ${from} of ${amount.show()}`,
    invokation
  );

  return world;
}

async function transfer(world: World, from: string, pie: Pie, address: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, pie.methods.transfer(address, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} Pie tokens from ${from} to ${address}`,
    invokation
  );

  return world;
}

async function transferFrom(world: World, from: string, pie: Pie, owner: string, spender: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, pie.methods.transferFrom(owner, spender, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `"Transferred from" ${amount.show()} Pie tokens from ${owner} to ${spender}`,
    invokation
  );

  return world;
}

async function transferScenario(world: World, from: string, pie: PieScenario, addresses: string[], amount: NumberV): Promise<World> {
  let invokation = await invoke(world, pie.methods.transferScenario(addresses, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} Pie tokens from ${from} to ${addresses}`,
    invokation
  );

  return world;
}

async function transferFromScenario(world: World, from: string, pie: PieScenario, addresses: string[], amount: NumberV): Promise<World> {
  let invokation = await invoke(world, pie.methods.transferFromScenario(addresses, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} Pie tokens from ${addresses} to ${from}`,
    invokation
  );

  return world;
}

async function setBlockNumber(
  world: World,
  from: string,
  pie: Pie,
  blockNumber: NumberV
): Promise<World> {
  return addAction(
    world,
    `Set Pie blockNumber to ${blockNumber.show()}`,
    await invoke(world, pie.methods.setBlockNumber(blockNumber.encode()), from)
  );
}

export function pieCommands() {
  return [
    new Command<{ params: EventV }>(`
        #### Deploy

        * "Deploy ...params" - Generates a new Pie token
          * E.g. "Pie Deploy"
      `,
      "Deploy",
      [
        new Arg("params", getEventV, { variadic: true })
      ],
      (world, from, { params }) => genPie(world, from, params.val)
    ),

    new View<{ pie: Pie, apiKey: StringV, contractName: StringV }>(`
        #### Verify

        * "<Pie> Verify apiKey:<String> contractName:<String>=Pie" - Verifies Pie token in Etherscan
          * E.g. "Pie Verify "myApiKey"
      `,
      "Verify",
      [
        new Arg("pie", getPie, { implicit: true }),
        new Arg("apiKey", getStringV),
        new Arg("contractName", getStringV, { default: new StringV("Pie") })
      ],
      async (world, { pie, apiKey, contractName }) => {
        return await verifyPie(world, pie, apiKey.val, pie.name, contractName.val)
      }
    ),

    new Command<{ pie: Pie, spender: AddressV, amount: NumberV }>(`
        #### Approve

        * "Pie Approve spender:<Address> <Amount>" - Adds an allowance between user and address
          * E.g. "Pie Approve Geoff 1.0e18"
      `,
      "Approve",
      [
        new Arg("pie", getPie, { implicit: true }),
        new Arg("spender", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { pie, spender, amount }) => {
        return approve(world, from, pie, spender.val, amount)
      }
    ),

    new Command<{ pie: Pie, recipient: AddressV, amount: NumberV }>(`
        #### Transfer

        * "Pie Transfer recipient:<User> <Amount>" - Transfers a number of tokens via "transfer" as given user to recipient (this does not depend on allowance)
          * E.g. "Pie Transfer Torrey 1.0e18"
      `,
      "Transfer",
      [
        new Arg("pie", getPie, { implicit: true }),
        new Arg("recipient", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { pie, recipient, amount }) => transfer(world, from, pie, recipient.val, amount)
    ),

    new Command<{ pie: Pie, owner: AddressV, spender: AddressV, amount: NumberV }>(`
        #### TransferFrom

        * "Pie TransferFrom owner:<User> spender:<User> <Amount>" - Transfers a number of tokens via "transfeFrom" to recipient (this depends on allowances)
          * E.g. "Pie TransferFrom Geoff Torrey 1.0e18"
      `,
      "TransferFrom",
      [
        new Arg("pie", getPie, { implicit: true }),
        new Arg("owner", getAddressV),
        new Arg("spender", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { pie, owner, spender, amount }) => transferFrom(world, from, pie, owner.val, spender.val, amount)
    ),

    new Command<{ pie: PieScenario, recipients: AddressV[], amount: NumberV }>(`
        #### TransferScenario

        * "Pie TransferScenario recipients:<User[]> <Amount>" - Transfers a number of tokens via "transfer" to the given recipients (this does not depend on allowance)
          * E.g. "Pie TransferScenario (Jared Torrey) 10"
      `,
      "TransferScenario",
      [
        new Arg("pie", getPie, { implicit: true }),
        new Arg("recipients", getAddressV, { mapped: true }),
        new Arg("amount", getNumberV)
      ],
      (world, from, { pie, recipients, amount }) => transferScenario(world, from, pie, recipients.map(recipient => recipient.val), amount)
    ),

    new Command<{ pie: PieScenario, froms: AddressV[], amount: NumberV }>(`
        #### TransferFromScenario

        * "Pie TransferFromScenario froms:<User[]> <Amount>" - Transfers a number of tokens via "transferFrom" from the given users to msg.sender (this depends on allowance)
          * E.g. "Pie TransferFromScenario (Jared Torrey) 10"
      `,
      "TransferFromScenario",
      [
        new Arg("pie", getPie, { implicit: true }),
        new Arg("froms", getAddressV, { mapped: true }),
        new Arg("amount", getNumberV)
      ],
      (world, from, { pie, froms, amount }) => transferFromScenario(world, from, pie, froms.map(_from => _from.val), amount)
    ),

    new Command<{ pie: Pie, blockNumber: NumberV }>(`
      #### SetBlockNumber

      * "SetBlockNumber <Seconds>" - Sets the blockTimestamp of the Pie Harness
      * E.g. "Pie SetBlockNumber 500"
      `,
        'SetBlockNumber',
        [new Arg('pie', getPie, { implicit: true }), new Arg('blockNumber', getNumberV)],
        (world, from, { pie, blockNumber }) => setBlockNumber(world, from, pie, blockNumber)
      )
  ];
}

export async function processPieEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("Pie", pieCommands(), world, event, from);
}
