import { Contract } from '../Contract';
import { Sendable } from '../Invokation';

export interface DeFiPieLensMethods {
  pTokenBalances(pToken: string, account: string): Sendable<[string,number,number,number,number,number]>;
  pTokenBalancesAll(pTokens: string[], account: string): Sendable<[string,number,number,number,number,number][]>;
  pTokenMetadata(pToken: string): Sendable<[string,number,number,number,number,number,number,number,number,boolean,number,string,number,number,number]>;
  pTokenMetadataAll(pTokens: string[]): Sendable<[string,number,number,number,number,number,number,number,number,boolean,number,string,number,number,number][]>;
  pTokenUnderlyingPrice(pToken: string): Sendable<[string,number]>;
  pTokenUnderlyingPriceAll(pTokens: string[]): Sendable<[string,number][]>;
  getAccountLimits(controller: string, account: string): Sendable<[string[],number,number]>;
}

export interface DeFiPieLens extends Contract {
  methods: DeFiPieLensMethods;
  name: string;
}
