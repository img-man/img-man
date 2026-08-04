// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { ENDPOINT_GROUPS } from '@/lib/api-playground-data';

describe('api playground contract data', () => {
  it('keeps the assets live query params aligned with the v1 assets route', () => {
    const assetsGroup = ENDPOINT_GROUPS.find((group) => group.name === 'Assets');
    const listAssets = assetsGroup?.endpoints.find((endpoint) => endpoint.id === 'list-assets');

    expect(listAssets).toBeDefined();

    const queryParamNames = listAssets?.params
      .filter((param) => param.in === 'query')
      .map((param) => param.name);

    expect(queryParamNames).toEqual([
      'page',
      'limit',
      'folderId',
      'q',
      'mimeType',
      'sort',
      'sortDir',
    ]);
  });

  it('advertises the authenticated asset transform helper endpoint', () => {
    const assetsGroup = ENDPOINT_GROUPS.find((group) => group.name === 'Assets');
    const transformEndpoint = assetsGroup?.endpoints.find(
      (endpoint) => endpoint.id === 'asset-transform-url',
    );

    expect(transformEndpoint).toMatchObject({
      method: 'GET',
      path: '/api/v1/assets/:id/transform',
      permission: 'transform',
    });

    const transformsParam = transformEndpoint?.params.find(
      (param) => param.name === 'transforms',
    );
    expect(transformsParam?.example).toBe('w-400,h-400,q-80,f-webp');
  });
});