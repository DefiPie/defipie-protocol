import { Event } from '../Event';
import { World } from '../World';
import { PToken} from '../Contract/PToken';
import { PErc20Delegator } from '../Contract/PErc20Delegator';
import {
  getAddressV,
  getNumberV,
  getCoreValue,
  getStringV,
  mapValue
} from '../CoreValue';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import {
    AddressV,
    NumberV,
    Value,
    AnythingV,
    StringV, ListV, MapV
} from '../Value';
import {getWorldContractByAddress, getPTokenAddress, getPie} from '../ContractLookup';
import {Pie} from "../Contract/Pie";
import {encodedNumber} from "../Encoding";

export async function getPTokenV(world: World, event: Event): Promise<PToken> {
  const address = await mapValue<AddressV>(
    world,
    event,
    (str) => new AddressV(getPTokenAddress(world, str)),
    getCoreValue,
    AddressV
  );

  return getWorldContractByAddress<PToken>(world, address.val);
}

export async function getPErc20DelegatorV(world: World, event: Event): Promise<PErc20Delegator> {
  const address = await mapValue<AddressV>(
    world,
    event,
    (str) => new AddressV(getPTokenAddress(world, str)),
    getCoreValue,
    AddressV
  );

  return getWorldContractByAddress<PErc20Delegator>(world, address.val);
}

async function getInterestRateModel(world: World, pToken: PToken): Promise<AddressV> {
  return new AddressV(await pToken.methods.interestRateModel().call());
}

async function pTokenAddress(world: World, pToken: PToken): Promise<AddressV> {
  return new AddressV(pToken._address);
}

async function getPTokenAdmin(world: World, pToken: PToken): Promise<AddressV> {
  return new AddressV(await pToken.methods.getMyAdmin().call());
}

async function balanceOfUnderlying(world: World, pToken: PToken, user: string): Promise<NumberV> {
  return new NumberV(await pToken.methods.balanceOfUnderlying(user).call());
}

async function getBorrowBalance(world: World, pToken: PToken, user): Promise<NumberV> {
  return new NumberV(await pToken.methods.borrowBalanceCurrent(user).call());
}

async function getBorrowBalanceStored(world: World, pToken: PToken, user): Promise<NumberV> {
  return new NumberV(await pToken.methods.borrowBalanceStored(user).call());
}

async function getTotalBorrows(world: World, pToken: PToken): Promise<NumberV> {
  return new NumberV(await pToken.methods.totalBorrows().call());
}

async function getTotalBorrowsCurrent(world: World, pToken: PToken): Promise<NumberV> {
  return new NumberV(await pToken.methods.totalBorrowsCurrent().call());
}

async function getReserveFactor(world: World, pToken: PToken): Promise<NumberV> {
  return new NumberV(await pToken.methods.reserveFactorMantissa().call(), 1.0e18);
}

async function getTotalReserves(world: World, pToken: PToken): Promise<NumberV> {
  return new NumberV(await pToken.methods.totalReserves().call());
}

async function getController(world: World, pToken: PToken): Promise<AddressV> {
    return new AddressV(await pToken.methods.controller().call());
}

async function getRegistry(world: World, pToken: PToken): Promise<AddressV> {
    return new AddressV(await pToken.methods.registry().call());
}

async function getExchangeRateStored(world: World, pToken: PToken): Promise<NumberV> {
  return new NumberV(await pToken.methods.exchangeRateStored().call());
}

async function getExchangeRate(world: World, pToken: PToken): Promise<NumberV> {
  return new NumberV(await pToken.methods.exchangeRateCurrent().call(), 1e18);
}

async function getCash(world: World, pToken: PToken): Promise<NumberV> {
  return new NumberV(await pToken.methods.getCash().call());
}

async function getInterestRate(world: World, pToken: PToken): Promise<NumberV> {
  return new NumberV(await pToken.methods.borrowRatePerBlock().call(), 1.0e18 / 2102400);
}

async function getImplementation(world: World, pToken: PToken): Promise<AddressV> {
  return new AddressV(await (pToken as PErc20Delegator).methods.implementation().call());
}

async function ppieGetCurrentVotes(world: World, pToken: PToken, account: string): Promise<NumberV> {
    return new NumberV(await pToken.methods.getCurrentVotes(account).call());
}

async function ppieGetPriorVotes(world: World, pToken: PToken, account: string, blockNumber: encodedNumber): Promise<NumberV> {
    return new NumberV(await pToken.methods.getPriorVotes(account, blockNumber).call());
}

async function ppieNumCheckpoints(world: World, pToken: PToken, account: string): Promise<NumberV> {
    return new NumberV(await pToken.methods.numCheckpoints(account).call());
}

interface Checkpoint {
    fromBlock: number;
    votes: number;
}

