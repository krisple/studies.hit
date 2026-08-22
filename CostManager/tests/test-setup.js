import { readFileSync } from 'node:fs';
import { jest } from '@jest/globals';

const configUrl = new URL('../config.json', import.meta.url);
const applicationConfig = JSON.parse(readFileSync(configUrl, 'utf8'));

// Unit tests load the same editable runtime config without making a real network request.
global.fetch = jest.fn(async (requestedUrl) => {
    if (String(requestedUrl) !== configUrl.href) {
        throw new Error(`Unexpected setup Fetch URL: ${String(requestedUrl)}`);
    }

    // The mock returns only the response fields consumed by the runtime config loader.
    return {
        ok: true,
        json: async () => applicationConfig
    };
});
