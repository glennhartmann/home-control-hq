// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { css } from './third_party/lit-element.js';

// Style rules for using Material icons in the user interface.
export const kMaterialIconsClass = css`
    .material-icons {
        -webkit-font-smoothing: antialiased;

        font-family: 'Material Icons';
        font-weight: normal;
        font-style: normal;
        font-size: 24px;  /* Preferred icon size */
        display: inline-block;
        line-height: 1;
        text-rendering: optimizeLegibility;
        text-transform: none;
        letter-spacing: normal;
        word-wrap: normal;
        white-space: nowrap;
        direction: ltr;
    }`;
