import { Event } from '../Event';
import { World } from '../World';
import { PErc20Delegator, PErc20DelegatorScenario } from '../Contract/PErc20Delegator';
import { PPIEDelegator } from '../Contract/PPIEDelegator';
import { PToken } from '../Contract/PToken';
import { Invokation } from '../Invokation';
import { getAddressV, getExpNumberV, getNumberV, getStringV } from '../CoreValue';
import { AddressV, NumberV, StringV } from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { storeAndSaveContract } from '../Networks';
import { getContract, getTestContract } from '../Contract';

const PErc20Contract = getContract('PErc20Immutable');
const PErc20Delegator = getContract('PErc20Delegator');
const PPIEDelegator = getContract('PPIEDelegator');
const PErc20DelegatorScenario = getTestContract('PErc20DelegatorScenario');
const PEtherContract = getContract('PEther');
const PErc20ScenarioContract = getTestContract('PErc20Scenario');
const PEtherScenarioContract = getTestContract('PEtherScenario');
const PEvilContract = getTestContract('PEvil');
const PPIEScenarioContract = getTestContract('PPIEScenario');

export interface TokenData {
  invokation: Invokation<PToken>;
  name: string;
  symbol: string;
  decimals?: number;
  underlying?: string;
  address?: string;
  contract: string;
  initial_exchange_rate_mantissa?: string;
  initial_reserve_factor_mantissa?: string;
  admin?: string;
}

