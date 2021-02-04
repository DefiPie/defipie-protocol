import {Event} from '../Event';
import {addAction, describeUser, World} from '../World';
import {RegistryErrorReporter} from '../ErrorReporter';
import { Registry } from '../Contract/Registry';

import {invoke} from '../Invokation';
import {buildRegistry} from '../Builder/RegistryBuilder';
import {
    getAddressV,
    getEventV,
} from '../CoreValue';
import {
    AddressV,
    EventV,
} from '../Value';
import {Arg, Command, processCommandEvent} from '../Command';
import {getRegistry} from "../ContractLookup";

async function genToken(world: World, from: string, params: Event): Promise<World> {
    let {world: newWorld, registry, registryData} = await buildRegistry(world, from, params);
    world = newWorld;

    world = addAction(
        world,
        `Added Registry (${registryData.description}) at address ${registry._address}`,
        registryData.invokation
    );

    return world;
}

async function setPTokenImplementation(world: World, from: string, registry: Registry, newImplementation: string): Promise<World> {
    let invokation = await invoke(world, registry.methods.setPTokenImplementation(newImplementation), from, RegistryErrorReporter);

    world = addAction(
        world,
        `Called set PToken Implementation ${newImplementation} as ${describeUser(world, from)}`,
        invokation
    );

    return world;
}

async function setAddPToken(world: World, from: string, registry: Registry, newUnderlying: string, newPToken: string): Promise<World> {
    let invokation = await invoke(world, registry.methods.addPToken(newUnderlying, newPToken), from, RegistryErrorReporter);

    world = addAction(
        world,
        `Called add newPToken address ${newPToken} as ${describeUser(world, from)}`,
        invokation
    );

    return world;
}

async function setAddPPIE(world: World, from: string, registry: Registry, newPPIE: string): Promise<World> {
    let invokation = await invoke(world, registry.methods.addPPIE(newPPIE), from, RegistryErrorReporter);

    world = addAction(
        world,
        `Called add PPIE address ${newPPIE} as ${describeUser(world, from)}`,
        invokation
    );

    return world;
}

async function setAddPETH(world: World, from: string, registry: Registry, newPETH: string): Promise<World> {
    let invokation = await invoke(world, registry.methods.addPETH(newPETH), from, RegistryErrorReporter);

    world = addAction(
        world,
        `Called add PETH address ${newPETH} as ${describeUser(world, from)}`,
        invokation
    );

    return world;
}

async function removePTokenFromRegistry(world: World, from: string, registry: Registry, pToken: string): Promise<World> {
    let invokation = await invoke(world, registry.methods.removePToken(pToken), from, RegistryErrorReporter);

    world = addAction(
        world,
        `Called remove PToken ${pToken} as ${describeUser(world, from)}`,
        invokation
    );

    return world;
}

async function initialize(world: World, from: string, registry: Registry, pTokenImplementation: string): Promise<World> {
    let invokation = await invoke(world, registry.methods.initialize(pTokenImplementation), from, RegistryErrorReporter);

    world = addAction(
        world,
        `Called set PToken Implementation ${pTokenImplementation} as ${describeUser(world, from)}`,
        invokation
    );

    return world;
}

export function registryCommands() {
    return [
        new Command<{registryParams: EventV}>(`
        #### Deploy
        * "Registry Deploy ...registryParams" - Generates a new Registry
          * E.g. "Registry Deploy ..."
      `,
            "Deploy",
            [new Arg("registryParams", getEventV, {variadic: true})],
            (world, from, {registryParams}) => genToken(world, from, registryParams.val)
        ),
        new Command<{registry: Registry, newImplementation: AddressV}>(`
        #### SetPTokenImplementation

        * "Registry SetPTokenImplementation newImplementation:<Address>" - Sets the PToken implementation for the Registry
          * E.g. "Registry SetPTokenImplementation 0x.."
      `,
            "SetPTokenImplementation",
            [
                new Arg("registry", getRegistry, {implicit: true}),
                new Arg("newImplementation", getAddressV)
            ],
            (world, from, {registry, newImplementation}) => setPTokenImplementation(world, from, registry, newImplementation.val)
        ),
        new Command<{registry: Registry, pTokenImplementation: AddressV}>(`
        #### Initialize

        * "Registry Initialize pTokenImplementation:<Address>" - Init the PToken implementation for the Registry
          * E.g. "Registry Initialize 0x.."
      `,
            "Initialize",
            [
                new Arg("registry", getRegistry, {implicit: true}),
                new Arg("pTokenImplementation", getAddressV)
            ],
            (world, from, {registry, pTokenImplementation}) => initialize(world, from, registry, pTokenImplementation.val)
        ),
        new Command<{registry: Registry, newUnderlying: AddressV, newPToken: AddressV}>(`
        #### AddPToken

        * "Registry AddPToken newUnderlying:<Address> newPToken:<Address>" - Sets the PToken address for the Registry
          * E.g. "Registry AddPToken 0x.. 0x.."
      `,
            "AddPToken",
            [
                new Arg("registry", getRegistry, {implicit: true}),
                new Arg("newUnderlying", getAddressV),
                new Arg("newPToken", getAddressV)
            ],
            (world, from, {registry, newUnderlying, newPToken}) => setAddPToken(world, from, registry, newUnderlying.val, newPToken.val)
        ),
        new Command<{registry: Registry, newPPIE: AddressV}>(`
        #### AddPPIE

        * "Registry AddPPIE newPPIE:<Address>" - Sets the PPIE address for the Registry
          * E.g. "Registry AddPPIE 0x.."
      `,
            "AddPPIE",
            [
                new Arg("registry", getRegistry, {implicit: true}),
                new Arg("newPPIE", getAddressV)
            ],
            (world, from, {registry, newPPIE}) => setAddPPIE(world, from, registry, newPPIE.val)
        ),
        new Command<{registry: Registry, newPETH: AddressV}>(`
        #### AddPETH

        * "Registry AddPETH newPETH:<Address>" - Sets the PETH address for the Registry
          * E.g. "Registry AddPETH 0x.."
      `,
            "AddPETH",
            [
                new Arg("registry", getRegistry, {implicit: true}),
                new Arg("newPETH", getAddressV)
            ],
            (world, from, {registry, newPETH}) => setAddPETH(world, from, registry, newPETH.val)
        ),
        new Command<{registry: Registry, pToken: AddressV}>(`
        #### RemovePToken

        * "Registry RemovePToken pToken:<Address>" - Remove the pToken from the Registry
          * E.g. "Registry RemovePToken 0x.."
      `,
            "RemovePToken",
            [
                new Arg("registry", getRegistry, {implicit: true}),
                new Arg("pToken", getAddressV)
            ],
            (world, from, {registry, pToken}) => removePTokenFromRegistry(world, from, registry, pToken.val)
        )
    ];
}

export async function processRegistryEvent(world: World, event: Event, from: string | null): Promise<World> {
    return await processCommandEvent<any>("Registry", registryCommands(), world, event, from);
}