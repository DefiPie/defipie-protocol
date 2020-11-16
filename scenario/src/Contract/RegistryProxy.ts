import {Contract} from '../Contract';
import {Callable, Sendable} from '../Invokation';

interface RegistryProxyMethods {
    setPTokenImplementation(address: string): Sendable<number>
    setImplementation(address: string): Sendable<number>

    _setPendingAdmin(string): Sendable<number>
    _acceptAdmin(): Sendable<void>

    implementaion(): Callable<string>
    admin(): Callable<string>
    pendingAdmin(): Callable<string>
    pTokenImplementaion(): Callable<string>

    pPIE(): Callable<string>
    addPPIE(address: string): Sendable<number>
}

export interface RegistryProxy extends Contract {
    methods: RegistryProxyMethods
}