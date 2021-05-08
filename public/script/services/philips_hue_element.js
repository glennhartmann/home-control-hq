// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { LitElement, css, html } from '../third_party/lit.js';

// Represents the service element which allows full control over Philips Hue lights. These will be
// displayed as regular service bubbles, with a number of specific interactions available:
//
// * press              Switches on or off all lights in the room.
// * long press         Displays an overlay with available scenes in the room.
// * vertical drag      Changes the brightness of the lights in the room.
//
// The light's state is represented through a series of element attributes, which will be kept in
// sync by the PhilipsHueBindings instance associated with this element. The following attributes
// are available:
//
// * label (string)     Label that should be given to the lights, if any.
// * on (boolean)       Whether the lights are currently turned on or not.
//
// Changes to the light state, imposed through the user interface, will be communicated back to the
// bindings through issued events. None of this is intended to be stable.
export class PhilipsHueElement extends LitElement {
    static get properties() {
        return {
            label: { type: String },
            on: { type: Boolean },
        }
    }

    constructor() {
        super();

        this.label = undefined;
        this.on = false;

        // Listen to pointer events for the entire containing service element, as interaction should
        // not be limited to (sub)elements thereof, which would be rather annoying.
        this.addEventListener('pointerup', PhilipsHueElement.prototype.onClick.bind(this));
    }

    createRenderRoot() { return this; }

    // ---------------------------------------------------------------------------------------------

    // Called when the user clicks on the root Philips Hue element.
    onClick() {
        this.dispatchEvent(new CustomEvent('toggle', {
            detail: !this.on,
        }));
    }

    // ---------------------------------------------------------------------------------------------

    // Actually renders the <philips-hue-element> HTML. The exact composition of the DOM will depend
    // on the state of the lights that are being controlled by this element.
    render() {
        return html`
            <article>
                ${this.label}
            </article>`;
    }
}

customElements.define('philips-hue-element', PhilipsHueElement);
