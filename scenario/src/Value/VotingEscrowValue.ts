import { Event } from '../Event';
import { World } from '../World';
import {
  getAddressV,
} from '../CoreValue';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import {
    AddressV,
    NumberV,
    Value,
    StringV, ListV, MapV
} from '../Value';
import {getWorldContractByAddress, getVotingEscrow, getPie} from '../ContractLookup';
import {encodedNumber} from "../Encoding";
import { VotingEscrow } from '../Contract/VotingEscrow';


async function balanceOf(world: World, votingEscrow: VotingEscrow, user: string): Promise<NumberV> {
  return new NumberV(await votingEscrow.methods.balanceOf(user).call());
}

async function veGetPriorVotes(world: World, votingEscrow: VotingEscrow, account: string, blockNumber: encodedNumber): Promise<NumberV> {
  return new NumberV(await votingEscrow.methods.getPriorVotes(account, blockNumber).call());
}

  
async function getVotingEscrowAddress(world: World, votingEscrow: VotingEscrow): Promise<AddressV> {
  return new AddressV(votingEscrow._address);
}

async function getVotingEscrowName(world: World, votingEscrow: VotingEscrow): Promise<StringV> {
  return new StringV(await votingEscrow.methods.name().call());
}

async function getAdmin(world: World, votingEscrow: VotingEscrow): Promise<StringV> {
  return new StringV(await votingEscrow.methods.getAdmin().call());
}

export function votingEscrowFetchers() {
  return [
    new Fetcher<{ votingEscrow: VotingEscrow }, AddressV>(`
        #### VotingEscrow

        * "VotingEscrow <VotingEscrow> Address" - Returns address of VotingEscrow contract
          * E.g. "VotingEscrow VE Address" - Returns VE's address
      `,
      "Address",
      [
        new Arg("votingEscrow", getVotingEscrow),
      ],
      (world, { votingEscrow }) => getVotingEscrowAddress(world, votingEscrow)
    ),

    new Fetcher<{ votingEscrow: VotingEscrow, user: AddressV}, NumberV>(`
        #### Name

        * "VotingEscrow Address"
          * E.g. "VotingEscrow Name"
      `,
      "balanceOf",
      [
        new Arg("votingEscrow", getVotingEscrow),
        new Arg<AddressV>("user", getAddressV)
      ],
      (world, { votingEscrow, user}) => balanceOf(world, votingEscrow, user.val)
    ),

     new Fetcher<{ votingEscrow: VotingEscrow }, AddressV>(`
        #### Name

        * "VotingEscrow Address"
          * E.g. "VotingEscrow Name"
      `,
      "getAdmin",
      [
        new Arg("votingEscrow", getVotingEscrow)
      ],
      (world, { votingEscrow }) => getAdmin(world, votingEscrow)
    )
      ];        
  }

export async function getVotingEscrowValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("VotingEscrow", votingEscrowFetchers(), world, event);
}
