// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { default as equal } from 'deep-equal';
import { v3 as hue } from 'node-hue-api';

import { Colour, getLightColour, getLightXY } from './colours';
import { Connection } from './connection';
import { Database } from '../../base/database';
import { Logger } from '../../base/logger';

// Describes the full state that we maintain about the Philips Hue bridge. All user interfaces will
// display information based on this, so the expectation is to keep it up-to-date.
interface Bridge {
    groups: Map<GroupID, Group>;
    lights: Map<LightID, Light>;
    scenes: Map<SceneID, Scene>;
}

// Type of the data through which individual groups are represented.
type GroupID = number;

// Describes a group known to the Philips Hue bridge. We consider Groups, Rooms and Zones to be the
// same thing, each of which will be referred to as a "group" in our system.
interface Group {
    // Numeric identifier for the group, through which it is referenced.
    id: GroupID;

    // Name of the group, to be represented in the user interface.
    name: string;

    // The lights that are part of the group.
    lights: Array<LightID>;
}

// Type of the data through which individual lights are represented.
type LightID = number;

// Describes an individual light. They are either turned off or on. When turned on, they have a
// colour (herein represented as RGB) and associated brightness (herein represented as percentage).
interface Light {
    // Numeric identifier for the light, through which it is referenced.
    id: LightID;

    // Model of the light, which indicates the supported gamut range.
    model: string;

    // Whether the light is currently powered on.
    on: boolean;

    // Brightness of the light when it has been powered on, as a percentage (0-100).
    brightness?: number;

    // Colour of the light when it has been powered on, as [R, G, B] in range of 0-255.
    colour?: Colour;
}

// Type of the data through which individual scenes are represented.
type SceneID = string;

// Describes a scene known to the Philips Hue bridge. Scenes are identified by their ID in the API,
// but should be represented by their name in user interfaces. The actual colours for the scene are
// stored *in* the lights, so not known to the API, but we cache that information after the scene
// has been activated so that we can reflect that as well.
interface Scene {
    // Textual identifier for the scene, through which it can be activated.
    id: SceneID;

    // ID of the group that the scene is part of.
    group: number;

    // Name of the scene, represented in the user interface.
    name: string;

    // The lights that are part of the scene.
    lights: Array<LightID>;
}

// Representation of a scene as it will be shared with clients.
interface StateScene {
    // Name of the scene, as it should be shown in the user interface.
    name: string;

    // Colour of the scene, as [R, G, B] in range of 0-255. May be lazily computed.
    colour: Colour;
}

// Representation of current state for a particular group that is to be communicated with the front-
// end of the home control system. Abstracts over individual groups, lights and scenes.
interface State {
    // Whether the group is currently powered on.
    on: boolean;

    // Brightness of lights in the group when powered on, as a percentage (0-100).
    brightness: number;

    // Colour of the lights in the group when powered on, as [R, G, B] in range of 0-255.
    colour: Colour;

    // Array of scenes that are available for the group.
    scenes: Array<StateScene>;
}

// The configuration that can be passed when requesting a light update. Each individual property is
// optional, but at least one of the properties must be given.
interface Update {
    // Whether the lights should be on or off. Scene and brightness updates can be pushed without
    // changing the power state, which won't affect other lights.
    on?: boolean;

    // Brightness of lights in the group. Number in range of 0-100.
    brightness?: number;

    // Colour of the lights in the group. Specified in as [R, G, B] in range of 0-255.
    colour?: Colour;

    // Name of the scene to apply, if any. Defaults to the current scene/configuration.
    scene?: string;
}

// Default value for the bridge configuration, which is not nullable but can be empty.
const kDefaultBridge: Bridge = { groups: new Map(), lights: new Map(), scenes: new Map() };

// Represents the interface through which we'll communicate with the bridge, using an established
// Connection. Maintains state of all lights in the system, and is able to issue updates in the
// situation where state for a group has changed.
export class Interface {
    private connection: Connection;
    private database: Database;
    private logger: Logger;

    private bridge: Bridge = kDefaultBridge;

