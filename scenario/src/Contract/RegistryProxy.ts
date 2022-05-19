import {Contract} from '../Contract';
import {Callable, Sendable} from '../Invokation';

interface RegistryProxyMethods {
    _setImplementation(address: string): Sendable<number>
    _setPendingAdmin(string): Sendable<number>
    _acceptAdmin(): Sendable<void>

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

export interface RegistryProxy extends Contract {
    methods: RegistryProxyMethods
}