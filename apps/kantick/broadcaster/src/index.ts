

export interface Env {
	BLOCK_ROOM: DurableObjectNamespace;
	SLOT_ENCRYPTION_KEY: string;
	AUTH_KEY: string;
}

// Worker Entry Point
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		if (request.url.includes("debug")) return new Response(JSON.stringify(Object.fromEntries(request.headers.entries())));
		// We use a single global Durable Object instance to hold all connections.
		const id = env.BLOCK_ROOM.idFromName("GLOBAL_ROOM");
		const obj = env.BLOCK_ROOM.get(id);

		// 1. Handle Broadcast (POST) - Authenticated
		if (request.method === "POST") {
			const providedKey = request.headers.get("X-Auth-Key");
			// Secure comparison
			if (providedKey !== env.AUTH_KEY) {
				return new Response("Unauthorized", { status: 401 });
			}
			// If authorized, forward to the Durable Object to broadcast
			return obj.fetch(request);
		}

		// 2. Handle WebSocket (Upgrade) - Public
		if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
			return obj.fetch(request);
		}

		return new Response("Not found (Entry)", { status: 404 });
	},
};

// Durable Object Class
export class BlockRoom {
	state: DurableObjectState;
	sessions: WebSocket[];

	env: Env;
	constructor(state: DurableObjectState, env: Env) {
		this.env = env;
		this.state = state;
		this.sessions = [];
	}

	async fetch(request: Request): Promise<Response> {
		// 1. Handle WebSocket Connection (Clients)
		if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
			const pair = new WebSocketPair();
			const [client, server] = Object.values(pair);

			// Accept the connection
			server.accept();
			this.sessions.push(server);

			// Handle close event to cleanup
			server.addEventListener("close", () => {
				this.sessions = this.sessions.filter((s) => s !== server);
			});

			return new Response(null, { status: 101, webSocket: client });
		}

		// 2. Handle Broadcast (POST)
		// We assume the Worker Entry Point already verified Auth.
		if (request.method === "POST") {
			const rawText = await request.text();
			let dataObj;
			try {
				dataObj = JSON.parse(rawText);
			} catch (e) {
				return new Response('Invalid JSON', { status: 400 });
			}
			
			// Forward the payload exactly as received from the Extractor
			this.broadcast(JSON.stringify(dataObj));
			return new Response("Broadcasted to " + this.sessions.length + " clients", { status: 200 });
		}

		return new Response("Not found (Entry)", { status: 404 });
	}

	broadcast(data: string) {
		// Clean up dead connections while broadcasting
		this.sessions = this.sessions.filter((session) => {
			try {
				session.send(data);
				return true;
			} catch (err) {
				return false;
			}
		});
	}
}
