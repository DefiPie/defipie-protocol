import { Contract } from '../Contract';
import { Sendable } from '../Invokation';
import { encodedNumber } from '../Encoding';

interface ControllerImplMethods {
  _become(
    controller: string,
    pieRate: encodedNumber,
    pieMarkets: string[]
  ): Sendable<string>;
}

export interface ControllerImpl extends Contract {
  methods: ControllerImplMethods;
}
