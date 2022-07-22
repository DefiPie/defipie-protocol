import { Event } from "../Event";
import { World } from "../World";
import { VotingEscrow } from "../Contract/VotingEscrow";
import { Invokation } from "../Invokation";
import { getAddressV, getNumberV, getStringV } from "../CoreValue";
import { AddressV, NumberV, StringV } from "../Value";
import { Arg, Fetcher, getFetcherValue } from "../Command";
import { storeAndSaveContract } from "../Networks";
import { getContract } from "../Contract";

const VotingEscrowHarnessContract = getContract("VotingEscrowHarness");
const VotingEscrowContract = getContract('VotingEscrow');

export interface VotingEscrowData {
  invokation: Invokation<VotingEscrow>;
  description:string,
  address?: string,
  contract: string
}


export async function buildVotingEscrow(
  world: World,
  from: string,
  params: Event
): Promise<{ world: World; votingEscrow: VotingEscrow; veData: VotingEscrowData }> {
  const fetchers = [
  new Fetcher<{
      name: StringV, 
      registry: AddressV, 
      token: AddressV, 
      governor: AddressV 
  }, VotingEscrowData>(`
    #### VotingEscrowHarness

    * "VotingEscrowHarness Deploy  " - Deploys DeFiPie VotingEscrow
      * E.g. "VotingEscrow Deploy name Address Address Address"
  `,
    'Harness',
    [
      new Arg("name", getStringV),
      new Arg("registry", getAddressV),
      new Arg("token", getAddressV),
      new Arg("governor", getAddressV),
    ],
    async (world,{
        name,
        registry, 
        token, 
        governor 
    }) => {
      return {
        invokation: await VotingEscrowHarnessContract.deploy<VotingEscrow>(world,from,[
            registry.val, 
            token.val, 
            name.val, 
            `${name.val}pie`, 
            604800, 
            604800, 
            125798400, 
            1000000000, 
            governor.val
        ]),
        contract: "VotingEscrow",
        description: "Harness VotingEscrow"
      };
    },
    { catchall: true }
  ),
  new Fetcher<{

  }, VotingEscrowData>(`
    #### VotingEscrowHarness
    * "VotingEscrowHarness Deploy  " - Deploys DeFiPie VotingEscrow
      * E.g. "VotingEscrow Deploy Harness"
  `,
    'Default',
    [
    ],
    async (world,{
  
    }) => {
      return {
        invokation: await VotingEscrowContract.deploy<VotingEscrow>(world,from,[
  
        ]),
        contract: "VotingEscrow",
        description: "Default VotingEscrow"
      };
    },
    { catchall: true }
  )];

  let veData = await getFetcherValue<any, VotingEscrowData>(
    "DeployVotingEscrow",
    fetchers,
    world,
    params
  );
  let invokation = veData.invokation;
  delete veData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }

  const votingEscrow = invokation.value!;
  veData.address = votingEscrow._address;

  world = await storeAndSaveContract(world, votingEscrow,"VotingEscrow", invokation, [
    {
      index: ['VotingEscrow'],
      data: {
        address: veData.address,
        contract: veData.contract,
        description: veData.description
      }
    }
  ]);

  return { world, votingEscrow, veData };
}