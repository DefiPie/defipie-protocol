import { Contract } from '../Contract';
import { Sendable } from '../Invokation';

interface ControllerImplMethods {
  _become(
    controller: string
  ): Sendable<string>;
}

export interface ControllerImpl extends Contract {
  methods: ControllerImplMethods;
}
