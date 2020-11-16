import {Contract} from '../Contract';
import {Callable, Sendable} from '../Invokation';

interface RegistryMethods {
    initialize(address: string): Sendable<void>
    setPTokenImplementation(address: string): Sendable<number>
    implementaion(): Callable<string>
    admin(): Callable<string>
    pendingAdmin(): Callable<string>
    pTokenImplementaion(): Callable<string>

    pPIE(): Callable<string>
    addPPIE(address: string): Sendable<number>
}

export interface Registry extends Contract {
    methods: RegistryMethods
}