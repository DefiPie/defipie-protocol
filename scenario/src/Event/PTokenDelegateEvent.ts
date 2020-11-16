import { Event } from '../Event';
import { addAction, describeUser, World } from '../World';
import { PErc20Delegate } from '../Contract/PErc20Delegate';
import {
  getEventV,
  getStringV,
} from '../CoreValue';
import {
  EventV,
  StringV
} from '../Value';
import { Arg, Command, View, processCommandEvent } from '../Command';
import { getPTokenDelegateData } from '../ContractLookup';
import { buildPTokenDelegate } from '../Builder/PTokenDelegateBuilder';
import { verify } from '../Verify';

async function genPTokenDelegate(world: World, from: string, event: Event): Promise<World> {
  let { world: nextWorld, pTokenDelegate, delegateData } = await buildPTokenDelegate(world, from, event);
  world = nextWorld;

  world = addAction(
    world,
    `Added pToken ${delegateData.name} (${delegateData.contract}) at address ${pTokenDelegate._address}`,
    delegateData.invokation
  );

  return world;
}

async function verifyPTokenDelegate(world: World, pTokenDelegate: PErc20Delegate, name: string, contract: string, apiKey: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, name, contract, pTokenDelegate._address);
  }

  return world;
}

export function pTokenDelegateCommands() {
  return [
    new Command<{ pTokenDelegateParams: EventV }>(`
        #### Deploy

        * "PTokenDelegate Deploy ...pTokenDelegateParams" - Generates a new PTokenDelegate
          * E.g. "PTokenDelegate Deploy CDaiDelegate cDAIDelegate"
      `,
      "Deploy",
      [new Arg("pTokenDelegateParams", getEventV, { variadic: true })],
      (world, from, { pTokenDelegateParams }) => genPTokenDelegate(world, from, pTokenDelegateParams.val)
    ),
    new View<{ pTokenDelegateArg: StringV, apiKey: StringV }>(`
        #### Verify

        * "PTokenDelegate <pTokenDelegate> Verify apiKey:<String>" - Verifies PTokenDelegate in Etherscan
          * E.g. "PTokenDelegate pDaiDelegate Verify "myApiKey"
      `,
      "Verify",
      [
        new Arg("pTokenDelegateArg", getStringV),
        new Arg("apiKey", getStringV)
      ],
      async (world, { pTokenDelegateArg, apiKey }) => {
        let [pToken, name, data] = await getPTokenDelegateData(world, pTokenDelegateArg.val);

        return await verifyPTokenDelegate(world, pToken, name, data.get('contract')!, apiKey.val);
      },
      { namePos: 1 }
    ),
  ];
}

export async function processPTokenDelegateEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("PTokenDelegate", pTokenDelegateCommands(), world, event, from);
}
