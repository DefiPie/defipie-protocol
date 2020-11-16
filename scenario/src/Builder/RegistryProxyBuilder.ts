import {Event} from '../Event';
import {World} from '../World';
import {RegistryProxy} from '../Contract/RegistryProxy';
import {Invokation} from '../Invokation';
import {
    getAddressV,
} from '../CoreValue';
import {
    AddressV,
} from '../Value';
import {Arg, Fetcher, getFetcherValue} from '../Command';
import {storeAndSaveContract} from '../Networks';
import {getContract} from '../Contract';

const ExistingRegistry = getContract("RegistryInterface");
const RegistryProxyContract = getContract("RegistryProxyHarness");

export interface RegistryProxyData {
    invokation: Invokation<RegistryProxy>,
    description: string,
    address?: string,
    contract: string
}

export async function buildRegistryProxy(world: World, from: string, event: Event): Promise<{ world: World, registryProxy: RegistryProxy, registryProxyData: RegistryProxyData }> {
    const fetchers = [
        new Fetcher<{ address: AddressV }, RegistryProxyData>(`
        #### Existing
        * "Existing RegistryProxy address:<Address>" - Wrap an existing RegistryProxy
          * E.g. "RegistryProxy Deploy Existing 0x123...
      `,
            "Existing",
            [
                new Arg("address", getAddressV)
            ],
            async (world, { address }) => {
                const existingRegistryProxy = await ExistingRegistry.at<RegistryProxy>(world, address.val);

                return {
                    invokation: new Invokation<RegistryProxy>(existingRegistryProxy, null, null, null),
                    description: "Existing RegistryProxy",
                    contract: 'RegistryProxy'
                };
            }
        ),
        new Fetcher<
            {
                implementation: AddressV,
                pTokenImplementaion: AddressV;
            }, RegistryProxyData>(
            `
        #### Default
        * "" - The RegistryProxy contract
                  * " implementation:<String> pTokenImplementaion:<String> " - The RegistryProxy contract
          * E.g. "RegistryProxy Deploy (Proxy Address) (PTokenDelegate pErc20Delegate Address)"
      `,
            'Default',
            [
                new Arg('implementation', getAddressV),
                new Arg('pTokenImplementaion', getAddressV),
            ],
            async (world, {
                implementation,
                pTokenImplementaion
            }) => {
                return {
                    invokation: await RegistryProxyContract.deploy<RegistryProxy>(world, from, [
                        implementation.val,
                        pTokenImplementaion.val
                    ]),
                    contract: 'RegistryProxy',
                    description: 'Default RegistryProxy'
                };
            },
            { catchall: true }
        )
    ];

    let registryProxyData = await getFetcherValue<any, RegistryProxyData>("DeployRegistryProxy", fetchers, world, event);
    let invokation = registryProxyData.invokation;
    delete registryProxyData.invokation;

    if (invokation.error) {
        throw invokation.error;
    }
    const registryProxy = invokation.value!;
    registryProxyData.address = registryProxy._address;

    world = await storeAndSaveContract(world, registryProxy,"RegistryProxy", invokation,
                [{index: ['RegistryProxy'],
                            data: {
                                address: registryProxyData.address,
                                contract: registryProxyData.contract,
                                description: registryProxyData.description
                                }
                            }
                        ]
            );

    return {world, registryProxy, registryProxyData};
}