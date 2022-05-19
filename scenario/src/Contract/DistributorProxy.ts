import { Contract } from '../Contract';
import { Callable, Sendable } from '../Invokation';

interface DistributorProxyMethods {
  _setDistributorImplementation(address: string): Sendable<number>

  implementation(): Callable<string>
  registry(): Callable<string>
  controller(): Callable<string>

  getAdmin(): Callable<string>
  _setPieRate(encodedNumber): Sendable<void>
  _setPieSpeed(pToken: string, encodedNumber): Sendable<void>
  getPieMarkets(): Callable<string[]>

  pieRate(): Callable<number>
  pieSpeeds(string): Callable<string>

  harnessRefreshPieSpeeds(): Sendable<void>
  claimPie(string): Sendable<void>
  _setPieAddress(string): Sendable<number>
  getPieAddress(): Callable<string>

  getBlockNumber(): Callable<number>
  getAllMarkets(): Callable<string[]>

  fastForward(encodedNumber): Sendable<number>

  pieSupplyState(string): Callable<string>
  pieBorrowState(string): Callable<string>
  pieAccrued(string): Callable<string>
  pieSupplierIndex(market: string, account: string): Callable<string>
  pieBorrowerIndex(market: string, account: string): Callable<string>
}

export interface DistributorProxy extends Contract {
  methods: DistributorProxyMethods;
}
