import { Event } from '../Event';
import { addAction, describeUser, World } from '../World';
import { decodeCall, getPastEvents } from '../Contract';
import { PToken, PTokenScenario, PPie } from '../Contract/PToken';
import { PErc20Delegate } from '../Contract/PErc20Delegate'
import { PErc20Delegator } from '../Contract/PErc20Delegator'
import { invoke, Sendable } from '../Invokation';
import {
  getAddressV,
  getEventV,
  getExpNumberV,
  getNumberV,
  getStringV,
  getBoolV
} from '../CoreValue';
import {
  AddressV,
  BoolV,
  EventV,
  NothingV,
  NumberV,
  StringV
} from '../Value';
import { getContract } from '../Contract';
import { Arg, Command, View, processCommandEvent } from '../Command';
import {NoErrorReporter, PTokenErrorReporter} from '../ErrorReporter';
import {getController, getPTokenData} from '../ContractLookup';
import { buildPToken } from '../Builder/PTokenBuilder';
import { verify } from '../Verify';
import { getLiquidity } from '../Value/ControllerValue';
import { getPTokenV, getPErc20DelegatorV } from '../Value/PTokenValue';

function showTrxValue(world: World): string {
  return new NumberV(world.trxInvokationOpts.get('value')).show();
}

async function genPToken(world: World, from: string, event: Event): Promise<World> {
  let { world: nextWorld, pToken, tokenData } = await buildPToken(world, from, event);
  world = nextWorld;

  world = addAction(
    world,
    `Added pToken ${tokenData.name} (${tokenData.contract}<decimals=${tokenData.decimals}>) at address ${pToken._address}`,
    tokenData.invokation
  );

  return world;
}

async function accrueInterest(world: World, from: string, pToken: PToken): Promise<World> {
  let invokation = await invoke(world, pToken.methods.accrueInterest(), from, PTokenErrorReporter);

  world = addAction(
    world,
    `PToken ${pToken.name}: Interest accrued`,
    invokation
  );

  return world;
}

async function mint(world: World, from: string, pToken: PToken, amount: NumberV | NothingV): Promise<World> {
  let invokation;
  let showAmount;

  if (amount instanceof NumberV) {
    showAmount = amount.show();
    invokation = await invoke(world, pToken.methods.mint(amount.encode()), from, PTokenErrorReporter);
  } else {
    showAmount = showTrxValue(world);
    invokation = await invoke(world, pToken.methods.mint(), from, PTokenErrorReporter);
  }

  world = addAction(
    world,
    `PToken ${pToken.name}: ${describeUser(world, from)} mints ${showAmount}`,
    invokation
  );

  return world;
}

async function redeem(world: World, from: string, pToken: PToken, tokens: NumberV): Promise<World> {
  let invokation = await invoke(world, pToken.methods.redeem(tokens.encode()), from, PTokenErrorReporter);

  world = addAction(
    world,
    `PToken ${pToken.name}: ${describeUser(world, from)} redeems ${tokens.show()} tokens`,
    invokation
  );

  return world;
}

async function redeemUnderlying(world: World, from: string, pToken: PToken, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, pToken.methods.redeemUnderlying(amount.encode()), from, PTokenErrorReporter);

  world = addAction(
    world,
    `PToken ${pToken.name}: ${describeUser(world, from)} redeems ${amount.show()} underlying`,
    invokation
  );

  return world;
}

async function borrow(world: World, from: string, pToken: PToken, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, pToken.methods.borrow(amount.encode()), from, PTokenErrorReporter);

  world = addAction(
    world,
    `PToken ${pToken.name}: ${describeUser(world, from)} borrows ${amount.show()}`,
    invokation
  );

  return world;
}

async function repayBorrow(world: World, from: string, pToken: PToken, amount: NumberV | NothingV): Promise<World> {
  let invokation;
  let showAmount;

  if (amount instanceof NumberV) {
    showAmount = amount.show();
    invokation = await invoke(world, pToken.methods.repayBorrow(amount.encode()), from, PTokenErrorReporter);
  } else {
    showAmount = showTrxValue(world);
    invokation = await invoke(world, pToken.methods.repayBorrow(), from, PTokenErrorReporter);
  }

  world = addAction(
    world,
    `PToken ${pToken.name}: ${describeUser(world, from)} repays ${showAmount} of borrow`,
    invokation
  );

  return world;
}

