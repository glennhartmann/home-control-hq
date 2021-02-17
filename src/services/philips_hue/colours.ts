// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// @ts-ignore
import { calculateXY } from '@q42philips/hue-color-converter';

// Representation of a Philips Hue light colour, as [r, g, b] (each in range of 0-255).
export type Colour = [ number, number, number ];

// Converts the given |state|, retrieved from the Philips Hue bridge, to a Colour representation.
export function getLightColour(state: any): Colour {
    const [ x, y ] = state.xy;

    const Y = state.bri / 255.0;
    const X = (Y / y) * x;
    const Z = (Y / y) * (1.0 - x - y);

    let r = X * 1.612 - Y * 0.203 - Z * 0.302;
    let g = -X * 0.509 + Y * 1.412 + Z * 0.066;
    let b = X * 0.026 - Y * 0.072 + Z * 0.962;

    r = r <= 0.0031308 ? 12.92 * r : (1.0 + 0.055) * Math.pow(r, (1.0 / 2.4)) - 0.055;
    g = g <= 0.0031308 ? 12.92 * g : (1.0 + 0.055) * Math.pow(g, (1.0 / 2.4)) - 0.055;
    b = b <= 0.0031308 ? 12.92 * b : (1.0 + 0.055) * Math.pow(b, (1.0 / 2.4)) - 0.055;

    const maxValue = Math.max(r, g, b);

    r = Math.floor((r / maxValue) * 255);  if (r < 0) r = 255;
    g = Math.floor((g / maxValue) * 255);  if (g < 0) g = 255;
    b = Math.floor((b / maxValue) * 255);  if (b < 0) b = 255;

    return [ r, g, b ];
}

// Converts the given |colour| from [r, g, b] (each in range of 0-255), for a light with the given
// |model| (indicating its gamut range), to [x, y] on the Philips Hue colour wheel.
export function getLightXY(colour: Colour, model: string): [number, number] {
    return calculateXY(colour[0], colour[1], colour[2], model);
}
