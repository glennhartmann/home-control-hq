// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import './philips_hue_element.js';

// Binds together input from the service connection with the custom element, ensuring that a bi-
// directional relationship can be created to represent live light state.
export class PhilipsHueBindings {
    #label;
    #options;

    // Whether an interaction is happening right now. Other events will be suspended.
    #active;

    // The ControlConnection through which communication commands can be send.
    #connection;

    // The PhilipsHueElement HTML element controlled by these bindings.
    #element;

    constructor(connection, label, options) {
        this.#label = label;
        this.#options = options;

        this.#active = false;
        this.#connection = connection;
        this.#element = this.createElement();
    }

    // ---------------------------------------------------------------------------------------------

    // Toggles the light on or off, depending on the |on| value. The new state will be reflected in
    // the visualization of the lights through the PhilipsHueElement[on] attribute.
    async toggle(on) {
        if (!this.#connection.available || this.#active)
            return;  // the service connection is not available right now, or the element is active

        this.#active = true;

        await this.#connection.send({
            command: 'philips-hue-power',
            group: this.#options.group,
            on,
        });

        this.#active = false;

        on ? this.#element.setAttribute('on', '')
           : this.#element.removeAttribute('on');
    }

    // ---------------------------------------------------------------------------------------------

    // Creates and initializes the custom element through which Philips Hue interaction will be
    // visualized. Can be called any number of times, although once should be sufficient.
    createElement() {
        const element = document.createElement('philips-hue-element');

        // (1) Reflect the initial state of the element through attributes.
        element.setAttribute('label', this.#label);
        // TODO: element[on]

        // (2) Attach event listeners to enable interaction with the element.
        element.addEventListener('toggle', event => this.toggle(!!event.detail));

        return element;
    }

    // Returns the PhilipsHueElement instance owned by these bindings.
    get element() { return this.#element; }
}