async function repayBorrowBehalf(world: World, from: string, behalf: string, pToken: PToken, amount: NumberV | NothingV): Promise<World> {
  let invokation;
  let showAmount;

  if (amount instanceof NumberV) {
    showAmount = amount.show();
    invokation = await invoke(world, pToken.methods.repayBorrowBehalf(behalf, amount.encode()), from, PTokenErrorReporter);
  } else {
    showAmount = showTrxValue(world);
    invokation = await invoke(world, pToken.methods.repayBorrowBehalf(behalf), from, PTokenErrorReporter);
  }

  world = addAction(
    world,
    `PToken ${pToken.name}: ${describeUser(world, from)} repays ${showAmount} of borrow on behalf of ${describeUser(world, behalf)}`,
    invokation
  );

  return world;
}

async function liquidateBorrow(world: World, from: string, pToken: PToken, borrower: string, collateral: PToken, repayAmount: NumberV | NothingV): Promise<World> {
  let invokation;
  let showAmount;

  if (repayAmount instanceof NumberV) {
    showAmount = repayAmount.show();
    invokation = await invoke(world, pToken.methods.liquidateBorrow(borrower, repayAmount.encode(), collateral._address), from, PTokenErrorReporter);
  } else {
    showAmount = showTrxValue(world);
    invokation = await invoke(world, pToken.methods.liquidateBorrow(borrower, collateral._address), from, PTokenErrorReporter);
  }

  world = addAction(
    world,
    `PToken ${pToken.name}: ${describeUser(world, from)} liquidates ${showAmount} from of ${describeUser(world, borrower)}, seizing ${collateral.name}.`,
    invokation
  );

  return world;
}

async function seize(world: World, from: string, pToken: PToken, liquidator: string, borrower: string, seizeTokens: NumberV): Promise<World> {
  let invokation = await invoke(world, pToken.methods.seize(liquidator, borrower, seizeTokens.encode()), from, PTokenErrorReporter);

  world = addAction(
    world,
    `PToken ${pToken.name}: ${describeUser(world, from)} initiates seizing ${seizeTokens.show()} to ${describeUser(world, liquidator)} from ${describeUser(world, borrower)}.`,
    invokation
  );

  return world;
}

async function evilSeize(world: World, from: string, pToken: PToken, treasure: PToken, liquidator: string, borrower: string, seizeTokens: NumberV): Promise<World> {
  let invokation = await invoke(world, pToken.methods.evilSeize(treasure._address, liquidator, borrower, seizeTokens.encode()), from, PTokenErrorReporter);

  world = addAction(
    world,
    `PToken ${pToken.name}: ${describeUser(world, from)} initiates illegal seizing ${seizeTokens.show()} to ${describeUser(world, liquidator)} from ${describeUser(world, borrower)}.`,
    invokation
  );

  return world;
}

async function addReserves(world: World, from: string, pToken: PToken, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, pToken.methods._addReserves(amount.encode()), from, PTokenErrorReporter);

  world = addAction(
    world,
    `PToken ${pToken.name}: ${describeUser(world, from)} adds to reserves by ${amount.show()}`,
    invokation
  );

  return world;
}

async function reduceReserves(world: World, from: string, pToken: PToken, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, pToken.methods._reduceReserves(amount.encode()), from, PTokenErrorReporter);

  world = addAction(
    world,
    `PToken ${pToken.name}: ${describeUser(world, from)} reduces reserves by ${amount.show()}`,
    invokation
  );

  return world;
}

async function setReserveFactor(world: World, from: string, pToken: PToken, reserveFactor: NumberV): Promise<World> {
  let invokation = await invoke(world, pToken.methods._setReserveFactor(reserveFactor.encode()), from, PTokenErrorReporter);

  world = addAction(
    world,
    `PToken ${pToken.name}: ${describeUser(world, from)} sets reserve factor to ${reserveFactor.show()}`,
    invokation
  );

  return world;
}

