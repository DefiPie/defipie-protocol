import {Contract} from '../Contract';
import {Callable, Sendable} from '../Invokation';
import {encodedNumber} from '../Encoding';

interface PriceOracleMethods {
  initialize(address: string): Sendable<void>
  assetPrices(asset: string): Callable<number>
  setUnderlyingPrice(pToken: string, amount: encodedNumber): Sendable<number>
  setDirectPrice(asset: string, amount: encodedNumber): Sendable<number>
  getUnderlyingPrice(pToken: string): Callable<number>
  
  // Anchor Price Oracle
  getPrice(asset: string): Callable<number>
  readers(asset: string): Callable<string>
  anchorAdmin(): Callable<string>
  pendingAnchorAdmin(): Callable<string>
  poster(): Callable<string>
  maxSwing(): Callable<number>
  anchors(asset: string): Callable<{0: number, 1: number}>
  pendingAnchors(asset: string): Callable<number>
  _setPendingAnchor(asset: string, price: encodedNumber): Sendable<number>
  _setPaused(paused: boolean): Sendable<number>
  _setPendingAnchorAdmin(string): Sendable<number>
  _acceptAnchorAdmin(): Sendable<number>
  setPrice(asset: string, price: encodedNumber): Sendable<number>
  setPrices(assets: string[], prices: encodedNumber[]): Sendable<number>
}

export interface PriceOracle extends Contract {
  methods: PriceOracleMethods
  name: string
}
