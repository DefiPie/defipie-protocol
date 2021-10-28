import { Contract } from '../Contract';
import { Callable, Sendable } from '../Invokation';

interface UnitrollerMethods {
  getAdmin(): Callable<string>;
  _setPendingImplementation(pendingImpl: string): Sendable<number>;
  controllerImplementation(): Callable<string>;
  pendingControllerImplementation(): Callable<string>;
}

export interface Unitroller extends Contract {
  methods: UnitrollerMethods;
}