async function setInterestRateModel(world: World, from: string, pToken: PToken, interestRateModel: string): Promise<World> {
  let invokation = await invoke(world, pToken.methods._setInterestRateModel(interestRateModel), from, PTokenErrorReporter);

  world = addAction(
    world,
    `Set interest rate for ${pToken.name} to ${interestRateModel} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function setController(world: World, from: string, pToken: PToken, controller: string): Promise<World> {
  let invokation = await invoke(world, pToken.methods._setController(controller), from, PTokenErrorReporter);

  world = addAction(
    world,
    `Set controller for ${pToken.name} to ${controller} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function becomeImplementation(
  world: World,
  from: string,
  pToken: PToken,
  becomeImplementationData: string
): Promise<World> {

  const pErc20Delegate = getContract('PErc20Delegate');
  const pErc20DelegateContract = await pErc20Delegate.at<PErc20Delegate>(world, pToken._address);

  let invokation = await invoke(
    world,
    pErc20DelegateContract.methods._becomeImplementation(becomeImplementationData),
    from,
    PTokenErrorReporter
  );

  world = addAction(
    world,
    `PToken ${pToken.name}: ${describeUser(
      world,
      from
    )} initiates _becomeImplementation with data:${becomeImplementationData}.`,
    invokation
  );

  return world;
}

async function resignImplementation(
  world: World,
  from: string,
  pToken: PToken,
): Promise<World> {

  const pErc20Delegate = getContract('PErc20Delegate');
  const pErc20DelegateContract = await pErc20Delegate.at<PErc20Delegate>(world, pToken._address);

  let invokation = await invoke(
    world,
    pErc20DelegateContract.methods._resignImplementation(),
    from,
    PTokenErrorReporter
  );

  world = addAction(
    world,
    `PToken ${pToken.name}: ${describeUser(
      world,
      from
    )} initiates _resignImplementation.`,
    invokation
  );

  return world;
}

async function setImplementation(
  world: World,
  from: string,
  pToken: PErc20Delegator,
  implementation: string,
  allowResign: boolean,
  becomeImplementationData: string
): Promise<World> {
  let invokation = await invoke(
    world,
    pToken.methods._setImplementation(
      implementation,
      allowResign,
      becomeImplementationData
    ),
    from,
    PTokenErrorReporter
  );

  world = addAction(
    world,
    `PToken ${pToken.name}: ${describeUser(
      world,
      from
    )} initiates setImplementation with implementation:${implementation} allowResign:${allowResign} data:${becomeImplementationData}.`,
    invokation
  );

  return world;
}

async function donate(world: World, from: string, pToken: PToken): Promise<World> {
  let invokation = await invoke(world, pToken.methods.donate(), from, PTokenErrorReporter);

  world = addAction(
    world,
    `Donate for ${pToken.name} as ${describeUser(world, from)} with value ${showTrxValue(world)}`,
    invokation
  );

  return world;
}

async function delegate(world: World, from: string, pToken: PToken, account: string): Promise<World> {
    let invokation = await invoke(world, pToken.methods.delegate(account), from, NoErrorReporter);

    world = addAction(
        world,
        `"Delegated from" ${from} to ${account}`,
        invokation
    );

    return world;
}

async function transferScenario(world: World, from: string, pToken: PToken, addresses: string[], amount: NumberV): Promise<World> {
    let invokation = await invoke(world, pToken.methods.transferScenario(addresses, amount.encode()), from, NoErrorReporter);

    world = addAction(
        world,
        `Transferred ${amount.show()} PPie tokens from ${from} to ${addresses}`,
        invokation
    );

    return world;
}

async function transferFromScenario(world: World, from: string, pToken: PToken, addresses: string[], amount: NumberV): Promise<World> {
    let invokation = await invoke(world, pToken.methods.transferFromScenario(addresses, amount.encode()), from, NoErrorReporter);

    world = addAction(
        world,
        `Transferred ${amount.show()} PPie tokens from ${addresses} to ${from}`,
        invokation
    );

    return world;
}

async function transfer(world: World, from: string, pToken: PToken, address: string, amount: NumberV): Promise<World> {
    let invokation = await invoke(world, pToken.methods.transfer(address, amount.encode()), from, NoErrorReporter);

    world = addAction(
        world,
        `Transferred ${amount.show()} pPie tokens from ${from} to ${address}`,
        invokation
    );

    return world;
}

async function setPTokenMock(world: World, from: string, pToken: PTokenScenario, mock: string, value: NumberV): Promise<World> {
  let mockMethod: (number) => Sendable<void>;

  switch (mock.toLowerCase()) {
    case "totalborrows":
      mockMethod = pToken.methods.setTotalBorrows;
      break;
    case "totalreserves":
      mockMethod = pToken.methods.setTotalReserves;
      break;
    default:
      throw new Error(`Mock "${mock}" not defined for pToken`);
  }

  let invokation = await invoke(world, mockMethod(value.encode()), from);

  world = addAction(
    world,
    `Mocked ${mock}=${value.show()} for ${pToken.name}`,
    invokation
  );

  return world;
}

async function verifyPToken(world: World, pToken: PToken, name: string, contract: string, apiKey: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, name, contract, pToken._address);
  }

  return world;
}

