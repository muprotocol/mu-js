import { Actor, HttpAgent } from "@dfinity/agent";

export { default as muJsRollupPlugin } from './rollup-plugin';

// Abstract class for a connection
export abstract class MuConnection {
    abstract connect(): Promise<void>;
    abstract disconnect(): Promise<void>;
    abstract call(functionName: string, args: any[]): Promise<any>;
}

// ICP-specific connection implementation with call capability
export class MuICPConnection extends MuConnection {
    private canisterId: string;
    private idlFactory: any;
    private actor: any = null;

    constructor(canisterId: string, idlFactory: any) {
        super();
        this.canisterId = canisterId;
        this.idlFactory = idlFactory;
    }

    async connect(): Promise<void> {
        console.log("MuICPConnection.connect");
        const agent = await HttpAgent.create({
            host: "http://localhost:4943",
        });

        // Optionally fetch root key for local development
        // if (process.env.DFX_NETWORK !== "ic") {
        await agent.fetchRootKey();
        // }

        // Initialize the actor using the provided IDL factory and canister ID
        console.log(this.idlFactory);
        console.log(this.canisterId);
        this.actor = Actor.createActor(this.idlFactory, {
            agent,
            canisterId: this.canisterId,
        });
    }

    async disconnect(): Promise<void> {
        console.log("MuICPConnection.disconnect");
        this.actor = null;
    }

    async call(functionName: string, args: any[]): Promise<any> {
        if (!this.actor) {
            throw new Error("Connection not established. Please connect first.");
        }

        console.log(`Calling function '${functionName}' with arguments:`, args);

        // Call the specified method on the ICP actor
        if (typeof this.actor[functionName] !== "function") {
            throw new Error(`Function '${functionName}' does not exist on the actor.`);
        }

        return this.actor[functionName](...args);
    }
}
