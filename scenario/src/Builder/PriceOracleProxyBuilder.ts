import {Event} from '../Event';
import {World} from '../World';
import {PriceOracleProxy} from '../Contract/PriceOracleProxy';
import {Invokation} from '../Invokation';
import {Arg, Fetcher, getFetcherValue} from '../Command';
import {storeAndSaveContract} from '../Networks';
import {getContract} from '../Contract';
import {getAddressV} from '../CoreValue';
import {AddressV} from '../Value';

const PriceOracleProxyContract = getContract("PriceOracleProxyHarness");

export interface PriceOracleProxyData {
  invokation: Invokation<PriceOracleProxy>,
  description: string,
  address?: string,
  contract: string
}

export async function buildPriceOracleProxy(world: World, from: string, event: Event): Promise<{
  world: World, priceOracleProxy: PriceOracleProxy, priceOracleProxyData: PriceOracleProxyData
}> {
  const fetchers = [
    new Fetcher <{ priceOracle: AddressV, registry: AddressV, priceFeed: AddressV}, PriceOracleProxyData>(`
        #### Default
        * "Deploy priceOracle:<string> registry:<string> priceFeed:<string>" - Wrap an existing PriceOracle
        * E.g. "PriceOracleProxy Deploy (PriceOracle Address) (RegistryProxy Address) (PriceFeed Address)"
      `,
      "Default",
      [
        new Arg("priceOracle", getAddressV),
        new Arg("registry", getAddressV),
        new Arg("priceFeed", getAddressV),
      ],
      async (world, {
        priceOracle,
        registry,
        priceFeed
      }) => {
        return {
          invokation: await PriceOracleProxyContract.deploy<PriceOracleProxy>(world, from, [
            priceOracle.val,
            registry.val,
            priceFeed.val
          ]),
          contract: 'PriceOracleProxy',
          description: 'Default PriceOracleProxy'
        };
      },
      {catchall: true}
    )
  ];

  let priceOracleProxyData = await getFetcherValue<any, PriceOracleProxyData>("DeployPriceOracleProxy", fetchers, world, event);
  let invokation = priceOracleProxyData.invokation!;
  delete priceOracleProxyData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }
  const priceOracleProxy = invokation.value!;
  priceOracleProxyData.address = priceOracleProxy._address;

  world = await storeAndSaveContract(
    world,
    priceOracleProxy,
    'PriceOracleProxy',
    invokation,
    [
      { index: ['PriceOracleProxy'], data: priceOracleProxyData }
    ]
  );

  return {world, priceOracleProxy, priceOracleProxyData};
}
