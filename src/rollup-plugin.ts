import * as fs from 'fs';
import { Plugin } from 'rollup';

const idls = new Map<string, string>();
const canisterIds = new Map<string, string>();

function findMuState() {
    let current = process.cwd();
    while (current !== '/') {
        const path = `${current}/mu.state.json`;
        if (fs.existsSync(path)) {
            return path;
        }
        current = current.split('/').slice(0, -1).join('/');
    }
    throw new Error('mu.state.json not found');
}

function loadState() {
    const muState = fs.readFileSync(findMuState(), 'utf8');
    const config = JSON.parse(muState);
    for (const func of config.functions) {
        if (func.backend_state.type === 'icp') {
            idls.set(func.name, func.backend_state.js_bindings);
            canisterIds.set(func.name, func.backend_state.canister_id);
        }
    }
}

function getFunctionCode(name: string, idl: string) {
    const canisterId = canisterIds.get(name);
    const out = `
    import { idlFactory } from "mu/icp-idls/${name}";
    import { MuICPConnection } from "mu";

    const conn = new MuICPConnection('${canisterId}', idlFactory);
    await conn.connect();

    export default new Proxy({}, {
        get: function(target, prop, receiver) {
            return async function(...args) {
                return await conn.call(prop, args);
            }
        }
    });
    `

    return out;
}

export default function myPlugin(): Plugin {
    return {
        name: 'mu-js-plugin',
        resolveId(id) {
            if (id.startsWith('mu/icp-idls/') || id.startsWith('mu/function/')) {
                const name = id.split('/')[2];
                if (idls.has(name)) {
                    return id;
                }
            }
        },
        load(id) {
            if (id.startsWith('mu/icp-idls/')) {
                const name = id.split('/')[2];
                if (idls.has(name)) {
                    return idls.get(name);
                }
            } else if (id.startsWith('mu/function/')) {
                const name = id.split('/')[2];
                if (idls.has(name)) {
                    return getFunctionCode(name, idls.get(name));
                }
            }
        },
        resolveDynamicImport(specifier, parent) {
            if (typeof specifier === 'string' && specifier.startsWith('mu/icp-idls/')) {
                const name = specifier.split('/')[2];
                if (idls.has(name)) {
                    return {
                        id: specifier,
                        external: true
                    };
                }
            }
        },
        buildStart(options) {
            loadState();
        }
    };
}