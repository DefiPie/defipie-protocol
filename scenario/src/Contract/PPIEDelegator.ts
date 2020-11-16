import { Contract } from '../Contract';
import { Callable, Sendable } from '../Invokation';
import { PTokenMethods } from './PToken';

interface PPIEDelegatorMethods extends PTokenMethods {
  implementation(): Callable<string>;
  _setImplementation(
    implementation_: string,
    allowResign: boolean,
    becomImplementationData: string
  ): Sendable<void>;
}

export interface PPIEDelegator extends Contract {
  methods: PPIEDelegatorMethods;
  name: string;
}

