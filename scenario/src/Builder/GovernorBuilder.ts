import { Event } from "../Event";
import { World } from "../World";
import { Governor } from "../Contract/Governor";
import { Invokation } from "../Invokation";
import { getAddressV, getNumberV, getStringV } from "../CoreValue";
import { AddressV, NumberV, StringV } from "../Value";
import { Arg, Fetcher, getFetcherValue } from "../Command";
import { storeAndSaveContract } from "../Networks";
import { getContract } from "../Contract";

const GovernorContract = getContract("Governor");
const GovernorHarnessContract = getContract("GovernorHarness");

export interface GovernorData {
  invokation: Invokation<Governor>;
  name: string;
  contract: string;
  address?: string;
}

export async function buildGovernor(
  world: World,
  from: string,
  params: Event
): Promise<{ world: World; governor: Governor; govData: GovernorData }> {
  const fetchers = [
    new Fetcher<
      { name: StringV, timelock: AddressV, registryProxy: AddressV, guardian: AddressV },
      GovernorData
    >(
      `
      #### Governor

      * "Governor Deploy name:<String> timelock:<Address> registryProxy:<Address> guardian:<Address>" - Deploys DeFiPie Governor
        * E.g. "Governor Deploy Governor (Address Timelock) (Address RegistryProxy) Guardian"
    `,
      "Governor",
      [
        new Arg("name", getStringV),
        new Arg("timelock", getAddressV),
        new Arg("registryProxy", getAddressV),
        new Arg("guardian", getAddressV)
      ],
      async (world, { name, timelock, registryProxy, guardian }) => {
        return {
          invokation: await GovernorContract.deploy<Governor>(
            world,
            from,
            [timelock.val, registryProxy.val, guardian.val]
          ),
          name: name.val,
          contract: "Governor"
        };
      }
    ),
    new Fetcher<
      { name: StringV, timelock: AddressV, registryProxy: AddressV, guardian: AddressV},
      GovernorData
    >(
      `
      #### GovernorHarness

      * "Governor Deploy GovernorHarness name:<String> timelock:<Address> registryProxy:<Address> guardian:<Address>" - Deploys DeFiPie Governor with a mocked voting period
        * E.g. "Governor Deploy Harness GovernorHarness (Address Timelock) (Address RegistryProxy) Guardian"
    `,
      "GovernorHarness",
      [
        new Arg("name", getStringV),
        new Arg("timelock", getAddressV),
        new Arg("registryProxy", getAddressV),
        new Arg("guardian", getAddressV)
      ],
      async (world, { name, timelock, registryProxy, guardian }) => {
        return {
          invokation: await GovernorHarnessContract.deploy<Governor>(
            world,
            from,
            [timelock.val, registryProxy.val, guardian.val]
          ),
          name: name.val,
          contract: "GovernorHarness"
        };
      }
    )

  ];

  let govData = await getFetcherValue<any, GovernorData>(
    "DeployGovernor",
    fetchers,
    world,
    params
  );
  let invokation = govData.invokation;
  delete govData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }

  const governor = invokation.value!;
  govData.address = governor._address;

  world = await storeAndSaveContract(
    world,
    governor,
    govData.name,
    invokation,
    [
      { index: ["Governor", govData.name], data: govData },
    ]
  );

  return { world, governor, govData };
}
