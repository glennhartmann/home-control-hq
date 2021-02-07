// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { v3 as hue, v3 } from 'node-hue-api';

import { Connection } from './connection';

// Interface that defines the options for a light update
export interface LightUpdate {
    // Whether the lights should be on or off. Required.
    on: boolean;

    // Brightness of lights in the group. Number in range of [0, 254).
    brightness?: number;

    // Name of the scene to apply, if any. Defaults to the current scene/configuration.
    scene?: string;
}

// Represents a group of lights provided by the Philips Hue bridge.
export class LightGroup {
    public readonly id: number;
    public readonly name: string;

    private scenes: Map<string, string>;

    constructor(id: number, name: string) {
        this.id = id;
        this.name = name;

        this.scenes = new Map();
    }

    // Returns the scenes available to this light group.
    getScenes() { return [ ...this.scenes.keys() ]; }

    // ---------------------------------------------------------------------------------------------

    // Updates the lights in this group following the given |update|. This method allows the lights
    // to be turned on or off, scenes to be applied, and brightness to be changed.
    async update(connection: Connection, update: LightUpdate) {
        const state = new v3.lightStates.GroupLightState().on(update.on);
        if (update.on) {
            if (typeof update.brightness === 'number') {
                if (update.brightness < 0 || update.brightness > 254)
                    throw new Error(`Brightness for lights must be in range of [0, 254).`)

                state.bri(update.brightness);
            }

            if (update.scene !== undefined) {
                if (!this.scenes.has(update.scene))
                    throw new Error(`Unknown scene specified: ${update.scene}`);

                state.scene(this.scenes.get(update.scene));
            }
        }

        await connection.api.groups.setGroupState(this.id, state);
    }

    // ---------------------------------------------------------------------------------------------
    // Update propagation initiated by the Philips Hue Manager
    // ---------------------------------------------------------------------------------------------

    // Called when the light group has been removed by the Philips Hue bridge.
    processDelete() {}

    // Called when the light group might have been updated. The |action| contains the Light-like
    // state of the group, whereas the |state| indicates whether some or all lights are on.
    processUpdate(action: object, scenes: Map<string, string>, state: object) {
        this.scenes = scenes;
    }
}
