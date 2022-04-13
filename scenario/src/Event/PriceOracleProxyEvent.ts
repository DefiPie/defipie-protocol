import {Event} from '../Event';
import {addAction, World, describeUser} from '../World';
import {PriceOracleProxy} from '../Contract/PriceOracleProxy';
import {buildPriceOracleProxy} from '../Builder/PriceOracleProxyBuilder';
import {invoke} from '../Invokation';
import {
  getAddressV,
  getEventV,
  getExpNumberV
} from '../CoreValue';
import {
  AddressV,
  EventV,
  NumberV
} from '../Value';
import {Arg, Command, processCommandEvent} from '../Command';
import {getPriceOracleProxy} from '../ContractLookup';

async function genPriceOracleProxy(world: World, from: string, params: Event): Promise<World> {

  let {world: newWorld, priceOracleProxy, priceOracleProxyData} = await buildPriceOracleProxy(world, from, params);
  world = newWorld;

  world = addAction(
    world,
      `Added RegistryProxy (${priceOracleProxyData.description}) at address ${priceOracleProxy._address}`,
      priceOracleProxyData.invokation
  );

  return world;
}

async function setPrice(world: World, from: string, priceOracleProxy: PriceOracleProxy, pToken: string, amount: NumberV): Promise<World> {
  return addAction(
    world,
    `Set price oracle price for ${pToken} to ${amount.show()}`,
    await invoke(world, priceOracleProxy.methods.setUnderlyingPrice(pToken, amount.encode()), from)
  );
}

async function setDirectPrice(world: World, from: string, priceOracleProxy: PriceOracleProxy, asset: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, priceOracleProxy.methods.setDirectPrice(asset, amount.encode()), from);

  world = addAction(
      world,
      `Called add PPIE address ${asset} to ${amount.show()} as ${describeUser(world, from)}`,
      invokation
  );

  return world;
}

export function priceOracleProxyCommands() {
  return [
    new Command<{priceOracleProxyParams: EventV}>(`
        #### Deploy
        * "PriceOracleProxy Deploy ...priceOracleProxyParams" - Generates a new PriceOracleProxy
          * E.g. "PriceOracleProxy Deploy ..."
      `,
    "Deploy",
    [new Arg("priceOracleProxyParams", getEventV, {variadic: true})],
    (world, from, {priceOracleProxyParams}) => genPriceOracleProxy(world, from, priceOracleProxyParams.val)
    ),
    new Command<{priceOracleProxy: PriceOracleProxy, asset: AddressV, amount: NumberV}>(`
        #### SetDirectPrice

        * "SetDirectPrice <Address> <Amount>" - Sets the per-ether price for the given pToken
          * E.g. "PriceOracleProxy SetDirectPrice (Address Zero) 1.0"
      `,
      "SetDirectPrice",
      [
        new Arg("priceOracleProxy", getPriceOracleProxy, {implicit: true}),
        new Arg("asset", getAddressV),
        new Arg("amount", getExpNumberV)
      ],
      (world, from, {priceOracleProxy, asset, amount}) => setDirectPrice(world, from, priceOracleProxy, asset.val, amount)
    ),
    new Command<{priceOracleProxy: PriceOracleProxy, pToken: AddressV, amount: NumberV}>(`
        #### SetPrice

        * "SetPrice <PToken> <Amount>" - Sets the per-ether price for the given pToken
          * E.g. "PriceOracleProxy SetPrice pZRX 1.0"
      `,
      "SetPrice",
      [
        new Arg("priceOracleProxy", getPriceOracleProxy, {implicit: true}),
        new Arg("pToken", getAddressV),
        new Arg("amount", getExpNumberV)
      ],
      (world, from, {priceOracleProxy, pToken, amount}) => setPrice(world, from, priceOracleProxy, pToken.val, amount)
    ),
  ];
}

export async function processPriceOracleProxyEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("PriceOracleProxy", priceOracleProxyCommands(), world, event, from);
}