    constructor(connection: Connection, database: Database, logger: Logger) {
        this.connection = connection;
        this.database = database;
        this.logger = logger;
    }

    // ---------------------------------------------------------------------------------------------
    // Section: State getters
    // ---------------------------------------------------------------------------------------------

    // Composes the state representation for the given |group|. This is a non-trivial operation that
    // requires iterating once over all groups, lights and scenes to find the required information.
    composeState(group: string, bridge?: Bridge): State {
        bridge ??= this.bridge;  // default to cached data

        const id = this.findGroupIdOrThrow(group, bridge);
        const lights = bridge.groups.get(id)!.lights;

        let on: boolean = false;
        let brightnesses: Array<number> = [];
        let colours: Array<Colour> = [];
        let scenes: Array<StateScene> = [];

        // (1) Iterate over all lights and consider the ones part of this group.
        for (const lightId of lights) {
            if (!bridge.lights.has(lightId))
                continue;  // invalid light ID given by the Philips Hue bridge...

            const light = bridge.lights.get(lightId)!;

            on = on || light.on;

            if (light.on) {
                brightnesses.push(light.brightness!);
                colours.push(light.colour!);
            }
        }

        if (!brightnesses.length) brightnesses.push(0);
        if (!colours.length) colours.push([ 0, 0, 0 ]);

        // (2) Compose the average brightness and colours for all powered lights in the group.
        const brightness =
            Math.floor(brightnesses.reduce((acc, value) => acc + value, 0) / brightnesses.length);

        const colour: Colour = [
            Math.floor(colours.reduce((acc, value) => acc + value[0], 0) / colours.length),
            Math.floor(colours.reduce((acc, value) => acc + value[1], 0) / colours.length),
            Math.floor(colours.reduce((acc, value) => acc + value[2], 0) / colours.length),
        ];

        // (3) Compose the scenes that are part of this group, in state formatting.
        for (const scene of bridge.scenes.values()) {
            if (scene.group !== id)
                continue;  // scene is owned by another group

            scenes.push({
                name: scene.name,

                // TODO: Calculate & cache the colour associated with a scene.
                colour: [ 0, 0, 0 ],
            })
        }

        return { on, brightness, colour, scenes };
    }

    // Returns the ID associated with the given |group|, or throws an exception. O(n) complexity.
    findGroupIdOrThrow(group: string, bridge?: Bridge): number {
        bridge ??= this.bridge;  // default to cached data

        for (const [ id, info ] of bridge.groups) {
            if (info.name !== group)
                continue;  // different light group

            return id;
        }

        throw new Error(`The light group is not known to the Philips Hue bridge ("${group}").`);
    }

    // ---------------------------------------------------------------------------------------------
    // Section: Modifiers for either refreshing or mutating state
    // ---------------------------------------------------------------------------------------------

    // Updates the full state with the Philips Hue bridge. Will return a map from group names to
    // State objects for the groups whose state has been modified since the last call.
    async synchronize(): Promise<Map<string, State>> {
        if (!this.connection.connected)
            throw new Error('Unable to update Philips Hue state without an active connection.');

        const bridge = await this.updateBridge();
        const updates = new Map<string, State>();

        // Only consider the existing groups, since new groups cannot yet have subscribers. We need
        // to consider the possibility for (unused) groups having been removed as well.
        for (const [ groupId, group ] of this.bridge.groups) {
            if (!bridge.groups.has(groupId))
                continue;  // the group has been removed, ignore it

            const existingState = this.composeState(group.name);
            const updatedState = this.composeState(group.name, bridge);

            if (equal(existingState, updatedState))
                continue;  // the group has not seen any updates

            this.logger.info(`Philips Hue state has changed for the "${group.name}" group.`);

            updates.set(group.name, updatedState);
        }

        // Activate the updated |bridge| status as the most recent cache.
        this.bridge = bridge;

        return updates;
    }

