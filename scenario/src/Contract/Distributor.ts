import {Contract} from '../Contract';
import {Callable, Sendable} from '../Invokation';
import {encodedNumber} from '../Encoding';

interface DistributorMethods {
  getAdmin(): Callable<string>
  registry(): Callable<string>
  controller(): Callable<string>
  getBlockNumber(): Callable<number>
  _setPieAddress(string): Sendable<number>
  fastForward(encodedNumber): Sendable<number>
  distributorImplementation(): Callable<string>
  _addPieMarkets(markets: string[]): Sendable<void>
  _dropPieMarket(market: string): Sendable<void>
  getPieMarkets(): Callable<string[]>
  harnessRefreshPieSpeeds(): Sendable<void>
  pieRate(): Callable<number>
  pieSupplyState(string): Callable<string>
  pieBorrowState(string): Callable<string>
  pieAccrued(string): Callable<string>
  pieSupplierIndex(market: string, account: string): Callable<string>
  pieBorrowerIndex(market: string, account: string): Callable<string>
  pieSpeeds(string): Callable<string>
  claimPie(string): Sendable<void>
  _grantPie(account: string, encodedNumber): Sendable<void>
  _setPieRate(encodedNumber): Sendable<void>
  _setPieSpeed(pToken: string, encodedNumber): Sendable<void>
  getPieAddress(): Callable<string>
}

export interface Distributor extends Contract {
  methods: DistributorMethods
}