async function printMinters(world: World, pToken: PToken): Promise<World> {
  let events = await getPastEvents(world, pToken, pToken.name, 'Mint');
  let addresses = events.map((event) => event.returnValues['minter']);
  let uniq = [...new Set(addresses)];

  world.printer.printLine("Minters:")

  uniq.forEach((address) => {
    world.printer.printLine(`\t${address}`)
  });

  return world;
}

async function printBorrowers(world: World, pToken: PToken): Promise<World> {
  let events = await getPastEvents(world, pToken, pToken.name, 'Borrow');
  let addresses = events.map((event) => event.returnValues['borrower']);
  let uniq = [...new Set(addresses)];

  world.printer.printLine("Borrowers:")

  uniq.forEach((address) => {
    world.printer.printLine(`\t${address}`)
  });

  return world;
}

async function printLiquidity(world: World, pToken: PToken): Promise<World> {
  let mintEvents = await getPastEvents(world, pToken, pToken.name, 'Mint');
  let mintAddresses = mintEvents.map((event) => event.returnValues['minter']);
  let borrowEvents = await getPastEvents(world, pToken, pToken.name, 'Borrow');
  let borrowAddresses = borrowEvents.map((event) => event.returnValues['borrower']);
  let uniq = [...new Set(mintAddresses.concat(borrowAddresses))];
  let controller = await getController(world);

  world.printer.printLine("Liquidity:")

  const liquidityMap = await Promise.all(uniq.map(async (address) => {
    let userLiquidity = await getLiquidity(world, controller, address);

    return [address, userLiquidity.val];
  }));

  liquidityMap.forEach(([address, liquidity]) => {
    world.printer.printLine(`\t${world.settings.lookupAlias(address)}: ${liquidity / 1e18}e18`)
  });

  return world;
}

