import { Contract } from '../Contract';
import { Callable, Sendable } from '../Invokation';
import { encodedNumber } from '../Encoding';

export interface Point {
  bias: number,
  slope: number,
  ts: number,
  blk: number
}

export interface LockedBalance {
  amount: number,
  start: number,
  end: number
}

export interface VotingEscrowMethods {
    delegateAt(user: string, index: number): Callable<string>;
    delegateOf(user: string): Callable<string>;
    locked(user: string): Callable<LockedBalance>;
    epoch(): Callable<number>;
    pointHistory(epoch: number): Callable<Point>;
    userPointHistory(account: string, epoch: number): Callable<Point>;
    userPointEpoch(account: string): Callable<number>;
    slopeChanges(epoch: number): Callable<number>;
    delegateLength(user: string): Callable<number>;
    getLastUserSlope(user: string): Callable<number>;
    getCheckpointTime(user: string, id: number): Callable<number>;
    getUnlockTime(user: string): Callable<number>;
    getStartTime(user: string): Callable<number>;
    getAmount(user: string): Callable<number>;
    getPriorVotes(account: string, blockNumber: encodedNumber): Callable<number>;

    depositFor(user: string, value: encodedNumber): Sendable<void>;
    createLockFor(user: string, value: number, duration: number): Sendable<void>;
    createLock(value: encodedNumber, duration: encodedNumber): Sendable<void>;
    increaseAmountFor(user: string, value: number): Sendable<void>;
    increaseAmount(value: number): Sendable<void>;
    increaseUnlockTime(duration: number): Sendable<void>;
    withdraw(): Sendable<void>;
    delegate(user: string): Sendable<void>;

    balanceOf(user: string): Callable<number>;
    balanceOf(user: string, t: number): Callable<number>;
    balanceOfAt(user: string, block: number): Callable<number>;
    totalSupply(): Callable<number>;
    totalSupply(t: number): Callable<number>
    totalSupplyAt(block: number): Callable<number>;
    name(): Callable<string>;
    symbol(): Callable<string>;
    getAdmin(): Callable<string>;
  
    setBlockNumber(blockNumber: encodedNumber): Sendable<void>;
    setBlockTimestamp(blockTimestamp: encodedNumber): Sendable<void>;
}
  
export interface VotingEscrow extends Contract {
    methods: VotingEscrowMethods;
}
  