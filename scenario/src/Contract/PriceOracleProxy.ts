import {Contract} from '../Contract';
import {Callable, Sendable} from '../Invokation';
import {encodedNumber} from '../Encoding';

interface PriceOracleProxyMethods {
  getUnderlyingPrice(pToken: string): Callable<number>
  implementaion(): Callable<string>;
  setDirectPrice(asset: string, amount: encodedNumber): Sendable<void>
  setUnderlyingPrice(pToken: string, amount: encodedNumber): Sendable<number>
  assetPrices(asset: string): Callable<number>
}

export interface PriceOracleProxy extends Contract {
  methods: PriceOracleProxyMethods
}