export function pTokenCommands() {
  return [
    new Command<{ pTokenParams: EventV }>(`
        #### Deploy

        * "PToken Deploy ...pTokenParams" - Generates a new PToken
          * E.g. "PToken pZRX Deploy"
      `,
      "Deploy",
      [new Arg("pTokenParams", getEventV, { variadic: true })],
      (world, from, { pTokenParams }) => genPToken(world, from, pTokenParams.val)
    ),
    new View<{ pTokenArg: StringV, apiKey: StringV }>(`
        #### Verify

        * "PToken <pToken> Verify apiKey:<String>" - Verifies PToken in Etherscan
          * E.g. "PToken pZRX Verify "myApiKey"
      `,
      "Verify",
      [
        new Arg("pTokenArg", getStringV),
        new Arg("apiKey", getStringV)
      ],
      async (world, { pTokenArg, apiKey }) => {
        let [pToken, name, data] = await getPTokenData(world, pTokenArg.val);

        return await verifyPToken(world, pToken, name, data.get('contract')!, apiKey.val);
      },
      { namePos: 1 }
    ),
    new Command<{ pToken: PToken }>(`
        #### AccrueInterest

        * "PToken <pToken> AccrueInterest" - Accrues interest for given token
          * E.g. "PToken pZRX AccrueInterest"
      `,
      "AccrueInterest",
      [
        new Arg("pToken", getPTokenV)
      ],
      (world, from, { pToken }) => accrueInterest(world, from, pToken),
      { namePos: 1 }
    ),
    new Command<{ pToken: PToken, amount: NumberV | NothingV }>(`
        #### Mint

        * "PToken <pToken> Mint amount:<Number>" - Mints the given amount of pToken as specified user
          * E.g. "PToken pZRX Mint 1.0e18"
      `,
      "Mint",
      [
        new Arg("pToken", getPTokenV),
        new Arg("amount", getNumberV, { nullable: true })
      ],
      (world, from, { pToken, amount }) => mint(world, from, pToken, amount),
      { namePos: 1 }
    ),
    new Command<{ pToken: PToken, tokens: NumberV }>(`
        #### Redeem

        * "PToken <pToken> Redeem tokens:<Number>" - Redeems the given amount of pTokens as specified user
          * E.g. "PToken pZRX Redeem 1.0e9"
      `,
      "Redeem",
      [
        new Arg("pToken", getPTokenV),
        new Arg("tokens", getNumberV)
      ],
      (world, from, { pToken, tokens }) => redeem(world, from, pToken, tokens),
      { namePos: 1 }
    ),
    new Command<{ pToken: PToken, amount: NumberV }>(`
        #### RedeemUnderlying

        * "PToken <pToken> RedeemUnderlying amount:<Number>" - Redeems the given amount of underlying as specified user
          * E.g. "PToken pZRX RedeemUnderlying 1.0e18"
      `,
      "RedeemUnderlying",
      [
        new Arg("pToken", getPTokenV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { pToken, amount }) => redeemUnderlying(world, from, pToken, amount),
      { namePos: 1 }
    ),
    new Command<{ pToken: PToken, amount: NumberV }>(`
        #### Borrow

        * "PToken <pToken> Borrow amount:<Number>" - Borrows the given amount of this pToken as specified user
          * E.g. "PToken pZRX Borrow 1.0e18"
      `,
      "Borrow",
      [
        new Arg("pToken", getPTokenV),
        new Arg("amount", getNumberV)
      ],
      // Note: we override from
      (world, from, { pToken, amount }) => borrow(world, from, pToken, amount),
      { namePos: 1 }
    ),
    new Command<{ pToken: PToken, amount: NumberV | NothingV }>(`
        #### RepayBorrow

        * "PToken <pToken> RepayBorrow underlyingAmount:<Number>" - Repays borrow in the given underlying amount as specified user
          * E.g. "PToken pZRX RepayBorrow 1.0e18"
      `,
      "RepayBorrow",
      [
        new Arg("pToken", getPTokenV),
        new Arg("amount", getNumberV, { nullable: true })
      ],
      (world, from, { pToken, amount }) => repayBorrow(world, from, pToken, amount),
      { namePos: 1 }
    ),
    new Command<{ pToken: PToken, behalf: AddressV, amount: NumberV | NothingV }>(`
        #### RepayBorrowBehalf

        * "PToken <pToken> RepayBorrowBehalf behalf:<User> underlyingAmount:<Number>" - Repays borrow in the given underlying amount on behalf of another user
          * E.g. "PToken pZRX RepayBorrowBehalf Geoff 1.0e18"
      `,
      "RepayBorrowBehalf",
      [
        new Arg("pToken", getPTokenV),
        new Arg("behalf", getAddressV),
        new Arg("amount", getNumberV, { nullable: true })
      ],
      (world, from, { pToken, behalf, amount }) => repayBorrowBehalf(world, from, behalf.val, pToken, amount),
      { namePos: 1 }
    ),
    new Command<{ borrower: AddressV, pToken: PToken, collateral: PToken, repayAmount: NumberV | NothingV }>(`
        #### Liquidate

        * "PToken <pToken> Liquidate borrower:<User> pTokenCollateral:<Address> repayAmount:<Number>" - Liquidates repayAmount of given token seizing collateral token
          * E.g. "PToken pZRX Liquidate Geoff pBAT 1.0e18"
      `,
      "Liquidate",
      [
        new Arg("pToken", getPTokenV),
        new Arg("borrower", getAddressV),
        new Arg("collateral", getPTokenV),
        new Arg("repayAmount", getNumberV, { nullable: true })
      ],
      (world, from, { borrower, pToken, collateral, repayAmount }) => liquidateBorrow(world, from, pToken, borrower.val, collateral, repayAmount),
      { namePos: 1 }
    ),
    new Command<{ pToken: PToken, liquidator: AddressV, borrower: AddressV, seizeTokens: NumberV }>(`
        #### Seize

        * "PToken <pToken> Seize liquidator:<User> borrower:<User> seizeTokens:<Number>" - Seizes a given number of tokens from a user (to be called from other PToken)
          * E.g. "PToken pZRX Seize Geoff Torrey 1.0e18"
      `,
      "Seize",
      [
        new Arg("pToken", getPTokenV),
        new Arg("liquidator", getAddressV),
        new Arg("borrower", getAddressV),
        new Arg("seizeTokens", getNumberV)
      ],
      (world, from, { pToken, liquidator, borrower, seizeTokens }) => seize(world, from, pToken, liquidator.val, borrower.val, seizeTokens),
      { namePos: 1 }
    ),
    new Command<{ pToken: PToken, treasure: PToken, liquidator: AddressV, borrower: AddressV, seizeTokens: NumberV }>(`
        #### EvilSeize

        * "PToken <pToken> EvilSeize treasure:<Token> liquidator:<User> borrower:<User> seizeTokens:<Number>" - Improperly seizes a given number of tokens from a user
          * E.g. "PToken pEVL EvilSeize pZRX Geoff Torrey 1.0e18"
      `,
      "EvilSeize",
      [
        new Arg("pToken", getPTokenV),
        new Arg("treasure", getPTokenV),
        new Arg("liquidator", getAddressV),
        new Arg("borrower", getAddressV),
        new Arg("seizeTokens", getNumberV)
      ],
      (world, from, { pToken, treasure, liquidator, borrower, seizeTokens }) => evilSeize(world, from, pToken, treasure, liquidator.val, borrower.val, seizeTokens),
      { namePos: 1 }
    ),
    new Command<{ pToken: PToken, amount: NumberV }>(`
        #### ReduceReserves

        * "PToken <pToken> ReduceReserves amount:<Number>" - Reduces the reserves of the pToken
          * E.g. "PToken pZRX ReduceReserves 1.0e18"
      `,
      "ReduceReserves",
      [
        new Arg("pToken", getPTokenV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { pToken, amount }) => reduceReserves(world, from, pToken, amount),
      { namePos: 1 }
    ),
    new Command<{ pToken: PToken, amount: NumberV }>(`
    #### AddReserves

    * "PToken <pToken> AddReserves amount:<Number>" - Adds reserves to the pToken
      * E.g. "PToken pZRX AddReserves 1.0e18"
  `,
      "AddReserves",
      [
        new Arg("pToken", getPTokenV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { pToken, amount }) => addReserves(world, from, pToken, amount),
      { namePos: 1 }
    ),
    new Command<{ pToken: PToken, reserveFactor: NumberV }>(`
        #### SetReserveFactor

        * "PToken <pToken> SetReserveFactor reserveFactor:<Number>" - Sets the reserve factor for the pToken
          * E.g. "PToken pZRX SetReserveFactor 0.1"
      `,
      "SetReserveFactor",
      [
        new Arg("pToken", getPTokenV),
        new Arg("reserveFactor", getExpNumberV)
      ],
      (world, from, { pToken, reserveFactor }) => setReserveFactor(world, from, pToken, reserveFactor),
      { namePos: 1 }
    ),
    new Command<{ pToken: PToken, interestRateModel: AddressV }>(`
        #### SetInterestRateModel

        * "PToken <pToken> SetInterestRateModel interestRateModel:<Contract>" - Sets the interest rate model for the given pToken
          * E.g. "PToken pZRX SetInterestRateModel (FixedRate 1.5)"
      `,
      "SetInterestRateModel",
      [
        new Arg("pToken", getPTokenV),
        new Arg("interestRateModel", getAddressV)
      ],
      (world, from, { pToken, interestRateModel }) => setInterestRateModel(world, from, pToken, interestRateModel.val),
      { namePos: 1 }
    ),
    new Command<{ pToken: PToken, controller: AddressV }>(`
        #### SetController

        * "PToken <pToken> SetController controller:<Contract>" - Sets the controller for the given pToken
          * E.g. "PToken pZRX SetController Controller"
      `,
      "SetController",
      [
        new Arg("pToken", getPTokenV),
        new Arg("controller", getAddressV)
      ],
      (world, from, { pToken, controller }) => setController(world, from, pToken, controller.val),
      { namePos: 1 }
    ),
    new Command<{
      pToken: PToken;
      becomeImplementationData: StringV;
    }>(
      `
        #### BecomeImplementation

        * "PToken <pToken> BecomeImplementation becomeImplementationData:<String>"
          * E.g. "PToken pDAI BecomeImplementation "0x01234anyByTeS56789""
      `,
      'BecomeImplementation',
      [
        new Arg('pToken', getPTokenV),
        new Arg('becomeImplementationData', getStringV)
      ],
      (world, from, { pToken, becomeImplementationData }) =>
        becomeImplementation(
          world,
          from,
          pToken,
          becomeImplementationData.val
        ),
      { namePos: 1 }
    ),
    new Command<{pToken: PToken;}>(
      `
        #### ResignImplementation

        * "PToken <pToken> ResignImplementation"
          * E.g. "PToken pDAI ResignImplementation"
      `,
      'ResignImplementation',
      [new Arg('pToken', getPTokenV)],
      (world, from, { pToken }) =>
        resignImplementation(
          world,
          from,
          pToken
        ),
      { namePos: 1 }
    ),
    new Command<{
      pToken: PErc20Delegator;
      implementation: AddressV;
      allowResign: BoolV;
      becomeImplementationData: StringV;
    }>(
      `
        #### SetImplementation

        * "PToken <pToken> SetImplementation implementation:<Address> allowResign:<Bool> becomeImplementationData:<String>"
          * E.g. "PToken pDAI SetImplementation (PToken pDAIDelegate Address) True "0x01234anyByTeS56789"
      `,
      'SetImplementation',
      [
        new Arg('pToken', getPErc20DelegatorV),
        new Arg('implementation', getAddressV),
        new Arg('allowResign', getBoolV),
        new Arg('becomeImplementationData', getStringV)
      ],
      (world, from, { pToken, implementation, allowResign, becomeImplementationData }) =>
        setImplementation(
          world,
          from,
          pToken,
          implementation.val,
          allowResign.val,
          becomeImplementationData.val
        ),
      { namePos: 1 }
    ),
    new Command<{ pToken: PToken }>(`
        #### Donate

        * "PToken <pToken> Donate" - Calls the donate (payable no-op) function
          * E.g. "(Trx Value 5.0e18 (PToken pETH Donate))"
      `,
      "Donate",
      [
        new Arg("pToken", getPTokenV)
      ],
      (world, from, { pToken }) => donate(world, from, pToken),
      { namePos: 1 }
    ),
    new Command<{ pToken: PToken, account: AddressV }>(`
      #### Delegate

      * "PToken <pToken> Delegate account:<Address>" - Delegates votes to a given account
        * E.g. "PToken pPIE Delegate Torrey"
    `,
        "Delegate",
        [
            new Arg("pToken", getPTokenV),
            new Arg("account", getAddressV),
        ],
        (world, from, { pToken, account }) => delegate(world, from, pToken, account.val),
        { namePos: 1 }
    ),

    new Command<{ pToken: PToken, recipients: AddressV[], amount: NumberV }>(`
      #### TransferScenario

      * "PToken <pToken> TransferScenario recipients:<User[]> <Amount>" - Transfers a number of tokens via "transfer" to the given recipients (this does not depend on allowance)
        * E.g. "PToken pPIE TransferScenario (Jared Torrey) 10"
    `,
        "TransferScenario",
        [
            new Arg("pToken", getPTokenV),
            new Arg("recipients", getAddressV, { mapped: true }),
            new Arg("amount", getNumberV)
        ],
        (world, from, { pToken, recipients, amount }) => transferScenario(world, from, pToken, recipients.map(recipient => recipient.val), amount),
        { namePos: 1 }
    ),

    new Command<{ pToken: PToken, froms: AddressV[], amount: NumberV }>(`
      #### TransferFromScenario

      * "PToken <pToken> TransferFromScenario froms:<User[]> <Amount>" - Transfers a number of tokens via "transferFrom" from the given users to msg.sender (this depends on allowance)
        * E.g. "PToken pPIE TransferFromScenario (Jared Torrey) 10"
    `,
        "TransferFromScenario",
        [
            new Arg("pToken", getPTokenV),
            new Arg("froms", getAddressV, { mapped: true }),
            new Arg("amount", getNumberV)
        ],
        (world, from, { pToken, froms, amount }) => transferFromScenario(world, from, pToken, froms.map(_from => _from.val), amount),
        { namePos: 1 }
    ),
    new Command<{ pToken: PToken, recipient: AddressV, amount: NumberV }>(`
      #### Transfer

      * "PToken <pToken> Transfer recipient:<User> <Amount>" - Transfers a number of tokens via "transfer" as given user to recipient (this does not depend on allowance)
        * E.g. "PToken pPIE Transfer Torrey 1.0e18"
    `,
        "Transfer",
        [
            new Arg("pToken", getPTokenV),
            new Arg("recipient", getAddressV),
            new Arg("amount", getNumberV)
        ],
        (world, from, { pToken, recipient, amount }) => transfer(world, from, pToken, recipient.val, amount),
        { namePos: 1 }
    ),
    new Command<{ pToken: PToken, variable: StringV, value: NumberV }>(`
        #### Mock

        * "PToken <pToken> Mock variable:<String> value:<Number>" - Mocks a given value on pToken. Note: value must be a supported mock and this will only work on a "PTokenScenario" contract.
          * E.g. "PToken pZRX Mock totalBorrows 5.0e18"
          * E.g. "PToken pZRX Mock totalReserves 0.5e18"
      `,
      "Mock",
      [
        new Arg("pToken", getPTokenV),
        new Arg("variable", getStringV),
        new Arg("value", getNumberV),
      ],
      (world, from, { pToken, variable, value }) => setPTokenMock(world, from, <PTokenScenario>pToken, variable.val, value),
      { namePos: 1 }
    ),
    new View<{ pToken: PToken }>(`
        #### Minters

        * "PToken <pToken> Minters" - Print address of all minters
      `,
      "Minters",
      [
        new Arg("pToken", getPTokenV)
      ],
      (world, { pToken }) => printMinters(world, pToken),
      { namePos: 1 }
    ),
    new View<{ pToken: PToken }>(`
        #### Borrowers

        * "PToken <pToken> Borrowers" - Print address of all borrowers
      `,
      "Borrowers",
      [
        new Arg("pToken", getPTokenV)
      ],
      (world, { pToken }) => printBorrowers(world, pToken),
      { namePos: 1 }
    ),
    new View<{ pToken: PToken }>(`
        #### Liquidity

        * "PToken <pToken> Liquidity" - Prints liquidity of all minters or borrowers
      `,
      "Liquidity",
      [
        new Arg("pToken", getPTokenV)
      ],
      (world, { pToken }) => printLiquidity(world, pToken),
      { namePos: 1 }
    ),
    new View<{ pToken: PToken, input: StringV }>(`
        #### Decode

        * "Decode <pToken> input:<String>" - Prints information about a call to a pToken contract
      `,
      "Decode",
      [
        new Arg("pToken", getPTokenV),
        new Arg("input", getStringV)

      ],
      (world, { pToken, input }) => decodeCall(world, pToken, input.val),
      { namePos: 1 }
    ),
  ];
}

export async function processPTokenEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("PToken", pTokenCommands(), world, event, from);
}
