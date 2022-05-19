import {Contract} from '../Contract';
import {Callable, Sendable} from '../Invokation';
import {encodedNumber} from '../Encoding';

interface ControllerMethods {
  getAccountLiquidity(string): Callable<{0: number, 1: number, 2: number}>
  getHypotheticalAccountLiquidity(account: string, asset: string, redeemTokens: encodedNumber, borrowAmount: encodedNumber): Callable<{0: number, 1: number, 2: number}>
  membershipLength(string): Callable<string>
  checkMembership(user: string, pToken: string): Callable<string>
  checkIsListed(pToken: string): Callable<string>
  getAssetsIn(string): Callable<string[]>
  getAdmin(): Callable<string>
  getOracle(): Callable<string>
  registry(): Callable<string>
  distributor(): Callable<string>
  liquidateGuardian(): Callable<string>
  maxAssets(): Callable<number>
  liquidationIncentiveMantissa(): Callable<number>
  closeFactorMantissa(): Callable<number>
  getBlockNumber(): Callable<number>
  collateralFactor(string): Callable<string>
  markets(string): Callable<{0: boolean, 1: number, 2?: boolean}>
  _setMintPaused(bool): Sendable<number>
  _setMaxAssets(encodedNumber): Sendable<number>
  _setLiquidationIncentive(encodedNumber): Sendable<number>
  _supportMarket(string): Sendable<number>
  _setLiquidateGuardian(string): Sendable<number>
  _setCollateralFactor(string, encodedNumber): Sendable<number>
  _setFeeFactor(string, encodedNumber): Sendable<number>
  _setFeeFactorMaxMantissa(encodedNumber): Sendable<number>
  _setCloseFactor(encodedNumber): Sendable<number>
  enterMarkets(markets: string[]): Sendable<number>
  exitMarket(market: string): Sendable<number>
  fastForward(encodedNumber): Sendable<number>
  _setPendingImplementation(string): Sendable<number>
  controllerImplementation(): Callable<string>
  unlist(string): Sendable<void>
  _setPauseGuardian(string): Sendable<number>
  pauseGuardian(): Callable<string>
  _setMintPaused(market: string, string): Sendable<number>
  _setBorrowPaused(market: string, string): Sendable<number>
  _setTransferPaused(string): Sendable<number>
  _setSeizePaused(string): Sendable<number>
  _mintGuardianPaused(): Callable<boolean>
  _borrowGuardianPaused(): Callable<boolean>
  transferGuardianPaused(): Callable<boolean>
  seizeGuardianPaused(): Callable<boolean>
  mintGuardianPaused(market: string): Callable<boolean>
  borrowGuardianPaused(market: string): Callable<boolean>
  getFeeFactorMantissa(string): Callable<number>
  getBorrowDelay(): Callable<number>
  _setDistributor(string): Sendable<number>
}

export interface Controller extends Contract {
  methods: ControllerMethods
}
