import { Contract } from '../Contract';
import { Sendable } from '../Invokation';
import {PPieMethods} from './PToken';

interface PPieDelegateMethods extends PPieMethods {
  _becomeImplementation(data: string): Sendable<void>;
  _resignImplementation(): Sendable<void>;
}

export interface PPIEDelegate extends Contract {
  methods: PPieDelegateMethods;
  name: string;
}