async function ppieCheckpointsBlock(world: World, pToken: PToken, account: string, index: number): Promise<NumberV> {
    let {fromBlock: fromBlock_, votes: votes_} = await pToken.methods.checkpoints(account, index).call();
    return new NumberV(Number(fromBlock_));
}

async function ppiePrevCheckpointsBlock(world: World, pToken: PToken, account: string): Promise<NumberV> {
    let index = await pToken.methods.numCheckpoints(account).call();
    let {fromBlock: fromBlock_, votes: votes_} = await pToken.methods.checkpoints(account, (index - 1)).call();
    return new NumberV(Number(fromBlock_));
}
async function ppieCheckpointsVotes(world: World, pToken: PToken, account: string, index: number): Promise<NumberV> {
    let {fromBlock: fromBlock_, votes: votes_} = await pToken.methods.checkpoints(account, index).call();
    return new NumberV(Number(votes_));
}

export function pTokenFetchers() {
  return [
    new Fetcher<{ pToken: PToken }, AddressV>(`
        #### Address

        * "PToken <PToken> Address" - Returns address of PToken contract
          * E.g. "PToken pZRX Address" - Returns pZRX's address
      `,
      "Address",
      [
        new Arg("pToken", getPTokenV)
      ],
      (world, { pToken }) => pTokenAddress(world, pToken),
      { namePos: 1 }
    ),

    new Fetcher<{ pToken: PToken }, AddressV>(`
        #### InterestRateModel

        * "PToken <PToken> InterestRateModel" - Returns the interest rate model of PToken contract
          * E.g. "PToken pZRX InterestRateModel" - Returns pZRX's interest rate model
      `,
      "InterestRateModel",
      [
        new Arg("pToken", getPTokenV)
      ],
      (world, { pToken }) => getInterestRateModel(world, pToken),
      { namePos: 1 }
    ),

    new Fetcher<{ pToken: PToken }, AddressV>(`
        #### Admin

        * "PToken <PToken> Admin" - Returns the admin of PToken contract
          * E.g. "PToken pZRX Admin" - Returns pZRX's admin
      `,
      "Admin",
      [
        new Arg("pToken", getPTokenV)
      ],
      (world, { pToken }) => getPTokenAdmin(world, pToken),
      { namePos: 1 }
    ),

    new Fetcher<{ pToken: PToken }, AddressV>(`
        #### Underlying

        * "PToken <PToken> Underlying" - Returns the underlying asset (if applicable)
          * E.g. "PToken pZRX Underlying"
      `,
      "Underlying",
      [
        new Arg("pToken", getPTokenV)
      ],
      async (world, { pToken }) => new AddressV(await pToken.methods.underlying().call()),
      { namePos: 1 }
    ),

    new Fetcher<{ pToken: PToken, address: AddressV }, NumberV>(`
        #### UnderlyingBalance

        * "PToken <PToken> UnderlyingBalance <User>" - Returns a user's underlying balance (based on given exchange rate)
          * E.g. "PToken pZRX UnderlyingBalance Geoff"
      `,
      "UnderlyingBalance",
      [
        new Arg("pToken", getPTokenV),
        new Arg<AddressV>("address", getAddressV)
      ],
      (world, { pToken, address }) => balanceOfUnderlying(world, pToken, address.val),
      { namePos: 1 }
    ),

    new Fetcher<{ pToken: PToken, address: AddressV }, NumberV>(`
        #### BorrowBalance

        * "PToken <PToken> BorrowBalance <User>" - Returns a user's borrow balance (including interest)
          * E.g. "PToken pZRX BorrowBalance Geoff"
      `,
      "BorrowBalance",
      [
        new Arg("pToken", getPTokenV),
        new Arg("address", getAddressV)
      ],
      (world, { pToken, address }) => getBorrowBalance(world, pToken, address.val),
      { namePos: 1 }
    ),

    new Fetcher<{ pToken: PToken, address: AddressV }, NumberV>(`
        #### BorrowBalanceStored

        * "PToken <PToken> BorrowBalanceStored <User>" - Returns a user's borrow balance (without specifically re-accruing interest)
          * E.g. "PToken pZRX BorrowBalanceStored Geoff"
      `,
      "BorrowBalanceStored",
      [
        new Arg("pToken", getPTokenV),
        new Arg("address", getAddressV)
      ],
      (world, { pToken, address }) => getBorrowBalanceStored(world, pToken, address.val),
      { namePos: 1 }
    ),

    new Fetcher<{ pToken: PToken }, NumberV>(`
        #### TotalBorrows

        * "PToken <PToken> TotalBorrows" - Returns the pToken's total borrow balance
          * E.g. "PToken pZRX TotalBorrows"
      `,
      "TotalBorrows",
      [
        new Arg("pToken", getPTokenV)
      ],
      (world, { pToken }) => getTotalBorrows(world, pToken),
      { namePos: 1 }
    ),

    new Fetcher<{ pToken: PToken }, NumberV>(`
        #### TotalBorrowsCurrent

        * "PToken <PToken> TotalBorrowsCurrent" - Returns the pToken's total borrow balance with interest
          * E.g. "PToken pZRX TotalBorrowsCurrent"
      `,
      "TotalBorrowsCurrent",
      [
        new Arg("pToken", getPTokenV)
      ],
      (world, { pToken }) => getTotalBorrowsCurrent(world, pToken),
      { namePos: 1 }
    ),

    new Fetcher<{ pToken: PToken }, NumberV>(`
        #### Reserves

        * "PToken <PToken> Reserves" - Returns the pToken's total reserves
          * E.g. "PToken pZRX Reserves"
      `,
      "Reserves",
      [
        new Arg("pToken", getPTokenV)
      ],
      (world, { pToken }) => getTotalReserves(world, pToken),
      { namePos: 1 }
    ),

    new Fetcher<{ pToken: PToken }, NumberV>(`
        #### ReserveFactor

        * "PToken <PToken> ReserveFactor" - Returns reserve factor of PToken contract
          * E.g. "PToken pZRX ReserveFactor" - Returns pZRX's reserve factor
      `,
      "ReserveFactor",
      [
        new Arg("pToken", getPTokenV)
      ],
      (world, { pToken }) => getReserveFactor(world, pToken),
      { namePos: 1 }
    ),

    new Fetcher<{ pToken: PToken }, AddressV>(`
        #### Controller

        * "PToken <PToken> Controller" - Returns the pToken's controller
          * E.g. "PToken pZRX Controller"
      `,
      "Controller",
      [
        new Arg("pToken", getPTokenV)
      ],
      (world, { pToken }) => getController(world, pToken),
      { namePos: 1 }
    ),

    new Fetcher<{ pToken: PToken }, AddressV>(`
    #### Registry
    
    * "PToken <PToken> Registry" - Returns the pToken's registry
      * E.g. "PToken pZRX Registry"
    `,
      "Registry",
      [
          new Arg("pToken", getPTokenV)
      ],
      (world, { pToken }) => getRegistry(world, pToken),
      { namePos: 1 }
    ),

    new Fetcher<{ pToken: PToken }, NumberV>(`
        #### ExchangeRateStored

        * "PToken <PToken> ExchangeRateStored" - Returns the pToken's exchange rate (based on balances stored)
          * E.g. "PToken pZRX ExchangeRateStored"
      `,
      "ExchangeRateStored",
      [
        new Arg("pToken", getPTokenV)
      ],
      (world, { pToken }) => getExchangeRateStored(world, pToken),
      { namePos: 1 }
    ),

    new Fetcher<{ pToken: PToken }, NumberV>(`
        #### ExchangeRate

        * "PToken <PToken> ExchangeRate" - Returns the pToken's current exchange rate
          * E.g. "PToken pZRX ExchangeRate"
      `,
      "ExchangeRate",
      [
        new Arg("pToken", getPTokenV)
      ],
      (world, { pToken }) => getExchangeRate(world, pToken),
      { namePos: 1 }
    ),

    new Fetcher<{ pToken: PToken }, NumberV>(`
        #### Cash

        * "PToken <PToken> Cash" - Returns the pToken's current cash
          * E.g. "PToken pZRX Cash"
      `,
      "Cash",
      [
        new Arg("pToken", getPTokenV)
      ],
      (world, { pToken }) => getCash(world, pToken),
      { namePos: 1 }
    ),

    new Fetcher<{ pToken: PToken }, NumberV>(`
        #### InterestRate

        * "PToken <PToken> InterestRate" - Returns the pToken's current interest rate
          * E.g. "PToken pZRX InterestRate"
      `,
      "InterestRate",
      [
        new Arg("pToken", getPTokenV)
      ],
      (world, {pToken}) => getInterestRate(world, pToken),
      {namePos: 1}
    ),
    new Fetcher<{pToken: PToken, signature: StringV}, NumberV>(`
        #### CallNum

        * "PToken <PToken> Call <signature>" - Simple direct call method, for now with no parameters
          * E.g. "PToken pZRX CallNum \"borrowIndex()\""
      `,
      "CallNum",
      [
        new Arg("pToken", getPTokenV),
        new Arg("signature", getStringV),
      ],
      async (world, {pToken, signature}) => {
        const res = await world.web3.eth.call({
            to: pToken._address,
            data: world.web3.eth.abi.encodeFunctionSignature(signature.val)
          });
        const resNum : any = world.web3.eth.abi.decodeParameter('uint256',res);
        return new NumberV(resNum);
      }
      ,
      {namePos: 1}
    ),
    new Fetcher<{ pToken: PToken }, AddressV>(`
        #### Implementation

        * "PToken <PToken> Implementation" - Returns the pToken's current implementation
          * E.g. "PToken cDAI Implementation"
      `,
      "Implementation",
      [
        new Arg("pToken", getPTokenV)
      ],
      (world, { pToken }) => getImplementation(world, pToken),
      { namePos: 1 }
    ),

      new Fetcher<{ pToken: PToken, account: AddressV }, NumberV>(`
        #### GetCurrentVotes

        * "PToken <PToken> GetCurrentVotes account:<Address>" - Returns the current PPie votes balance for an account
          * E.g. "PToken pPIE GetCurrentVotes Geoff" - Returns the current PPie vote balance of Geoff
      `,
          "GetCurrentVotes",
          [
              new Arg("pToken", getPTokenV),
              new Arg("account", getAddressV),
          ],
          async (world, { pToken, account }) => ppieGetCurrentVotes(world, pToken, account.val),
          { namePos: 1 }
      ),

      new Fetcher<{ pToken: PToken, account: AddressV, blockNumber: NumberV }, NumberV>(`
        #### GetPriorVotes

        * "PToken <PToken> GetPriorVotes account:<Address> blockBumber:<Number>" - Returns the current PPie votes balance at given block
          * E.g. "PToken pPIE GetPriorVotes Geoff 5" - Returns the PPie vote balance for Geoff at block 5
      `,
          "GetPriorVotes",
          [
              new Arg("pToken", getPTokenV),
              new Arg("account", getAddressV),
              new Arg("blockNumber", getNumberV),
          ],
          async (world, { pToken, account, blockNumber }) => ppieGetPriorVotes(world, pToken, account.val, blockNumber.encode()),
          { namePos: 1 }
      ),

      new Fetcher<{  pToken: PToken, account: AddressV }, NumberV>(`
        #### GetCurrentVotesBlock

        * "PToken <PToken> GetCurrentVotesBlock account:<Address>" - Returns the current PPie votes checkpoint block for an account
          * E.g. "PToken pPIE GetCurrentVotesBlock Geoff" - Returns the current PPie votes checkpoint block for Geoff
      `,
          "GetCurrentVotesBlock",
          [
              new Arg("pToken", getPTokenV),
              new Arg("account", getAddressV),
          ],
          async (world, { pToken, account }) => ppiePrevCheckpointsBlock(world, pToken, account.val),
          { namePos: 1 }
      ),

      new Fetcher<{ pToken: PToken, account: AddressV }, NumberV>(`
        #### VotesLength

        * "PToken <PToken> VotesLength account:<Address>" - Returns the PPie vote checkpoint array length
          * E.g. "PToken pPIE VotesLength Geoff" - Returns the PPie vote checkpoint array length of Geoff
      `,
          "VotesLength",
          [
              new Arg("pToken", getPTokenV),
              new Arg("account", getAddressV),
          ],
          async (world, { pToken, account }) => ppieNumCheckpoints(world, pToken, account.val),
          { namePos: 1 }
      ),

      new Fetcher<{ pToken: PToken, address: AddressV }, NumberV>(`
        #### TokenBalance

        * "PToken <PToken> TokenBalance <Address>" - Returns the Pie token balance of a given address
          * E.g. "PToken pPIE TokenBalance Geoff" - Returns Geoff's Pie balance
      `,
          "TokenBalance",
          [
              new Arg("pToken", getPTokenV),
              new Arg("address", getAddressV)
          ],
          async (world, { pToken, address }) => new NumberV(await pToken.methods.balanceOf(address.val).call()),
          { namePos: 1 }
      ),

      new Fetcher<{ pToken: PToken, account: AddressV }, ListV>(`
        #### AllVotes

        * "PToken <PToken> AllVotes account:<Address>" - Returns information about all votes an account has had
          * E.g. "PToken pPIE AllVotes Geoff" - Returns the PPie vote checkpoint array
      `,
          "AllVotes",
          [
              new Arg("pToken", getPTokenV),
              new Arg("account", getAddressV),
          ],
          async (world, { pToken, account }) => {
              const numCheckpoints = await Number(await ppieNumCheckpoints(world, pToken, account.val));
              const checkpoints = await Promise.all(new Array(numCheckpoints).fill(undefined).map(async (_, i) => {
                  const fromBlock = await ppieCheckpointsBlock(world, pToken, account.val, i);
                  const votes = await Number(await ppieCheckpointsVotes(world, pToken, account.val, i));

                  return new StringV(`Block ${fromBlock}: ${votes} vote${votes !== 1 ? "s" : ""}`);
              }));

              return new ListV(checkpoints);
          },
         { namePos: 1 }
      )
  ];
}

export async function getPTokenValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("pToken", pTokenFetchers(), world, event);
}
