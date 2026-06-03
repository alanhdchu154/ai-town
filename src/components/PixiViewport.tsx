// Based on https://codepen.io/inlet/pen/yLVmPWv.
// Copyright (c) 2018 Patrick Brouwer, distributed under the MIT license.

import { PixiComponent, useApp } from '@pixi/react';
import { Viewport } from 'pixi-viewport';
import { Application } from 'pixi.js';
import { MutableRefObject, ReactNode } from 'react';

export type ClampBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type ViewportProps = {
  app: Application;
  viewportRef?: MutableRefObject<Viewport | undefined>;

  screenWidth: number;
  screenHeight: number;
  worldWidth: number;
  worldHeight: number;
  clampBounds?: ClampBounds;
  children?: ReactNode;
};

const NON_VIEWPORT_PROPS = new Set(['app', 'viewportRef', 'children', 'clampBounds']);

function applyClamp(viewport: Viewport, props: ViewportProps) {
  const { clampBounds, screenWidth, screenHeight, worldWidth, worldHeight } = props;
  if (clampBounds && screenWidth > 0 && screenHeight > 0) {
    const boundsWidth = clampBounds.right - clampBounds.left;
    const boundsHeight = clampBounds.bottom - clampBounds.top;
    // Default to an overview fit so Alan can see where people are without
    // dragging around the room. The Pixi room now draws its own expanded
    // backdrop, so fitting the bounds no longer exposes a harsh black plate.
    const minScale =
      Math.max(screenWidth / boundsWidth, screenHeight / boundsHeight) * 1.01;
    const maxScale = Math.max(3.5, minScale * 2.2);
    viewport
      .clamp({
        direction: 'all',
        underflow: 'center',
        left: clampBounds.left,
        right: clampBounds.right,
        top: clampBounds.top,
        bottom: clampBounds.bottom,
      })
      .clampZoom({ minScale, maxScale });
  } else {
    viewport
      .clamp({ direction: 'all', underflow: 'center' })
      .clampZoom({
        minScale: (1.04 * screenWidth) / (worldWidth / 2),
        maxScale: 3.0,
      });
  }
}

// https://davidfig.github.io/pixi-viewport/jsdoc/Viewport.html
export default PixiComponent('Viewport', {
  create(props: ViewportProps) {
    const { app, children, viewportRef, clampBounds, ...viewportProps } = props;
    const viewport = new Viewport({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      events: app.renderer.events,
      passiveWheel: false,
      ...viewportProps,
    } as ConstructorParameters<typeof Viewport>[0] & { events: Application['renderer']['events'] });
    if (viewportRef) {
      viewportRef.current = viewport;
    }
    viewport.drag().pinch({}).wheel().decelerate().setZoom(-10);
    applyClamp(viewport, props);
    return viewport;
  },
  applyProps(viewport, oldProps: any, newProps: any) {
    let clampNeedsUpdate = false;
    Object.keys(newProps).forEach((p) => {
      if (NON_VIEWPORT_PROPS.has(p)) {
        if (p === 'clampBounds' && oldProps[p] !== newProps[p]) {
          clampNeedsUpdate = true;
        }
        return;
      }
      if (oldProps[p] !== newProps[p]) {
        // @ts-expect-error Ignoring TypeScript here
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        viewport[p] = newProps[p];
        if (p === 'screenWidth' || p === 'screenHeight' || p === 'worldWidth' || p === 'worldHeight') {
          clampNeedsUpdate = true;
        }
      }
    });
    if (clampNeedsUpdate) {
      // Remove existing clamp/clampZoom and re-apply with new bounds.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      viewport.plugins.remove('clamp');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      viewport.plugins.remove('clamp-zoom');
      applyClamp(viewport, newProps);
    }
  },
});
