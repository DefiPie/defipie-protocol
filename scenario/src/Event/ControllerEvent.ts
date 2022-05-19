import {Event} from '../Event';
import {addAction, describeUser, World} from '../World';
import {decodeCall, getPastEvents} from '../Contract';
import {Controller} from '../Contract/Controller';
import {PToken} from '../Contract/PToken';
import {invoke} from '../Invokation';
import {
  getAddressV,
  getBoolV,
  getEventV,
  getExpNumberV,
  getNumberV,
  getPercentV,
  getStringV,
  getCoreValue
} from '../CoreValue';
import {
  AddressV,
  BoolV,
  EventV,
  NumberV,
  StringV
} from '../Value';
import {Arg, Command, View, processCommandEvent} from '../Command';
import {buildControllerImpl} from '../Builder/ControllerImplBuilder';
import {ControllerErrorReporter} from '../ErrorReporter';
import {getController} from '../ContractLookup';
import {getLiquidity} from '../Value/ControllerValue';
import {getPTokenV} from '../Value/PTokenValue';
import {encodeABI, rawValues} from "../Utils";

async function genController(world: World, from: string, params: Event): Promise<World> {
  let {world: nextWorld, controllerImpl: controller, controllerImplData: controllerData} = await buildControllerImpl(world, from, params);
  world = nextWorld;

  world = addAction(
    world,
    `Added Controller (${controllerData.description}) at address ${controller._address}`,
    controllerData.invokation
  );

  return world;
}

async function setPaused(world: World, from: string, controller: Controller, actionName: string, isPaused: boolean): Promise<World> {
  const pauseMap = {
    "Mint": controller.methods._setMintPaused
  };

  if (!pauseMap[actionName]) {
    throw `Cannot find pause function for action "${actionName}"`;
  }

  let invokation = await invoke(world, controller[actionName]([isPaused]), from, ControllerErrorReporter);

  world = addAction(
    world,
    `Controller: set paused for ${actionName} to ${isPaused}`,
    invokation
  );

  return world;
}

async function setMaxAssets(world: World, from: string, controller: Controller, numberOfAssets: NumberV): Promise<World> {
  let invokation = await invoke(world, controller.methods._setMaxAssets(numberOfAssets.encode()), from, ControllerErrorReporter);

  world = addAction(
    world,
    `Set max assets to ${numberOfAssets.show()}`,
    invokation
  );

  return world;
}

async function setLiquidationIncentive(world: World, from: string, controller: Controller, liquidationIncentive: NumberV): Promise<World> {
  let invokation = await invoke(world, controller.methods._setLiquidationIncentive(liquidationIncentive.encode()), from, ControllerErrorReporter);

  world = addAction(
    world,
    `Set liquidation incentive to ${liquidationIncentive.show()}`,
    invokation
  );

  return world;
}

async function supportMarket(world: World, from: string, controller: Controller, pToken: PToken): Promise<World> {
  if (world.dryRun) {
    // Skip this specifically on dry runs since it's likely to crash due to a number of reasons
    world.printer.printLine(`Dry run: Supporting market  \`${pToken._address}\``);
    return world;
  }

  let invokation = await invoke(world, controller.methods._supportMarket(pToken._address), from, ControllerErrorReporter);

  world = addAction(
    world,
    `Supported market ${pToken.name}`,
    invokation
  );

  return world;
}

async function unlistMarket(world: World, from: string, controller: Controller, pToken: PToken): Promise<World> {
  let invokation = await invoke(world, controller.methods.unlist(pToken._address), from, ControllerErrorReporter);

  world = addAction(
    world,
    `Unlisted market ${pToken.name}`,
    invokation
  );

  return world;
}

