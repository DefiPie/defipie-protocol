import { Contract } from '../Contract';
import { Callable, Sendable } from '../Invokation';
import { encodedNumber } from '../Encoding';

export interface PTokenMethods {
  _resignImplementation(): Sendable<void>;
  balanceOfUnderlying(address: string): Callable<number>;
  borrowBalanceCurrent(address: string): Callable<string>;
  borrowBalanceStored(address: string): Callable<string>;
  totalBorrows(): Callable<string>;
  totalBorrowsCurrent(): Callable<number>;
  totalReserves(): Callable<string>;
  reserveFactorMantissa(): Callable<string>;
  registry(): Callable<string>;
  controller(): Callable<string>;
  exchangeRateStored(): Sendable<number>;
  exchangeRateCurrent(): Callable<number>;
  getCash(): Callable<number>;
  accrueInterest(): Sendable<number>;
  mint(): Sendable<number>;
  mint(amount: encodedNumber): Sendable<number>;
  redeem(amount: encodedNumber): Sendable<number>;
  redeemUnderlying(amount: encodedNumber): Sendable<number>;
  borrow(amount: encodedNumber): Sendable<number>;
  repayBorrow(): Sendable<number>;
  repayBorrow(amount: encodedNumber): Sendable<number>;
  repayBorrowBehalf(amount: string): Sendable<number>;
  repayBorrowBehalf(address: string, amount: encodedNumber): Sendable<number>;
  liquidateBorrow(borrower: string, pTokenCollateral: string): Sendable<number>;
  liquidateBorrow(borrower: string, repayAmount: encodedNumber, pTokenCollateral: string): Sendable<number>;
  seize(liquidator: string, borrower: string, seizeTokens: encodedNumber): Sendable<number>;
  evilSeize(
    treasure: string,
    liquidator: string,
    borrower: string,
    seizeTokens: encodedNumber
  ): Sendable<number>;
  _addReserves(amount: encodedNumber): Sendable<number>;
  _reduceReserves(amount: encodedNumber): Sendable<number>;
  _setReserveFactor(reserveFactor: encodedNumber): Sendable<number>;
  _setInterestRateModel(address: string): Sendable<number>;
  _setController(address: string): Sendable<number>;
  underlying(): Callable<string>;
  interestRateModel(): Callable<string>;
  borrowRatePerBlock(): Callable<number>;
  donate(): Sendable<void>;
  getMyAdmin(): Callable<string>;
  checkpoints(account: string, index: number): Callable<{fromBlock: number, votes: number}>;
  numCheckpoints(account: string): Callable<number>;
  delegate(account: string): Sendable<void>;
  getCurrentVotes(account: string): Callable<number>;
  getPriorVotes(account: string, blockNumber: encodedNumber): Callable<number>;
  balanceOf(address: string): Callable<string>;
  transfer(address: string, amount: encodedNumber): Sendable<boolean>;
  transferScenario(destinations: string[], amount: encodedNumber): Sendable<boolean>;
  transferFromScenario(froms: string[], amount: encodedNumber): Sendable<boolean>;
  startBorrowTimestamp(): Callable<number>;
}

export interface PTokenScenarioMethods extends PTokenMethods {
  setTotalBorrows(amount: encodedNumber): Sendable<void>;
  setTotalReserves(amount: encodedNumber): Sendable<void>;
}

interface Checkpoint {
    fromBlock: number;
    votes: number;
}

export interface PPieMethods extends PTokenMethods {
  checkpoints(account: string, index: number): Callable<{fromBlock: number, votes: number}>;
  numCheckpoints(account: string): Callable<number>;
  delegate(account: string): Sendable<void>;
  getCurrentVotes(account: string): Callable<number>;
  getPriorVotes(account: string, blockNumber: encodedNumber): Callable<number>;
}

export interface PToken extends Contract {
  methods: PTokenMethods;
  name: string;
}

export interface PPie extends Contract {
    methods: PPieMethods;
    name: string;
}

export interface PTokenScenario extends Contract {
  methods: PTokenScenarioMethods;
  name: string;
}
