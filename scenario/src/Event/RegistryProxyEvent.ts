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
import {getRegistryProxy} from "../ContractLookup";

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
    let invokation = await invoke(world, registryProxy.methods._setPTokenImplementation(newImplementation), from, RegistryErrorReporter);

    world = addAction(
        world,
        `Called set PToken Implementation ${newImplementation} as ${describeUser(world, from)}`,
        invokation
    );

    return world;
}

async function setImplementation(world: World, from: string, registryProxy: RegistryProxy, newImplementation: string): Promise<World> {
    let invokation = await invoke(world, registryProxy.methods._setImplementation(newImplementation), from, RegistryErrorReporter);

    world = addAction(
        world,
        `Called set PToken Implementation ${newImplementation} as ${describeUser(world, from)}`,
        invokation
    );

    return world;
}

async function setAddPToken(world: World, from: string, registryProxy: RegistryProxy, newUnderlying: string, newPToken: string): Promise<World> {
    let invokation = await invoke(world, registryProxy.methods.addPToken(newUnderlying, newPToken), from, RegistryErrorReporter);

    world = addAction(
        world,
        `Called add newPToken address ${newPToken} as ${describeUser(world, from)}`,
        invokation
    );

    return world;
}

async function setAddPPIE(world: World, from: string, registryProxy: RegistryProxy, newPPIE: string): Promise<World> {
    let invokation = await invoke(world, registryProxy.methods.addPPIE(newPPIE), from, RegistryErrorReporter);

    world = addAction(
        world,
        `Called add PPIE address ${newPPIE} as ${describeUser(world, from)}`,
        invokation
    );

    return world;
}

async function setAddPETH(world: World, from: string, registryProxy: RegistryProxy, newPETH: string): Promise<World> {
    let invokation = await invoke(world, registryProxy.methods.addPETH(newPETH), from, RegistryErrorReporter);

    world = addAction(
        world,
        `Called add PETH address ${newPETH} as ${describeUser(world, from)}`,
        invokation
    );

    return world;
}

async function setPriceOracle(world: World, from: string, registryProxy: RegistryProxy, priceOracleAddr: string): Promise<World> {
    let invokation = await invoke(world, registryProxy.methods._setOracle(priceOracleAddr), from, RegistryErrorReporter);

    world = addAction(
        world,
        `Set price oracle for to ${priceOracleAddr} as ${describeUser(world, from)}`,
        invokation
    );

    return world;
}

async function removePTokenFromRegistry(world: World, from: string, registryProxy: RegistryProxy, pToken: string): Promise<World> {
    let invokation = await invoke(world, registryProxy.methods._removePToken(pToken), from, RegistryErrorReporter);

    world = addAction(
        world,
        `Called remove PToken ${pToken} as ${describeUser(world, from)}`,
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
        ),
        new Command<{registryProxy: RegistryProxy, newPETH: AddressV}>(`
        #### AddPETH

        * "RegistryProxy AddPETH newPETH:<Address>" - Sets the PETH address for the Registry
          * E.g. "RegistryProxy AddPETH 0x.."
      `,
            "AddPETH",
            [
                new Arg("registryProxy", getRegistryProxy, {implicit: true}),
                new Arg("newPETH", getAddressV)
            ],
            (world, from, {registryProxy, newPETH}) => setAddPETH(world, from, registryProxy, newPETH.val)
        ),
        new Command<{registryProxy: RegistryProxy, pToken: AddressV}>(`
        #### RemovePToken

        * "RegistryProxy RemovePToken pToken:<Address>" - Remove the pToken from the Registry
          * E.g. "RegistryProxy RemovePToken 0x.."
      `,
            "RemovePToken",
            [
                new Arg("registryProxy", getRegistryProxy, {implicit: true}),
                new Arg("pToken", getAddressV)
            ],
            (world, from, {registryProxy, pToken}) => removePTokenFromRegistry(world, from, registryProxy, pToken.val)
        ),
        new Command<{registryProxy: RegistryProxy, newUnderlying: AddressV, newPToken: AddressV}>(`
        #### AddPToken

        * "RegistryProxy AddPToken newUnderlying:<Address> newPToken:<Address>" - Sets the PToken address for the Registry
          * E.g. "RegistryProxy AddPToken 0x.. 0x.."
      `,
            "AddPToken",
            [
                new Arg("registryProxy", getRegistryProxy, {implicit: true}),
                new Arg("newUnderlying", getAddressV),
                new Arg("newPToken", getAddressV)
            ],
            (world, from, {registryProxy, newUnderlying, newPToken}) => setAddPToken(world, from, registryProxy, newUnderlying.val, newPToken.val)
        ),
        new Command<{registryProxy: RegistryProxy, priceOracle: AddressV}>(`
        #### SetPriceOracle

        * "Registry SetPriceOracle oracle:<Address>" - Sets the price oracle address
          * E.g. "RegistryProxy SetPriceOracle 0x..."
      `,
            "SetPriceOracle",
            [
                new Arg("registryProxy", getRegistryProxy, {implicit: true}),
                new Arg("priceOracle", getAddressV)
            ],
            (world, from, {registryProxy, priceOracle}) => setPriceOracle(world, from, registryProxy, priceOracle.val)
        ),
    ];
}

export async function processRegistryProxyEvent(world: World, event: Event, from: string | null): Promise<World> {
    return await processCommandEvent<any>("RegistryProxy", registryProxyCommands(), world, event, from);
}