async function enterMarkets(world: World, from: string, controller: Controller, assets: string[]): Promise<World> {
  let invokation = await invoke(world, controller.methods.enterMarkets(assets), from, ControllerErrorReporter);

  world = addAction(
    world,
    `Called enter assets ${assets} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function exitMarket(world: World, from: string, controller: Controller, asset: string): Promise<World> {
  let invokation = await invoke(world, controller.methods.exitMarket(asset), from, ControllerErrorReporter);

  world = addAction(
    world,
    `Called exit market ${asset} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function setLiquidateGuardian(world: World, from: string, controller: Controller, liquidateGuardianAddr: string): Promise<World> {
    let invokation = await invoke(world, controller.methods._setLiquidateGuardian(liquidateGuardianAddr), from, ControllerErrorReporter);

    world = addAction(
        world,
        `Controller: ${describeUser(world, from)} sets liquidate guardian to ${liquidateGuardianAddr}`,
        invokation
    );

    return world;
}

async function setDistributor(world: World, from: string, controller: Controller, distributorAddr: string): Promise<World> {
  let invokation = await invoke(world, controller.methods._setDistributor(distributorAddr), from, ControllerErrorReporter);

  world = addAction(
      world,
      `Controller: ${describeUser(world, from)} sets distributor to ${distributorAddr}`,
      invokation
  );

  return world;
}

async function setCollateralFactor(world: World, from: string, controller: Controller, pToken: PToken, collateralFactor: NumberV): Promise<World> {
  let invokation = await invoke(world, controller.methods._setCollateralFactor(pToken._address, collateralFactor.encode()), from, ControllerErrorReporter);

  world = addAction(
    world,
    `Set collateral factor for ${pToken.name} to ${collateralFactor.show()}`,
    invokation
  );

  return world;
}

async function setCloseFactor(world: World, from: string, controller: Controller, closeFactor: NumberV): Promise<World> {
  let invokation = await invoke(world, controller.methods._setCloseFactor(closeFactor.encode()), from, ControllerErrorReporter);

  world = addAction(
    world,
    `Set close factor to ${closeFactor.show()}`,
    invokation
  );

  return world;
}

async function setFeeFactorMax(world: World, from: string, controller: Controller, feeFactorMax: NumberV): Promise<World> {
    let invokation = await invoke(world, controller.methods._setFeeFactorMaxMantissa(feeFactorMax.encode()), from, ControllerErrorReporter);

    world = addAction(
        world,
        `Set fee factor max to ${feeFactorMax.show()}`,
        invokation
    );

    return world;
}

async function setFeeFactor(world: World, from: string, controller: Controller, pToken: PToken, feeFactor: NumberV): Promise<World> {
    let invokation = await invoke(world, controller.methods._setFeeFactor(pToken._address, feeFactor.encode()), from, ControllerErrorReporter);

    world = addAction(
        world,
        `Set fee factor for ${pToken.name} to ${feeFactor.show()}`,
        invokation
    );

    return world;
}

async function fastForward(world: World, from: string, controller: Controller, blocks: NumberV): Promise<World> {
  let invokation = await invoke(world, controller.methods.fastForward(blocks.encode()), from, ControllerErrorReporter);

  world = addAction(
    world,
    `Fast forward ${blocks.show()} blocks to #${invokation.value}`,
    invokation
  );

  return world;
}

async function sendAny(world: World, from:string, controller: Controller, signature: string, callArgs: string[]): Promise<World> {
  const fnData = encodeABI(world, signature, callArgs);
  await world.web3.eth.sendTransaction({
      to: controller._address,
      data: fnData,
      from: from
    });
  return world;
}

async function printLiquidity(world: World, controller: Controller): Promise<World> {
  let enterEvents = await getPastEvents(world, controller, 'StdController', 'MarketEntered');
  let addresses = enterEvents.map((event) => event.returnValues['account']);
  let uniq = [...new Set(addresses)];

  world.printer.printLine("Liquidity:");

  const liquidityMap = await Promise.all(uniq.map(async (address) => {
    let userLiquidity = await getLiquidity(world, controller, address);

    return [address, userLiquidity.val];
  }));

  liquidityMap.forEach(([address, liquidity]) => {
    world.printer.printLine(`\t${world.settings.lookupAlias(address)}: ${liquidity / 1e18}e18`)
  });

  return world;
}

async function setPauseGuardian(world: World, from: string, controller: Controller, newPauseGuardian: string): Promise<World> {
  let invokation = await invoke(world, controller.methods._setPauseGuardian(newPauseGuardian), from, ControllerErrorReporter);

  world = addAction(
    world,
    `Controller: ${describeUser(world, from)} sets pause guardian to ${newPauseGuardian}`,
    invokation
  );

  return world;
}

async function setGuardianPaused(world: World, from: string, controller: Controller, action: string, state: boolean): Promise<World> {
  let fun;
  switch(action){
    case "Transfer":
      fun = controller.methods._setTransferPaused
      break;
    case "Seize":
      fun = controller.methods._setSeizePaused
      break;
  }
  let invokation = await invoke(world, fun(state), from, ControllerErrorReporter);

  world = addAction(
    world,
    `Controller: ${describeUser(world, from)} sets ${action} paused`,
    invokation
  );

  return world;
}

async function setGuardianMarketPaused(world: World, from: string, controller: Controller, pToken: PToken, action: string, state: boolean): Promise<World> {
  let fun;
  switch(action){
    case "Mint":
      fun = controller.methods._setMintPaused
      break;
    case "Borrow":
      fun = controller.methods._setBorrowPaused
      break;
  }
  let invokation = await invoke(world, fun(pToken._address, state), from, ControllerErrorReporter);

  world = addAction(
    world,
    `Controller: ${describeUser(world, from)} sets ${action} paused`,
    invokation
  );

  return world;
}

export function controllerCommands() {
  return [
    new Command<{controllerParams: EventV}>(`
        #### Deploy

        * "Controller Deploy ...controllerParams" - Generates a new Controller (not as Impl)
          * E.g. "Controller Deploy YesNo"
      `,
      "Deploy",
      [new Arg("controllerParams", getEventV, {variadic: true})],
      (world, from, {controllerParams}) => genController(world, from, controllerParams.val)
    ),
    new Command<{controller: Controller, action: StringV, isPaused: BoolV}>(`
        #### SetPaused

        * "Controller SetPaused <Action> <Bool>" - Pauses or unpaused given pToken function
          * E.g. "Controller SetPaused "Mint" True"
      `,
      "SetPaused",
      [
        new Arg("controller", getController, {implicit: true}),
        new Arg("action", getStringV),
        new Arg("isPaused", getBoolV)
      ],
      (world, from, {controller, action, isPaused}) => setPaused(world, from, controller, action.val, isPaused.val)
    ),
    new Command<{controller: Controller, pToken: PToken}>(`
        #### SupportMarket

        * "Controller SupportMarket <PToken>" - Adds support in the Controller for the given pToken
          * E.g. "Controller SupportMarket pZRX"
      `,
      "SupportMarket",
      [
        new Arg("controller", getController, {implicit: true}),
        new Arg("pToken", getPTokenV)
      ],
      (world, from, {controller, pToken}) => supportMarket(world, from, controller, pToken)
    ),
    new Command<{controller: Controller, pToken: PToken}>(`
        #### UnList

        * "Controller UnList <PToken>" - Mock unlists a given market in tests
          * E.g. "Controller UnList pZRX"
      `,
      "UnList",
      [
        new Arg("controller", getController, {implicit: true}),
        new Arg("pToken", getPTokenV)
      ],
      (world, from, {controller, pToken}) => unlistMarket(world, from, controller, pToken)
    ),
    new Command<{controller: Controller, pTokens: PToken[]}>(`
        #### EnterMarkets

        * "Controller EnterMarkets (<PToken> ...)" - User enters the given markets
          * E.g. "Controller EnterMarkets (pZRX pETH)"
      `,
      "EnterMarkets",
      [
        new Arg("controller", getController, {implicit: true}),
        new Arg("pTokens", getPTokenV, {mapped: true})
      ],
      (world, from, {controller, pTokens}) => enterMarkets(world, from, controller, pTokens.map((c) => c._address))
    ),
    new Command<{controller: Controller, pToken: PToken}>(`
        #### ExitMarket

        * "Controller ExitMarket <PToken>" - User exits the given markets
          * E.g. "Controller ExitMarket pZRX"
      `,
      "ExitMarket",
      [
        new Arg("controller", getController, {implicit: true}),
        new Arg("pToken", getPTokenV)
      ],
      (world, from, {controller, pToken}) => exitMarket(world, from, controller, pToken._address)
    ),
    new Command<{controller: Controller, maxAssets: NumberV}>(`
        #### SetMaxAssets

        * "Controller SetMaxAssets <Number>" - Sets (or resets) the max allowed asset count
          * E.g. "Controller SetMaxAssets 4"
      `,
      "SetMaxAssets",
      [
        new Arg("controller", getController, {implicit: true}),
        new Arg("maxAssets", getNumberV)
      ],
      (world, from, {controller, maxAssets}) => setMaxAssets(world, from, controller, maxAssets)
    ),
    new Command<{controller: Controller, liquidationIncentive: NumberV}>(`
        #### LiquidationIncentive

        * "Controller LiquidationIncentive <Number>" - Sets the liquidation incentive
          * E.g. "Controller LiquidationIncentive 1.1"
      `,
      "LiquidationIncentive",
      [
        new Arg("controller", getController, {implicit: true}),
        new Arg("liquidationIncentive", getExpNumberV)
      ],
      (world, from, {controller, liquidationIncentive}) => setLiquidationIncentive(world, from, controller, liquidationIncentive)
    ),
    new Command<{controller: Controller, liquidateGuardian: AddressV}>(`
        #### SetLiquidateGuardian

        * "Controller SetLiquidateGuardian liquidateGuardian:<Address>" - Sets the liquidate guardian address
          * E.g. "Controller SetLiquidateGuardian 0x..."
      `,
      "SetLiquidateGuardian",
      [
        new Arg("controller", getController, {implicit: true}),
        new Arg("liquidateGuardian", getAddressV)
      ],
      (world, from, {controller, liquidateGuardian}) => setLiquidateGuardian(world, from, controller, liquidateGuardian.val)
    ),
    new Command<{controller: Controller, distributor: AddressV}>(`
        #### SetDistributor

        * "Controller SetDistributor distributor:<Address>" - Sets the distributor address
          * E.g. "Controller SetDistributor 0x..."
      `,
        "SetDistributor",
        [
          new Arg("controller", getController, {implicit: true}),
          new Arg("distributor", getAddressV)
        ],
        (world, from, {controller, distributor}) => setDistributor(world, from, controller, distributor.val)
    ),
    new Command<{controller: Controller, pToken: PToken, collateralFactor: NumberV}>(`
        #### SetCollateralFactor

        * "Controller SetCollateralFactor <PToken> <Number>" - Sets the collateral factor for given pToken to number
          * E.g. "Controller SetCollateralFactor pZRX 0.1"
      `,
      "SetCollateralFactor",
      [
        new Arg("controller", getController, {implicit: true}),
        new Arg("pToken", getPTokenV),
        new Arg("collateralFactor", getExpNumberV)
      ],
      (world, from, {controller, pToken, collateralFactor}) => setCollateralFactor(world, from, controller, pToken, collateralFactor)
    ),
    new Command<{controller: Controller, pToken: PToken, feeFactor: NumberV}>(`
      #### SetFeeFactor

        * "Controller SetFeeFactor <PToken> <Number>" - Sets the fee factor for given pToken to number
        * E.g. "Controller SetFeeFactor pZRX 0.01"
    `,
      "SetFeeFactor",
      [
          new Arg("controller", getController, {implicit: true}),
          new Arg("pToken", getPTokenV),
          new Arg("feeFactor", getExpNumberV)
      ],
      (world, from, {controller, pToken, feeFactor}) => setFeeFactor(world, from, controller, pToken, feeFactor)
    ),
    new Command<{controller: Controller, closeFactor: NumberV}>(`
        #### SetCloseFactor

        * "Controller SetCloseFactor <Number>" - Sets the close factor to given percentage
          * E.g. "Controller SetCloseFactor 0.2"
      `,
      "SetCloseFactor",
      [
        new Arg("controller", getController, {implicit: true}),
        new Arg("closeFactor", getPercentV)
      ],
      (world, from, {controller, closeFactor}) => setCloseFactor(world, from, controller, closeFactor)
    ),
    new Command<{controller: Controller, feeFactorMax: NumberV}>(`
        #### SetFeeFactorMax

        * "Controller SetFeeFactorMax <Number>" - Sets the fee factor max
          * E.g. "Controller SetFeeFactorMax 0.1"
      `,
      "SetFeeFactorMax",
      [
        new Arg("controller", getController, {implicit: true}),
        new Arg("feeFactorMax", getExpNumberV)
       ],
      (world, from, {controller, feeFactorMax}) => setFeeFactorMax(world, from, controller, feeFactorMax)
    ),
    new Command<{controller: Controller, newPauseGuardian: AddressV}>(`
        #### SetPauseGuardian

        * "Controller SetPauseGuardian newPauseGuardian:<Address>" - Sets the PauseGuardian for the Controller
          * E.g. "Controller SetPauseGuardian Geoff"
      `,
      "SetPauseGuardian",
      [
        new Arg("controller", getController, {implicit: true}),
        new Arg("newPauseGuardian", getAddressV)
      ],
      (world, from, {controller, newPauseGuardian}) => setPauseGuardian(world, from, controller, newPauseGuardian.val)
    ),

    new Command<{controller: Controller, action: StringV, isPaused: BoolV}>(`
        #### SetGuardianPaused

        * "Controller SetGuardianPaused <Action> <Bool>" - Pauses or unpaused given pToken function
        * E.g. "Controller SetGuardianPaused "Transfer" True"
        `,
        "SetGuardianPaused",
        [
          new Arg("controller", getController, {implicit: true}),
          new Arg("action", getStringV),
          new Arg("isPaused", getBoolV)
        ],
        (world, from, {controller, action, isPaused}) => setGuardianPaused(world, from, controller, action.val, isPaused.val)
    ),

    new Command<{controller: Controller, pToken: PToken, action: StringV, isPaused: BoolV}>(`
        #### SetGuardianMarketPaused

        * "Controller SetGuardianMarketPaused <PToken> <Action> <Bool>" - Pauses or unpaused given pToken function
        * E.g. "Controller SetGuardianMarketPaused cREP "Mint" True"
        `,
        "SetGuardianMarketPaused",
        [
          new Arg("controller", getController, {implicit: true}),
          new Arg("pToken", getPTokenV),
          new Arg("action", getStringV),
          new Arg("isPaused", getBoolV)
        ],
        (world, from, {controller, pToken, action, isPaused}) => setGuardianMarketPaused(world, from, controller, pToken, action.val, isPaused.val)
    ),

    new Command<{controller: Controller, blocks: NumberV, _keyword: StringV}>(`
        #### FastForward

        * "FastForward n:<Number> Blocks" - Moves the block number forward "n" blocks. Note: in "PTokenScenario" and "ControllerScenario" the current block number is mocked (starting at 100000). This is the only way for the protocol to see a higher block number (for accruing interest).
          * E.g. "Controller FastForward 5 Blocks" - Move block number forward 5 blocks.
      `,
      "FastForward",
      [
        new Arg("controller", getController, {implicit: true}),
        new Arg("blocks", getNumberV),
        new Arg("_keyword", getStringV)
      ],
      (world, from, {controller, blocks}) => fastForward(world, from, controller, blocks)
    ),
    new View<{controller: Controller}>(`
        #### Liquidity

        * "Controller Liquidity" - Prints liquidity of all minters or borrowers
      `,
      "Liquidity",
      [
        new Arg("controller", getController, {implicit: true}),
      ],
      (world, {controller}) => printLiquidity(world, controller)
    ),
    new View<{controller: Controller, input: StringV}>(`
        #### Decode

        * "Decode input:<String>" - Prints information about a call to a Controller contract
      `,
      "Decode",
      [
        new Arg("controller", getController, {implicit: true}),
        new Arg("input", getStringV)

      ],
      (world, {controller, input}) => decodeCall(world, controller, input.val)
    ),

    new Command<{controller: Controller, signature: StringV, callArgs: StringV[]}>(`
      #### Send
      * Controller Send functionSignature:<String> callArgs[] - Sends any transaction to controller
      * E.g: Controller Send "setPieAddress(address)" (Address PIE)
      `,
      "Send",
      [
        new Arg("controller", getController, {implicit: true}),
        new Arg("signature", getStringV),
        new Arg("callArgs", getCoreValue, {variadic: true, mapped: true})
      ],
      (world, from, {controller, signature, callArgs}) => sendAny(world, from, controller, signature.val, rawValues(callArgs))
    ),
  ];
}

export async function processControllerEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("Controller", controllerCommands(), world, event, from);
}
