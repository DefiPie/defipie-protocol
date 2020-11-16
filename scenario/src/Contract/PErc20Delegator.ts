import { Contract } from '../Contract';
import { Callable, Sendable } from '../Invokation';
import { PTokenMethods } from './PToken';
import { encodedNumber } from '../Encoding';

interface PErc20DelegatorMethods extends PTokenMethods {
  implementation(): Callable<string>;
  _setImplementation(
    implementation_: string,
    allowResign: boolean,
    becomImplementationData: string
  ): Sendable<void>;
}

interface PErc20DelegatorScenarioMethods extends PErc20DelegatorMethods {
  setTotalBorrows(amount: encodedNumber): Sendable<void>;
  setTotalReserves(amount: encodedNumber): Sendable<void>;
}

export interface PErc20Delegator extends Contract {
  methods: PErc20DelegatorMethods;
  name: string;
}

export interface PErc20DelegatorScenario extends Contract {
  methods: PErc20DelegatorMethods;
  name: string;
}
