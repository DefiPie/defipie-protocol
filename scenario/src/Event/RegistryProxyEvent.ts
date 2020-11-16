import {Event} from '../Event';
import {addAction, describeUser, World} from '../World';
import { RegistryErrorReporter} from '../ErrorReporter';
import { RegistryProxy } from '../Contract/RegistryProxy';

import {invoke} from '../Invokation';
import {buildRegistryProxy} from '../Builder/RegistryProxyBuilder';
import {
    getAddressV,
    getEventV,
} from '../CoreValue';
import {
    AddressV,
    EventV,
} from '../Value';
import {Arg, Command, processCommandEvent} from '../Command';
import {getRegistry, getRegistryProxy} from "../ContractLookup";
import {Registry} from "../Contract/Registry";

async function genToken(world: World, from: string, params: Event): Promise<World> {
    let {world: newWorld, registryProxy, registryProxyData} = await buildRegistryProxy(world, from, params);
    world = newWorld;

    world = addAction(
        world,
        `Added RegistryProxy (${registryProxyData.description}) at address ${registryProxy._address}`,
        registryProxyData.invokation
    );

    return world;
}

async function setPendingAdmin(world: World, from: string, registryProxy: RegistryProxy, newPendingAdmin: string): Promise<World> {
    let invokation = await invoke(world, registryProxy.methods._setPendingAdmin(newPendingAdmin), from, RegistryErrorReporter);

    world = addAction(
        world,
        `RegistryProxy: ${describeUser(world, from)} sets pending admin to ${newPendingAdmin}`,
        invokation
    );

    return world;
}

async function acceptAdmin(world: World, from: string, registryProxy: RegistryProxy): Promise<World> {
    let invokation = await invoke(world, registryProxy.methods._acceptAdmin(), from, RegistryErrorReporter);

    world = addAction(
        world,
        `RegistryProxy: ${describeUser(world, from)} accepts admin`,
        invokation
    );

    return world;
}

async function setPTokenImplementation(world: World, from: string, registryProxy: RegistryProxy, newImplementation: string): Promise<World> {
    let invokation = await invoke(world, registryProxy.methods.setPTokenImplementation(newImplementation), from, RegistryErrorReporter);

    world = addAction(
        world,
        `Called set PToken Implementation ${newImplementation} as ${describeUser(world, from)}`,
        invokation
    );

    return world;
}

async function setImplementation(world: World, from: string, registryProxy: RegistryProxy, newImplementation: string): Promise<World> {
    let invokation = await invoke(world, registryProxy.methods.setImplementation(newImplementation), from, RegistryErrorReporter);

    world = addAction(
        world,
        `Called set PToken Implementation ${newImplementation} as ${describeUser(world, from)}`,
        invokation
    );

    return world;
}

async function setAddPPIE(world: World, from: string, registryProxy: RegistryProxy, newPPIE: string): Promise<World> {
    let invokation = await invoke(world, registryProxy.methods.addPPIE(newPPIE), from, RegistryErrorReporter);

    world = addAction(
        world,
        `Called set PToken Implementation ${newPPIE} as ${describeUser(world, from)}`,
        invokation
    );

    return world;
}


export function registryProxyCommands() {
    return [
        new Command<{registryProxyParams: EventV}>(`
        #### Deploy
        * "RegistryProxy Deploy ...registryProxyParams" - Generates a new RegistryProxy
          * E.g. "RegistryProxy Deploy ..."
      `,
            "Deploy",
            [new Arg("registryProxyParams", getEventV, {variadic: true})],
            (world, from, {registryProxyParams}) => genToken(world, from, registryProxyParams.val)
        ),
        new Command<{registryProxy: RegistryProxy, newImplementation: AddressV}>(`
        #### SetImplementation

        * "RegistryProxy SetImplementation newImplementation:<Address>" - Sets the implementation for the RegistryProxy
          * E.g. "RegistryProxy SetImplementation 0x.."
      `,
            "SetImplementation",
            [
                new Arg("registryProxy", getRegistryProxy, {implicit: true}),
                new Arg("newImplementation", getAddressV)
            ],
            (world, from, {registryProxy, newImplementation}) => setImplementation(world, from, registryProxy, newImplementation.val)
        ),
        new Command<{registryProxy: RegistryProxy, newPendingAdmin: AddressV}>(`
        #### SetPendingAdmin

        * "RegistryProxy SetPendingAdmin newPendingAdmin:<Address>" - Sets the pending admin for the RegistryProxy
          * E.g. "RegistryProxy SetPendingAdmin Geoff"
      `,
            "SetPendingAdmin",
            [
                new Arg("registryProxy", getRegistryProxy, {implicit: true}),
                new Arg("newPendingAdmin", getAddressV)
            ],
            (world, from, {registryProxy, newPendingAdmin}) => setPendingAdmin(world, from, registryProxy, newPendingAdmin.val)
        ),
        new Command<{registryProxy: RegistryProxy}>(`
        #### AcceptAdmin

        * "RegistryProxy AcceptAdmin" - Accepts admin for the RegistryProxy
          * E.g. "From Geoff (RegistryProxy AcceptAdmin)"
      `,
            "AcceptAdmin",
            [
                new Arg("registryProxy", getRegistryProxy, {implicit: true}),
            ],
            (world, from, {registryProxy}) => acceptAdmin(world, from, registryProxy)
        ),
        new Command<{registryProxy: RegistryProxy, newImplementation: AddressV}>(`
        #### SetPTokenImplementation

        * "RegistryProxy SetPTokenImplementation newImplementation:<Address>" - Sets the PToken implementation for the RegistryProxy
          * E.g. "RegistryProxy SetPTokenImplementation 0x.."
      `,
            "SetPTokenImplementation",
            [
                new Arg("registryProxy", getRegistryProxy, {implicit: true}),
                new Arg("newImplementation", getAddressV)
            ],
            (world, from, {registryProxy, newImplementation}) => setPTokenImplementation(world, from, registryProxy, newImplementation.val)
        ),
        new Command<{registryProxy: RegistryProxy, newPPIE: AddressV}>(`
        #### AddPPIE

        * "RegistryProxy AddPPIE newPPIE:<Address>" - Sets the PPIE address for the Registry
          * E.g. "RegistryProxy AddPPIE 0x.."
      `,
            "AddPPIE",
            [
                new Arg("registryProxy", getRegistryProxy, {implicit: true}),
                new Arg("newPPIE", getAddressV)
            ],
            (world, from, {registryProxy, newPPIE}) => setAddPPIE(world, from, registryProxy, newPPIE.val)
        )
    ];
}

export async function processRegistryProxyEvent(world: World, event: Event, from: string | null): Promise<World> {
    return await processCommandEvent<any>("RegistryProxy", registryProxyCommands(), world, event, from);
}