import { Event } from '../Event';
import { addAction, describeUser, World } from '../World';
import { VotingEscrow } from '../Contract/VotingEscrow';
import { invoke, Sendable } from '../Invokation';
import { getVotingEscrow } from '../ContractLookup';
import {
  getAddressV,
  getEventV,
  getNumberV,
} from '../CoreValue';
import {
  AddressV,
  EventV,
  NumberV,
} from '../Value';
import { Arg, Command, View, processCommandEvent } from '../Command';
import {NoErrorReporter, PTokenErrorReporter} from '../ErrorReporter';
import { buildVotingEscrow } from '../Builder/VotingEscrowBuilder';

function showTrxValue(world: World): string {
  return new NumberV(world.trxInvokationOpts.get('value')).show();
}

async function genVotingEscrow(world: World, from: string, event: Event): Promise<World> {
  let { world: nextWorld, votingEscrow, veData } = await buildVotingEscrow(world, from, event);
  world = nextWorld;

  world = addAction(
    world,
    `Added VotingEscrow (${veData.description}) at address ${votingEscrow._address}`,
    veData.invokation
  );

  return world;
}

async function createLock(
  world: World,
  from: string,
  votingEscrow: VotingEscrow,
  amount: NumberV,
  duration: NumberV
): Promise<World> {
  return addAction(
    world,
    `Create lock from ${from}`,
    await invoke(world, votingEscrow.methods.createLock(amount.encode(), duration.encode()), from, NoErrorReporter)
  );
}

async function depositFor(
  world: World,
  from: string,
  votingEscrow: VotingEscrow,
  user: string,
  amount: NumberV,
): Promise<World> {
  return addAction(
    world,
    `Create lock from ${from}`,
    await invoke(world, votingEscrow.methods.depositFor(user, amount.encode()), from, NoErrorReporter)
  );
}

async function delegate(
  world: World,
  from: string,
  votingEscrow: VotingEscrow,
  user: string
): Promise<World> {
  return addAction(
    world,
    `Create lock from ${from}`,
    await invoke(world, votingEscrow.methods.delegate(user), from, NoErrorReporter)
  );
}

async function withdraw(
  world: World,
  from: string,
  votingEscrow: VotingEscrow,
): Promise<World> {
  return addAction(
    world,
    `Create lock from ${from}`,
    await invoke(world, votingEscrow.methods.withdraw(), from, NoErrorReporter)
  );
}


export function votingEscrowCommands() {
  return [
    new Command<{veData: EventV}>(`
      #### Deploy
    
      * "VotingEscrow Deploy ...VotingEscrow" - Generates a new VotingEscrow
      * E.g. "VotingEscrow Deploy ..."
      `,
      "Deploy",
      [
        new Arg("veData", getEventV, {variadic: true})
      ],
      (world, from, {veData}) => genVotingEscrow(world, from, veData.val)
    ),
    new Command<{ votingEscrow: VotingEscrow , amount: NumberV; duration: NumberV }>(
       `
         #### CreateLock

         * "CreateLock <amount> <duration>" 
         * E.g. "VotingEscrow CreateLock 100 100"
     `,
       'CreateLock',
       [
        new Arg('votingEscrow', getVotingEscrow, { implicit: true }),
        new Arg('amount', getNumberV), 
        new Arg('duration', getNumberV)
      ],
       (world, from, { votingEscrow, amount, duration }) => createLock(world, from, votingEscrow, amount, duration)
     ),
     new Command<{ votingEscrow: VotingEscrow, user: AddressV, amount: NumberV }>(
      `
        #### DepositFor

        * "DepositFor <amount> <duration>" 
        * E.g. "VotingEscrow DepositFor Root 100"
    `,
      'DepositFor',
      [
        new Arg('votingEscrow', getVotingEscrow, { implicit: true }),
        new Arg('user', getAddressV),
        new Arg('amount', getNumberV)
      ], 
      (world, from, { votingEscrow, user, amount }) => depositFor(world, from, votingEscrow, user.val, amount)
    ),
     new Command<{ votingEscrow: VotingEscrow , user: AddressV}>(
      `
        #### delegate

        * "delegate <Address>"
        * E.g. "VotingEscrow delegate \"0x0000000000000000000000000000000000000000\""
    `,
      'delegate',
      [
        new Arg('votingEscrow', getVotingEscrow, { implicit: true }),
        new Arg('user', getAddressV)
      ],
      (world, from, { votingEscrow, user }) => delegate(world, from, votingEscrow, user.val)
    ),
    new Command<{ votingEscrow: VotingEscrow }>(
      `
        #### delegate

        * "withdraw"
        * E.g. "VotingEscrow withdraw"
    `,
      'withdraw',
      [
        new Arg('votingEscrow', getVotingEscrow, { implicit: true })
      ],
      (world, from, { votingEscrow }) => withdraw(world, from, votingEscrow)
    )
  ];
}

export async function processVotingEscrowEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("VotingEscrow", votingEscrowCommands(), world, event, from);
}
