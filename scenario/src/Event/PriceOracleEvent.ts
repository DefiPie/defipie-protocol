import {Event} from '../Event';
import {addAction, World} from '../World';
import {PriceOracle} from '../Contract/PriceOracle';
import {buildPriceOracle, setPriceOracle} from '../Builder/PriceOracleBuilder';
import {invoke} from '../Invokation';
import {
  getAddressV,
  getEventV,
  getExpNumberV,
  getStringV
} from '../CoreValue';
import {
  AddressV,
  EventV,
  NumberV,
  StringV
} from '../Value';
import {Arg, Command, processCommandEvent, View} from '../Command';
import {getPriceOracle} from '../ContractLookup';
import {verify} from '../Verify';

async function genPriceOracle(world: World, from: string, params: Event): Promise<World> {
  let {world: nextWorld, priceOracle, priceOracleData} = await buildPriceOracle(world, from, params);
  world = nextWorld;

  world = addAction(
    world,
    `Deployed PriceOracle (${priceOracleData.description}) to address ${priceOracle._address}`,
    priceOracleData.invokation!
  );

  return world;
}

async function setPriceOracleFn(world: World, params: Event): Promise<World> {
  let {world: nextWorld, priceOracle, priceOracleData} = await setPriceOracle(world, params);

  return nextWorld;
}

async function setPrice(world: World, from: string, priceOracle: PriceOracle, pToken: string, amount: NumberV): Promise<World> {
  return addAction(
    world,
    `Set price oracle price for ${pToken} to ${amount.show()}`,
    await invoke(world, priceOracle.methods.setUnderlyingPrice(pToken, amount.encode()), from)
  );
}

async function setDirectPrice(world: World, from: string, priceOracle: PriceOracle, asset: string, amount: NumberV): Promise<World> {
  return addAction(
    world,
    `Set price oracle price for ${asset} to ${amount.show()}`,
    await invoke(world, priceOracle.methods.setDirectPrice(asset, amount.encode()), from)
  );
}

async function verifyPriceOracle(world: World, priceOracle: PriceOracle, apiKey: string, contractName: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, "PriceOracle", contractName, priceOracle._address);
  }

  return world;
}

export function priceOracleCommands() {
  return [
    new Command<{params: EventV}>(`
        #### Deploy

        * "Deploy ...params" - Generates a new price oracle
          * E.g. "PriceOracle Deploy Fixed 1.0"
          * E.g. "PriceOracle Deploy Simple"
          * E.g. "PriceOracle Deploy NotPriceOracle"
      `,
      "Deploy",
      [
        new Arg("params", getEventV, {variadic: true})
      ],
      (world, from, {params}) => genPriceOracle(world, from, params.val)
    ),
    new Command<{params: EventV}>(`
        #### Set

        * "Set ...params" - Sets the price oracle to given deployed contract
          * E.g. "PriceOracle Set Standard \"0x...\" \"My Already Deployed Oracle\""
      `,
      "Set",
      [
        new Arg("params", getEventV, {variadic: true})
      ],
      (world, from, {params}) => setPriceOracleFn(world, params.val)
    ),

    new Command<{priceOracle: PriceOracle, pToken: AddressV, amount: NumberV}>(`
        #### SetPrice

        * "SetPrice <PToken> <Amount>" - Sets the per-ether price for the given pToken
          * E.g. "PriceOracle SetPrice pZRX 1.0"
      `,
      "SetPrice",
      [
        new Arg("priceOracle", getPriceOracle, {implicit: true}),
        new Arg("pToken", getAddressV),
        new Arg("amount", getExpNumberV)
      ],
      (world, from, {priceOracle, pToken, amount}) => setPrice(world, from, priceOracle, pToken.val, amount)
    ),

    new Command<{priceOracle: PriceOracle, asset: AddressV, amount: NumberV}>(`
        #### SetDirectPrice

        * "SetDirectPrice <Address> <Amount>" - Sets the per-ether price for the given pToken
          * E.g. "PriceOracle SetDirectPrice (Address Zero) 1.0"
      `,
      "SetDirectPrice",
      [
        new Arg("priceOracle", getPriceOracle, {implicit: true}),
        new Arg("asset", getAddressV),
        new Arg("amount", getExpNumberV)
      ],
      (world, from, {priceOracle, asset, amount}) => setDirectPrice(world, from, priceOracle, asset.val, amount)
    ),

    new View<{priceOracle: PriceOracle, apiKey: StringV, contractName: StringV}>(`
        #### Verify

        * "Verify apiKey:<String> contractName:<String>=PriceOracle" - Verifies PriceOracle in Etherscan
          * E.g. "PriceOracle Verify "myApiKey"
      `,
      "Verify",
      [
        new Arg("priceOracle", getPriceOracle, {implicit: true}),
        new Arg("apiKey", getStringV),
        new Arg("contractName", getStringV, {default: new StringV("PriceOracle")})
      ],
      (world, {priceOracle, apiKey, contractName}) => verifyPriceOracle(world, priceOracle, apiKey.val, contractName.val)
    )
  ];
}

export async function processPriceOracleEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("PriceOracle", priceOracleCommands(), world, event, from);
}
