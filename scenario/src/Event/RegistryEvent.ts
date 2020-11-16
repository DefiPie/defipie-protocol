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

async function setAddPPIE(world: World, from: string, registry: Registry, newPPIE: string): Promise<World> {
    let invokation = await invoke(world, registry.methods.addPPIE(newPPIE), from, RegistryErrorReporter);

    world = addAction(
        world,
        `Called set PToken Implementation ${newPPIE} as ${describeUser(world, from)}`,
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
        )
    ];
}

export async function processRegistryEvent(world: World, event: Event, from: string | null): Promise<World> {
    return await processCommandEvent<any>("Registry", registryCommands(), world, event, from);
}