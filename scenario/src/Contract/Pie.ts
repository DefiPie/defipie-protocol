import { Contract } from '../Contract';
import { encodedNumber } from '../Encoding';
import { Callable, Sendable } from '../Invokation';

export interface PieMethods {
  name(): Callable<string>;
  symbol(): Callable<string>;
  decimals(): Callable<number>;
  totalSupply(): Callable<number>;
  balanceOf(address: string): Callable<string>;
  allowance(owner: string, spender: string): Callable<string>;
  approve(address: string, amount: encodedNumber): Sendable<number>;
  transfer(address: string, amount: encodedNumber): Sendable<boolean>;
  transferFrom(owner: string, spender: string, amount: encodedNumber): Sendable<boolean>;
  setBlockNumber(blockNumber: encodedNumber): Sendable<void>;
}

export interface PieScenarioMethods extends PieMethods {
  transferScenario(destinations: string[], amount: encodedNumber): Sendable<boolean>;
  transferFromScenario(froms: string[], amount: encodedNumber): Sendable<boolean>;
}

export interface Pie extends Contract {
  methods: PieMethods;
  name: string;
}

export interface PieScenario extends Contract {
  methods: PieScenarioMethods;
  name: string;
}