export async function buildPToken(
  world: World,
  from: string,
  params: Event
): Promise<{ world: World; pToken: PToken; tokenData: TokenData }> {
  const fetchers = [
    new Fetcher<
      {
        symbol: StringV;
        name: StringV;
        decimals: NumberV;
        underlying: AddressV;
        controller: AddressV;
        interestRateModel: AddressV;
        initialExchangeRate: NumberV;
        initialReserveFactor: NumberV;
        admin: AddressV;
        implementation: AddressV;
        registryProxy: AddressV;
      },
      TokenData
    >(
    `
      #### PErc20Delegator

      * "PErc20Delegator symbol:<String> name:<String> underlying:<Address> controller:<Address> interestRateModel:<Address> initialExchangeRate:<Number> initialReserveFactor:<Number> decimals:<Number> admin: <Address> implementation:<Address> registryProxy:<Address>" - The real deal PToken
        * E.g. "PToken Deploy PErc20Delegator pDAI \"DeFiPie DAI\" (Erc20 DAI Address) (Controller Address) (InterestRateModel Address) 1.0 1.0 8 Geoff (PToken CDaiDelegate Address) "0x0123434anyByTes314535q" "
    `,
      'PErc20Delegator',
      [
        new Arg('symbol', getStringV),
        new Arg('name', getStringV),
        new Arg('underlying', getAddressV),
        new Arg('controller', getAddressV),
        new Arg('interestRateModel', getAddressV),
        new Arg('initialExchangeRate', getExpNumberV),
        new Arg('initialReserveFactor', getExpNumberV),
        new Arg('decimals', getNumberV),
        new Arg('admin', getAddressV),
        new Arg('implementation', getAddressV),
        new Arg('registryProxy', getAddressV)
      ],
      async (
        world,
        {
          symbol,
          name,
          underlying,
          controller,
          interestRateModel,
          initialExchangeRate,
          initialReserveFactor,
          decimals,
          admin,
          implementation,
          registryProxy
        }
      ) => {
        return {
          invokation: await PErc20Delegator.deploy<PErc20Delegator>(world, from, [
            underlying.val,
            controller.val,
            interestRateModel.val,
            initialExchangeRate.val,
            initialReserveFactor.val,
            name.val,
            symbol.val,
            decimals.val,
            admin.val,
            implementation.val,
            registryProxy.val
          ]),
          name: name.val,
          symbol: symbol.val,
          decimals: decimals.toNumber(),
          underlying: underlying.val,
          contract: 'PErc20Delegator',
          initial_exchange_rate_mantissa: initialExchangeRate.encode().toString(),
          initial_reserve_factor_mantissa: initialReserveFactor.encode().toString(),
          admin: admin.val
        };
      }
    ),

      new Fetcher<
          {
              symbol: StringV;
              name: StringV;
              decimals: NumberV;
              underlying: AddressV;
              controller: AddressV;
              interestRateModel: AddressV;
              initialExchangeRate: NumberV;
              initialReserveFactor: NumberV;
              implementation: AddressV;
              registryProxy: AddressV;
          },
          TokenData
          >(
          `
      #### PPIEDelegator

      * "PPIEDelegator underlying:<Address> implementation:<Address> controller:<Address> interestRateModel:<Address> initialExchangeRate:<Number> initialReserveFactor:<Number> name:<String> symbol:<String> decimals:<Number> registryProxy:<Address>" - The real deal PToken
        * E.g. "PToken Deploy PPIEDelegator (Erc20 Pie Address) (PToken PPIEDelegate Address) (Controller Address) (InterestRateModel Address) 1.0 1.0 \"DeFiPie PIE\" pPIE 18 (RegistryProxy Address) "
    `,
          'PPIEDelegator',
          [
              new Arg('underlying', getAddressV),
              new Arg('implementation', getAddressV),
              new Arg('controller', getAddressV),
              new Arg('interestRateModel', getAddressV),
              new Arg('initialExchangeRate', getExpNumberV),
              new Arg('initialReserveFactor', getExpNumberV),
              new Arg('name', getStringV),
              new Arg('symbol', getStringV),
              new Arg('decimals', getNumberV),
              new Arg('registryProxy', getAddressV)
          ],
          async (
              world,
              {
                  underlying,
                  implementation,
                  controller,
                  interestRateModel,
                  initialExchangeRate,
                  initialReserveFactor,
                  name,
                  symbol,
                  decimals,
                  registryProxy
              }
          ) => {
              return {
                  invokation: await PPIEDelegator.deploy<PPIEDelegator>(world, from, [
                      underlying.val,
                      implementation.val,
                      controller.val,
                      interestRateModel.val,
                      initialExchangeRate.val,
                      initialReserveFactor.val,
                      name.val,
                      symbol.val,
                      decimals.val,
                      registryProxy.val
                  ]),
                  name: name.val,
                  symbol: symbol.val,
                  decimals: decimals.toNumber(),
                  underlying: underlying.val,
                  contract: 'PPIEDelegator',
                  initial_exchange_rate_mantissa: initialExchangeRate.encode().toString(),
                  initial_reserve_factor_mantissa: initialReserveFactor.encode().toString()
              };
          }
      ),

    new Fetcher<
      {
        symbol: StringV;
        name: StringV;
        decimals: NumberV;
        underlying: AddressV;
        controller: AddressV;
        interestRateModel: AddressV;
        initialExchangeRate: NumberV;
        initialReserveFactor: NumberV;
        admin: AddressV;
        implementation: AddressV;
        registryProxy: AddressV;
      },
      TokenData
    >(
    `
      #### PErc20DelegatorScenario

      * "PErc20DelegatorScenario symbol:<String> name:<String> underlying:<Address> controller:<Address> interestRateModel:<Address> initialExchangeRate:<Number> initialReserveFactor:<Number> decimals:<Number> registryProxy:<Address>" - A PToken Scenario for local testing
        * E.g. "PToken Deploy PErc20DelegatorScenario pDAI \"DeFiPie DAI\" (Erc20 DAI Address) (Controller Address) (InterestRateModel Address) 1.0 1.0 8 (RegistryProxy Address)  "
    `,
      'PErc20DelegatorScenario',
      [
        new Arg('symbol', getStringV),
        new Arg('name', getStringV),
        new Arg('underlying', getAddressV),
        new Arg('controller', getAddressV),
        new Arg('interestRateModel', getAddressV),
        new Arg('initialExchangeRate', getExpNumberV),
        new Arg('initialReserveFactor', getExpNumberV),
        new Arg('decimals', getNumberV),
        new Arg('registryProxy', getAddressV)
      ],
      async (
        world,
        {
          symbol,
          name,
          underlying,
          controller,
          interestRateModel,
          initialExchangeRate,
          initialReserveFactor,
          decimals,
          registryProxy,
        }
      ) => {
        return {
          invokation: await PErc20DelegatorScenario.deploy<PErc20DelegatorScenario>(world, from, [
            underlying.val,
            controller.val,
            interestRateModel.val,
            initialExchangeRate.val,
            initialReserveFactor.val,
            name.val,
            symbol.val,
            decimals.val,
            registryProxy.val
          ]),
          name: name.val,
          symbol: symbol.val,
          decimals: decimals.toNumber(),
          underlying: underlying.val,
          contract: 'PErc20DelegatorScenario',
          initial_exchange_rate_mantissa: initialExchangeRate.encode().toString(),
          initial_reserve_factor_mantissa: initialReserveFactor.encode().toString()
        };
      }
    ),

    new Fetcher<{symbol: StringV, name: StringV, decimals: NumberV, underlying: AddressV, registryProxy: AddressV, controller: AddressV, interestRateModel: AddressV, initialExchangeRate: NumberV, initialReserveFactor: NumberV}, TokenData>(`
        #### Scenario

        * "Scenario symbol:<String> name:<String> underlying:<Address> registryProxy:<Address> controller:<Address> interestRateModel:<Address> initialExchangeRate:<Number> initialReserveFactor:<Number> decimals:<Number>" - A PToken Scenario for local testing
          * E.g. "PToken Deploy Scenario pZRX \"DeFiPie ZRX\" (Erc20 ZRX Address) (Controller Address) (InterestRateModel Address) 1.0 1.0 8"
      `,
      "Scenario",
      [
        new Arg("symbol", getStringV),
        new Arg("name", getStringV),
        new Arg("underlying", getAddressV),
        new Arg("registryProxy", getAddressV),
        new Arg("controller", getAddressV),
        new Arg("interestRateModel", getAddressV),
        new Arg("initialExchangeRate", getExpNumberV),
        new Arg("initialReserveFactor", getExpNumberV),
        new Arg("decimals", getNumberV)
      ],
      async (world, {symbol, name, underlying, registryProxy, controller, interestRateModel, initialExchangeRate, initialReserveFactor, decimals}) => {
        return {
          invokation: await PErc20ScenarioContract.deploy<PToken>(world, from, [underlying.val, registryProxy.val, controller.val, interestRateModel.val, initialExchangeRate.val, initialReserveFactor.val, name.val, symbol.val, decimals.val]),
          name: name.val,
          symbol: symbol.val,
          decimals: decimals.toNumber(),
          underlying: underlying.val,
          contract: 'PErc20Scenario',
          initial_exchange_rate_mantissa: initialExchangeRate.encode().toString(),
          initial_reserve_factor_mantissa: initialReserveFactor.encode().toString()
        };
      }
    ),

    new Fetcher<{symbol: StringV, name: StringV, decimals: NumberV, registryProxy: AddressV, controller: AddressV, interestRateModel: AddressV, initialExchangeRate: NumberV, initialReserveFactor: NumberV}, TokenData>(`
        #### PEtherScenario

        * "PEtherScenario symbol:<String> name:<String> registryProxy:<Address> controller:<Address> interestRateModel:<Address> initialExchangeRate:<Number> initialReserveFactor:<Number> decimals:<Number>" - A PToken Scenario for local testing
          * E.g. "PToken Deploy PEtherScenario pETH \"DeFiPie Ether\" (RegistryProxy Address) (Controller Address) (InterestRateModel Address) 1.0 1.0 8"
      `,
      "PEtherScenario",
      [
        new Arg("symbol", getStringV),
        new Arg("name", getStringV),
        new Arg("registryProxy", getAddressV),
        new Arg("controller", getAddressV),
        new Arg("interestRateModel", getAddressV),
        new Arg("initialExchangeRate", getExpNumberV),
        new Arg("initialReserveFactor", getExpNumberV),
        new Arg("decimals", getNumberV)
      ],
      async (world, {symbol, name, registryProxy, controller, interestRateModel, initialExchangeRate, initialReserveFactor, decimals}) => {
        return {
          invokation: await PEtherScenarioContract.deploy<PToken>(world, from, [name.val, symbol.val, decimals.val, registryProxy.val, controller.val, interestRateModel.val, initialExchangeRate.val, initialReserveFactor.val]),
          name: name.val,
          symbol: symbol.val,
          decimals: decimals.toNumber(),
          underlying: "",
          contract: 'PEtherScenario',
          initial_exchange_rate_mantissa: initialExchangeRate.encode().toString(),
          initial_reserve_factor_mantissa: initialReserveFactor.encode().toString()
        };
      }
    ),

      new Fetcher<{underlying: AddressV, symbol: StringV, name: StringV, decimals: NumberV, registryProxy: AddressV, controller: AddressV, interestRateModel: AddressV, initialExchangeRate: NumberV, initialReserveFactor: NumberV}, TokenData>(`
        #### PPIEScenario

        * "PPIEScenario underlying:<Address> symbol:<String> name:<String> registryProxy:<Address> controller:<Address> interestRateModel:<Address> initialExchangeRate:<Number> initialReserveFactor:<Number> decimals:<Number>" - A PToken Scenario for local testing
          * E.g. "PToken Deploy PPIEScenario (underlying Address) pETH \"DeFiPie Ether\" (RegistryProxy Address) (Controller Address) (InterestRateModel Address) 1.0 1.0 8"
      `,
          "PPIEScenario",
          [
              new Arg("underlying", getAddressV),
              new Arg("symbol", getStringV),
              new Arg("name", getStringV),
              new Arg("registryProxy", getAddressV),
              new Arg("controller", getAddressV),
              new Arg("interestRateModel", getAddressV),
              new Arg("initialExchangeRate", getExpNumberV),
              new Arg("initialReserveFactor", getExpNumberV),
              new Arg("decimals", getNumberV)
          ],
          async (world, {underlying, symbol, name, registryProxy, controller, interestRateModel, initialExchangeRate, initialReserveFactor, decimals}) => {
              return {
                  invokation: await PPIEScenarioContract.deploy<PToken>(world, from, [underlying.val, name.val, symbol.val, decimals.val, registryProxy.val, controller.val, interestRateModel.val, initialExchangeRate.val, initialReserveFactor.val]),
                  underlying: underlying.val,
                  name: name.val,
                  symbol: symbol.val,
                  decimals: decimals.toNumber(),
                  contract: 'PPIEScenario',
                  initial_exchange_rate_mantissa: initialExchangeRate.encode().toString(),
                  initial_reserve_factor_mantissa: initialReserveFactor.encode().toString()
              };
          }
      ),

    new Fetcher<{symbol: StringV, name: StringV, decimals: NumberV, registryProxy: AddressV, controller: AddressV, interestRateModel: AddressV, initialExchangeRate: NumberV, initialReserveFactor: NumberV}, TokenData>(`
        #### PEther

        * "PEther symbol:<String> name:<String> registryProxy:<Address> controller:<Address> interestRateModel:<Address> initialExchangeRate:<Number> initialReserveFactor:<Number> decimals:<Number>" - A PToken Scenario for local testing
          * E.g. "PToken Deploy PEther pETH \"DeFiPie Ether\" (Controller Address) (InterestRateModel Address) 1.0 1.0 8"
      `,
      "PEther",
      [
        new Arg("symbol", getStringV),
        new Arg("name", getStringV),
        new Arg("registryProxy", getAddressV),
        new Arg("controller", getAddressV),
        new Arg("interestRateModel", getAddressV),
        new Arg("initialExchangeRate", getExpNumberV),
        new Arg("initialReserveFactor", getExpNumberV),
        new Arg("decimals", getNumberV)
      ],
      async (world, {symbol, name, registryProxy, controller, interestRateModel, initialExchangeRate, initialReserveFactor, decimals}) => {
        return {
          invokation: await PEtherContract.deploy<PToken>(world, from, [registryProxy.val, controller.val, interestRateModel.val, initialExchangeRate.val, initialReserveFactor.val, name.val, symbol.val, decimals.val]),
          name: name.val,
          symbol: symbol.val,
          decimals: decimals.toNumber(),
          underlying: "",
          contract: 'PEther',
          initial_exchange_rate_mantissa: initialExchangeRate.encode().toString(),
          initial_reserve_factor_mantissa: initialReserveFactor.encode().toString()
        };
      }
    ),

    new Fetcher<{symbol: StringV, name: StringV, decimals: NumberV, admin: AddressV, underlying: AddressV, registryProxy: AddressV, controller: AddressV, interestRateModel: AddressV, initialExchangeRate: NumberV, initialReserveFactor: NumberV}, TokenData>(`
        #### PErc20

        * "PErc20 symbol:<String> name:<String> underlying:<Address> registryProxy:<Address> controller:<Address> interestRateModel:<Address> initialExchangeRate:<Number> initialReserveFactor:<Number> decimals:<Number> admin: <Address>" - A official PToken contract
          * E.g. "PToken Deploy PErc20 pZRX \"DeFiPie ZRX\" (Erc20 ZRX Address) (Controller Address) (InterestRateModel Address) 1.0 1.0 8"
      `,
      "PErc20",
      [
        new Arg("symbol", getStringV),
        new Arg("name", getStringV),
        new Arg("underlying", getAddressV),
        new Arg("registryProxy", getAddressV),
        new Arg("controller", getAddressV),
        new Arg("interestRateModel", getAddressV),
        new Arg("initialExchangeRate", getExpNumberV),
        new Arg("initialReserveFactor", getExpNumberV),
        new Arg("decimals", getNumberV),
        new Arg("admin", getAddressV)
      ],
      async (world, {symbol, name, underlying, registryProxy, controller, interestRateModel, initialExchangeRate, initialReserveFactor, decimals, admin}) => {

        return {
          invokation: await PErc20Contract.deploy<PToken>(world, from, [underlying.val, registryProxy.val, controller.val, interestRateModel.val, initialExchangeRate.val, initialReserveFactor.val, name.val, symbol.val, decimals.val, admin.val]),
          name: name.val,
          symbol: symbol.val,
          decimals: decimals.toNumber(),
          underlying: underlying.val,
          contract: 'PErc20',
          initial_exchange_rate_mantissa: initialExchangeRate.encode().toString(),
          initial_reserve_factor_mantissa: initialReserveFactor.encode().toString(),
          admin: admin.val
        };
      }
    ),

    new Fetcher<{symbol: StringV, name: StringV, decimals: NumberV, underlying: AddressV, registryProxy: AddressV, controller: AddressV, interestRateModel: AddressV, initialExchangeRate: NumberV, initialReserveFactor: NumberV}, TokenData>(`
        #### PEvil

        * "PEvil symbol:<String> name:<String> underlying:<Address> registryProxy:<Address> controller:<Address> interestRateModel:<Address> initialExchangeRate:<Number> initialReserveFactor:<Number> decimals:<Number>" - A malicious PToken contract
          * E.g. "PToken Deploy PEvil pEVL \"DeFiPie EVL\" (Erc20 ZRX Address) (Controller Address) (InterestRateModel Address) 1.0 1.0 8"
      `,
      "PEvil",
      [
        new Arg("symbol", getStringV),
        new Arg("name", getStringV),
        new Arg("underlying", getAddressV),
        new Arg("registryProxy", getAddressV),
        new Arg("controller", getAddressV),
        new Arg("interestRateModel", getAddressV),
        new Arg("initialExchangeRate", getExpNumberV),
        new Arg("initialReserveFactor", getExpNumberV),
        new Arg("decimals", getNumberV)
      ],
      async (world, {symbol, name, underlying, registryProxy, controller, interestRateModel, initialExchangeRate, initialReserveFactor, decimals}) => {
        return {
          invokation: await PEvilContract.deploy<PToken>(world, from, [underlying.val, registryProxy.val, controller.val, interestRateModel.val, initialExchangeRate.val, initialReserveFactor.val, name.val, symbol.val, decimals.val]),
          name: name.val,
          symbol: symbol.val,
          decimals: decimals.toNumber(),
          underlying: underlying.val,
          contract: 'PEvil',
          initial_exchange_rate_mantissa: initialExchangeRate.encode().toString(),
          initial_reserve_factor_mantissa: initialReserveFactor.encode().toString()
        };
      }
    ),

    new Fetcher<{symbol: StringV, name: StringV, decimals: NumberV, admin: AddressV, underlying: AddressV, registryProxy: AddressV, controller: AddressV, interestRateModel: AddressV, initialExchangeRate: NumberV, initialReserveFactor: NumberV}, TokenData>(`
        #### Standard

        * "symbol:<String> name:<String> underlying:<Address> registryProxy:<Address> controller:<Address> interestRateModel:<Address> initialExchangeRate:<Number> initialReserveFactor:<Number> decimals:<Number> admin: <Address>" - A official PToken contract
          * E.g. "PToken Deploy Standard pZRX \"DeFiPie ZRX\" (Erc20 ZRX Address) (Controller Address) (InterestRateModel Address) 1.0 1.0 8"
      `,
      "Standard",
      [
        new Arg("symbol", getStringV),
        new Arg("name", getStringV),
        new Arg("underlying", getAddressV),
        new Arg("registryProxy", getAddressV),
        new Arg("controller", getAddressV),
        new Arg("interestRateModel", getAddressV),
        new Arg("initialExchangeRate", getExpNumberV),
        new Arg("initialReserveFactor", getExpNumberV),
        new Arg("decimals", getNumberV),
        new Arg("admin", getAddressV)
      ],
      async (world, {symbol, name, underlying, registryProxy, controller, interestRateModel, initialExchangeRate, initialReserveFactor, decimals, admin}) => {
        // Note: we're going to use the scenario contract as the standard deployment on local networks
        if (world.isLocalNetwork()) {
          return {
            invokation: await PErc20ScenarioContract.deploy<PToken>(world, from, [underlying.val, registryProxy.val, controller.val, interestRateModel.val, initialExchangeRate.val, initialReserveFactor.val, name.val, symbol.val, decimals.val, admin.val]),
            name: name.val,
            symbol: symbol.val,
            decimals: decimals.toNumber(),
            underlying: underlying.val,
            contract: 'PErc20Scenario',
            initial_exchange_rate_mantissa: initialExchangeRate.encode().toString(),
            initial_reserve_factor_mantissa: initialReserveFactor.encode().toString(),
            admin: admin.val
          };
        } else {
          return {
            invokation: await PErc20Contract.deploy<PToken>(world, from, [underlying.val, registryProxy.val, controller.val, interestRateModel.val, initialExchangeRate.val, initialReserveFactor.val, name.val, symbol.val, decimals.val, admin.val]),
            name: name.val,
            symbol: symbol.val,
            decimals: decimals.toNumber(),
            underlying: underlying.val,
            contract: 'PErc20Immutable',
            initial_exchange_rate_mantissa: initialExchangeRate.encode().toString(),
            initial_reserve_factor_mantissa: initialReserveFactor.encode().toString(),
            admin: admin.val
          };
        }
      },
      {catchall: true}
    )
  ];

  let tokenData = await getFetcherValue<any, TokenData>("DeployPToken", fetchers, world, params);

  let invokation = tokenData.invokation;
  delete tokenData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }

  const pToken = invokation.value!;
  tokenData.address = pToken._address;

  world = await storeAndSaveContract(
    world,
    pToken,
    tokenData.symbol,
    invokation,
    [
      { index: ['pTokens', tokenData.symbol], data: tokenData },
      { index: ['Tokens', tokenData.symbol], data: tokenData }
    ]
  );

  return {world, pToken, tokenData};
}