    // Pushes a light update to the Philips Hue bridge for the given |group|. The |update| can be
    // composed as desired through the API functions, although usually only one property is updated.
    async update(group: string, update: Update): Promise<void> {
        const state = new hue.lightStates.GroupLightState();
        const id = this.findGroupIdOrThrow(group);

        if (update.hasOwnProperty('on'))
            state.on(!!update.on);

        if (update.hasOwnProperty('brightness')) {
            if (update.brightness! < 0 || update.brightness! > 100)
                throw new Error(`The brightness must be given as a percentage, between 0 and 100.`);

            state.bri(Math.floor((update.brightness! / 100) * 254));
        }

        if (update.hasOwnProperty('colour'))
            state.xy(...getLightXY(update.colour!, /* gamut c= */ 'LCT010'));

        let sceneId = null;
        if (update.hasOwnProperty('scene')) {
            for (const scene of this.bridge.scenes.values()) {
                if (scene.group !== id)
                    continue;  // scene belongs to a different group

                if (scene.name !== update.scene)
                    continue;  // scene has a different name

                sceneId = scene.id;
                break;
            }

            if (!sceneId)
                throw new Error(`The light scene is not known to Philips Hue ("${update.scene}").`);

            state.scene(sceneId);
        }

        await this.connection.api.groups.setGroupState(id, state);

        // TODO: Can we update the internal state to match this, blocking the subsequent sync?
        // TODO: If a scene is used, we might want to update the scene's cached colour.
    }

    // ---------------------------------------------------------------------------------------------
    // Section: Interacting with the Philips Hue bridge to update the state
    // ---------------------------------------------------------------------------------------------

    // Updates the full state of the Philips Hue bridge by issuing multiple API calls. Returns an
    // object aligning with the Bridge interface when successful, throws when there is an issue.
    private async updateBridge(): Promise<Bridge> {
        const [ groups, lights, scenes ] = await Promise.all([
            this.updateBridgeGroups(),
            this.updateBridgeLights(),
            this.updateBridgeScenes(),
        ]);

        return { groups, lights, scenes };
    }

    // Updates the defined groups from the Philips Hue bridge through an API call.
    private async updateBridgeGroups(): Promise<Map<GroupID, Group>> {
        const groups = new Map<GroupID, Group>();

        const response = await this.connection.api.groups.getAll();
        for (const group of response) {
            if (!['LightGroup', 'Room', 'Zone'].includes(group.type))
                continue;

            if (!group.id && group.name === 'Group 0')
                continue;  // ignore the default "group 0" entry

            groups.set(group.id as number, {
                id: group.id as number,
                name: group.name,
                lights: group.lights.map((lightId: string) => parseInt(`${lightId}`, 10)),
            });
        }

        return groups;
    }

    // Updates the light state from the Philips Hue bridge through an API call.
    private async updateBridgeLights(): Promise<Map<LightID, Light>> {
        const lights = new Map<LightID, Light>();

        const response = await this.connection.api.lights.getAll();
        for (const light of response) {
            if (!light.state.reachable)
                continue;  // the light is not reachable, and thus should not be considered

            const on = !!light.state.on;

            let brightness: number | undefined = undefined;
            let colour: Colour | undefined = undefined;

            // Only populate |brightness| and |colour| when the light has actually been turned on.
            // Here we need to consider that brightness is specified in range of [0, 254], whereas
            // colours can be specified in multiple ways. We consider the XY values.
            if (on) {
                brightness = Math.floor((light.state.bri / 254) * 100);
                colour = getLightColour(light.state);
            }

            lights.set(light.id as number, {
                id: light.id as number,
                model: light.modelid as string,

                on, brightness, colour,
            });
        }

        return lights;
    }

    // Updates the defined scenes from the Philips Hue bridge through an API call.
    private async updateBridgeScenes(): Promise<Map<SceneID, Scene>> {
        const scenes = new Map<SceneID, Scene>();

        const response = await this.connection.api.scenes.getAll();
        for (const scene of response) {
            if (scene.type !== 'GroupScene')
                continue;

            scenes.set(scene.id as string, {
                id: scene.id as string,
                group: parseInt(`${(scene as any).group}`, 10),
                name: scene.name,
                lights: scene.lights.map((lightId: string) => parseInt(`${lightId}`, 10)),
            });
        }

        return scenes;
    }
}
