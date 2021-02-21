// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { LitElement, css, html } from './third_party/lit-element.js';
import { kMaterialIconsClass } from './styles.js';

// Represents the header displayed at the top of the interface. It has a static, centered position,
// but supports any number of data elements. By default it displays the time and the temperature in
// the room. When the system is in debug mode, a refresh button will be displayed as well.
//
// This element supports three attributes:
//
// @clock (string): Time to display in the header element.
// @refresh (boolean): Whether the refresh button should be visible in the interface.
// @temperature (string): Temperature, without unit, to display in the header element.
//
export class HqHeaderElement extends LitElement {
    static get properties() {
        return {
            clock: { type: String },
            refresh: { type: Boolean },
            temperature: { type: Number },
        }
    }

    static styles = [
        kMaterialIconsClass,
        css`
            :host {
                display: flex;
                position: relative;
                justify-content: center;
            }

            ol {
                display: inline-block;
                list-style-type: none;

                padding: 0px;
                margin: 0px;

                font-size: 3rem;
                line-height: 5rem;
                height: 5rem;
            }

            li span.material-icons { font-size: 2rem; }
            li {
                display: inline-block;
                text-align: center;
            }

            ol.status li span { color: #a47666; }
            ol.status li { padding: 0 1.5rem; }
            ol.status {
                border-bottom-left-radius: 1rem;
                border-bottom-right-radius: 1rem;
                background-color: #181110;
                padding: 0 1rem;
                color: #a09b98;
            }

            ol.support {
                position: absolute;
                right: 1rem;
            }

            ol.support li {
                background-color: #a09b98;
                border-radius: 50%;

                color: #181110;
                cursor: pointer;

                width: 3rem;
                height: 3rem;
                line-height: 2.8rem;
            }`
    ];

    constructor() {
        super();

        this.clock = undefined;
        this.refresh = false;
        this.temperature = undefined;
    }

    // ---------------------------------------------------------------------------------------------

    // Renders the contents of the header element. The top menu will be displayed centered on the
    // screen. A barely contrasting (I) icon will be displayed in the top-right corner, which will
    // open a dialog window with diagnostic information about the device.
    render() {
        return html`
            <ol class="status">
                ${this.clock ? this.renderClock() : ''}
                ${this.temperature ? this.renderTemperature() : ''}
            </ol>
            <ol class="support">
                ${this.refresh ? this.renderRefresh() : ''}
            </ol>`;
    }

    // Displays the clock element. It updates when the attribute value changes. The element cannot
    // be clicked on, nor has other activation rules.
    renderClock() {
        return html`
            <li class="clock">
                <span class="material-icons">access_time</span>
                ${this.clock}
            </li>`;
    }

    // Displays the refresh element. Does not have a label, only an icon. Tapping on the element
    // will refresh the page on the home control display.
    renderRefresh() {
        return html`
            <li class="refresh" @click=${() => document.location.reload()}>
                <span class="material-icons">refresh</span>
            </li>`;
    }

    // Displays the temperature element. It updates when the attribute value changes, and suffices
    // the attribute with the unit for celcius, the only notation we'll have in our house.
    renderTemperature() {
        return html`
            <li class="temperature">
                <span class="material-icons">device_thermostat</span>
                ${this.temperature} °C
            </li>`;
    }
}

customElements.define('hq-header', HqHeaderElement);
