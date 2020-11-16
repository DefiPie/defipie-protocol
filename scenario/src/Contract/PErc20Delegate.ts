import { Contract } from '../Contract';
import { Sendable } from '../Invokation';
import { PTokenMethods, PTokenScenarioMethods } from './PToken';

interface PErc20DelegateMethods extends PTokenMethods {
  _becomeImplementation(data: string): Sendable<void>;
  _resignImplementation(): Sendable<void>;
}

interface PErc20DelegateScenarioMethods extends PTokenScenarioMethods {
  _becomeImplementation(data: string): Sendable<void>;
  _resignImplementation(): Sendable<void>;
}

export interface PErc20Delegate extends Contract {
  methods: PErc20DelegateMethods;
  name: string;
}

export interface PErc20DelegateScenario extends Contract {
  methods: PErc20DelegateScenarioMethods;
  name: string;
}
