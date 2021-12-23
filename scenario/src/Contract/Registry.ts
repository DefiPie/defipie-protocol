import {Contract} from '../Contract';
import {Callable, Sendable} from '../Invokation';

interface RegistryMethods {
    initialize(address: string): Sendable<void>
    _setPTokenImplementation(address: string): Sendable<number>
    implementaion(): Callable<string>
    admin(): Callable<string>
    pendingAdmin(): Callable<string>
    pTokenImplementaion(): Callable<string>

    pPIE(): Callable<string>
    addPPIE(address: string): Sendable<number>
    pETH(): Callable<string>
    addPETH(address: string): Sendable<number>

    pTokens(address: string): Callable<string>
    addPToken(underlying: string, pToken: string): Sendable<number>

    _removePToken(address: string): Sendable<number>

    oracle(): Callable<string>
    _setOracle(string): Sendable<number>
}

export interface Registry extends Contract {
    methods: RegistryMethods
}