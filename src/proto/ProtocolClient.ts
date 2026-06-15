import net from "node:net";

import type { CommandArgument } from "../types/commands";
import type { StateValue } from "../types/states";

const MANIFEST_ID = -1;
const DEFAULT_REQUEST_TIMEOUT = 5_000;

enum APIDataType {
	Boolean = 0,
	Integer = 1,
	Float = 2,
	Double = 3,
	String = 4,
	Long = 5,
}

export interface ManifestEntry {
	id: number;
	dataType: APIDataType | -1;
	name: string;
}

interface PendingRead {
	resolve: (value: StateValue) => void;
	reject: (error: Error) => void;
	timer: NodeJS.Timeout;
}

interface PendingManifest {
	resolve: (entries: Map<string, ManifestEntry>) => void;
	reject: (error: Error) => void;
	timer: NodeJS.Timeout;
}

export class ProtocolClient {
	private socket?: net.Socket;
	private receiveBuffer = Buffer.alloc(0);

	private readonly manifest = new Map<string, ManifestEntry>();
	private readonly pendingReads = new Map<number, PendingRead[]>();

	private pendingManifest?: PendingManifest;

	private connected = false;

	public async connect(host: string, port: number): Promise<void> {
		if (this.connected) {
			return;
		}

		await new Promise<void>((resolve, reject) => {
			const socket = net.createConnection({
				host,
				port,
			});

			this.socket = socket;

			const onInitialError = (error: Error): void => {
				socket.removeListener("connect", onConnect);
				reject(error);
			};

			const onConnect = (): void => {
				socket.removeListener("error", onInitialError);

				this.connected = true;
				this.attachSocketListeners(socket);

				resolve();
			};

			socket.once("error", onInitialError);
			socket.once("connect", onConnect);
		});

		try {
			const manifest = await this.requestManifest();

			this.manifest.clear();

			for (const [name, entry] of manifest) {
				this.manifest.set(name, entry);
			}
		} catch (error) {
			await this.disconnect();
			throw error;
		}
	}

	public async disconnect(): Promise<void> {
		const socket = this.socket;

		this.connected = false;
		this.socket = undefined;
		this.receiveBuffer = Buffer.alloc(0);
		this.manifest.clear();

		this.rejectPendingRequests(
			new Error("The Infinite Flight connection was closed."),
		);

		if (!socket || socket.destroyed) {
			return;
		}

		await new Promise<void>((resolve) => {
			socket.once("close", () => {
				resolve();
			});

			socket.end();

			/*
			 * Avoid hanging forever if the remote device does not complete
			 * the TCP shutdown.
			 */
			const timer = setTimeout(() => {
				socket.destroy();
			}, 1_000);

			timer.unref();
		});
	}

	public async read(path: string): Promise<StateValue> {
		const entry = this.getStateEntry(path);

		const socket = this.assertSocket();

		return new Promise<StateValue>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.removePendingRead(entry.id, pending);

				reject(new Error(`Timed out while reading state "${path}".`));
			}, DEFAULT_REQUEST_TIMEOUT);

			const pending: PendingRead = {
				resolve,
				reject,
				timer,
			};

			const queue = this.pendingReads.get(entry.id) ?? [];
			queue.push(pending);
			this.pendingReads.set(entry.id, queue);

			const request = this.createRequest(entry.id, false);

			socket.write(request, (error) => {
				if (!error) {
					return;
				}

				this.removePendingRead(entry.id, pending);
				clearTimeout(timer);
				reject(error);
			});
		});
	}

	public async write(path: string, value: StateValue): Promise<void> {
		const entry = this.getStateEntry(path);
		const socket = this.assertSocket();

		const encodedValue = this.encodeValue(entry.dataType, value, path);

		const request = Buffer.concat([
			this.createRequest(entry.id, true),
			encodedValue,
		]);
		console.log(`Writing value to "${path}":`, value);
		console.log(request);
		console.log(socket.address());
		await this.writeToSocket(socket, request);
	}

	public async command(
		command: string,
		arguments_: CommandArgument[],
	): Promise<void> {
		if (arguments_.length > 0) {
			throw new Error(
				`Command arguments are not supported by Connect API v2: "${command}".`,
			);
		}

		const entry = this.manifest.get(command);

		if (!entry) {
			throw new Error(
				`Command is not available for the current aircraft: "${command}".`,
			);
		}

		if (entry.dataType !== -1) {
			throw new Error(`Manifest entry "${command}" is a state, not a command.`);
		}

		const socket = this.assertSocket();
		const request = this.createRequest(entry.id, false);

		await this.writeToSocket(socket, request);
	}

	public has(path: string): boolean {
		return this.manifest.has(path);
	}

	public getManifest(): ReadonlyMap<string, ManifestEntry> {
		return this.manifest;
	}

	private attachSocketListeners(socket: net.Socket): void {
		socket.on("data", (data: Buffer | string) => {
			const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data);

			this.receiveBuffer = Buffer.concat([this.receiveBuffer, chunk]);

			this.processReceiveBuffer();
		});

		socket.on("error", (error) => {
			this.rejectPendingRequests(error);
		});

		socket.on("close", () => {
			this.connected = false;

			if (this.socket === socket) {
				this.socket = undefined;
			}

			this.rejectPendingRequests(
				new Error("The Infinite Flight connection was closed."),
			);
		});
	}

	private async requestManifest(): Promise<Map<string, ManifestEntry>> {
		const socket = this.assertSocket();

		if (this.pendingManifest) {
			throw new Error("A manifest request is already in progress.");
		}

		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pendingManifest = undefined;

				reject(
					new Error("Timed out while requesting the Connect API manifest."),
				);
			}, DEFAULT_REQUEST_TIMEOUT);

			this.pendingManifest = {
				resolve,
				reject,
				timer,
			};

			socket.write(this.createRequest(MANIFEST_ID, false), (error) => {
				if (!error) {
					return;
				}

				clearTimeout(timer);
				this.pendingManifest = undefined;
				reject(error);
			});
		});
	}

	private processReceiveBuffer(): void {
		/*
		 * Every response begins with:
		 *
		 * 4 bytes: response/state ID
		 * 4 bytes: payload length
		 * N bytes: payload
		 */
		while (this.receiveBuffer.length >= 8) {
			const id = this.receiveBuffer.readInt32LE(0);
			const payloadLength = this.receiveBuffer.readInt32LE(4);

			if (payloadLength < 0) {
				this.handleProtocolFailure(
					new Error(`Received invalid payload length: ${payloadLength}.`),
				);

				return;
			}

			const frameLength = 8 + payloadLength;

			if (this.receiveBuffer.length < frameLength) {
				return;
			}

			const payload = this.receiveBuffer.subarray(8, frameLength);

			this.receiveBuffer = this.receiveBuffer.subarray(frameLength);

			if (id === MANIFEST_ID) {
				this.handleManifestResponse(payload);
				continue;
			}

			this.handleStateResponse(id, payload);
		}
	}

	private handleManifestResponse(payload: Buffer): void {
		const pending = this.pendingManifest;

		if (!pending) {
			return;
		}

		try {
			const manifestText = this.decodeString(payload);
			const manifest = this.parseManifest(manifestText);

			clearTimeout(pending.timer);
			this.pendingManifest = undefined;
			pending.resolve(manifest);
		} catch (error) {
			clearTimeout(pending.timer);
			this.pendingManifest = undefined;

			pending.reject(
				error instanceof Error
					? error
					: new Error("Could not parse the API manifest."),
			);
		}
	}

	private handleStateResponse(id: number, payload: Buffer): void {
		const queue = this.pendingReads.get(id);

		if (!queue || queue.length === 0) {
			return;
		}

		const pending = queue.shift();

		if (!pending) {
			return;
		}

		if (queue.length === 0) {
			this.pendingReads.delete(id);
		}

		clearTimeout(pending.timer);

		const entry = this.findManifestEntryById(id);

		if (!entry) {
			pending.reject(
				new Error(`Received a response for unknown state ID ${id}.`),
			);

			return;
		}

		try {
			const value = this.decodeValue(entry.dataType, payload);

			pending.resolve(value);
		} catch (error) {
			pending.reject(
				error instanceof Error
					? error
					: new Error(`Could not decode state "${entry.name}".`),
			);
		}
	}

	private parseManifest(manifestText: string): Map<string, ManifestEntry> {
		const entries = new Map<string, ManifestEntry>();

		for (const rawLine of manifestText.split("\n")) {
			const line = rawLine.trim();

			if (!line) {
				continue;
			}

			const firstComma = line.indexOf(",");
			const secondComma = line.indexOf(",", firstComma + 1);

			if (firstComma === -1 || secondComma === -1) {
				continue;
			}

			const id = Number.parseInt(line.slice(0, firstComma), 10);

			const dataType = Number.parseInt(
				line.slice(firstComma + 1, secondComma),
				10,
			);

			const name = line.slice(secondComma + 1).trim();

			if (!Number.isInteger(id) || !Number.isInteger(dataType) || !name) {
				continue;
			}

			if (
				dataType !== -1 &&
				(dataType < APIDataType.Boolean || dataType > APIDataType.Long)
			) {
				continue;
			}

			entries.set(name, {
				id,
				dataType: dataType as APIDataType | -1,
				name,
			});
		}

		if (entries.size === 0) {
			throw new Error("The Connect API returned an empty or invalid manifest.");
		}

		return entries;
	}

	private getStateEntry(path: string): ManifestEntry {
		const entry = this.manifest.get(path);

		if (!entry) {
			throw new Error(
				`State is not available for the current aircraft: "${path}".`,
			);
		}

		if (entry.dataType === -1) {
			throw new Error(`Manifest entry "${path}" is a command, not a state.`);
		}

		return entry;
	}

	private findManifestEntryById(id: number): ManifestEntry | undefined {
		for (const entry of this.manifest.values()) {
			if (entry.id === id) {
				return entry;
			}
		}

		return undefined;
	}

	private createRequest(id: number, hasData: boolean): Buffer {
		const request = Buffer.alloc(5);

		request.writeInt32LE(id, 0);
		request.writeUInt8(hasData ? 1 : 0, 4);

		return request;
	}

	private encodeValue(
		dataType: APIDataType | -1,
		value: StateValue,
		path: string,
	): Buffer {
		switch (dataType) {
			case APIDataType.Boolean: {
				if (typeof value !== "boolean") {
					throw this.invalidValueError(path, "boolean", value);
				}

				return Buffer.from([value ? 1 : 0]);
			}

			case APIDataType.Integer: {
				console.log(`Encoding integer value for "${path}":`, value);
				if (typeof value !== "number" || !Number.isInteger(value)) {
					throw this.invalidValueError(path, "32-bit integer", value);
				}

				const buffer = Buffer.alloc(4);
				buffer.writeInt32LE(value, 0);
				console.log(buffer);
				return buffer;
			}

			case APIDataType.Float: {
				if (typeof value !== "number" || !Number.isFinite(value)) {
					throw this.invalidValueError(path, "float", value);
				}

				const buffer = Buffer.alloc(4);
				buffer.writeFloatLE(value, 0);
				return buffer;
			}

			case APIDataType.Double: {
				if (typeof value !== "number" || !Number.isFinite(value)) {
					throw this.invalidValueError(path, "double", value);
				}

				const buffer = Buffer.alloc(8);
				buffer.writeDoubleLE(value, 0);
				return buffer;
			}

			case APIDataType.String: {
				if (typeof value !== "string") {
					throw this.invalidValueError(path, "string", value);
				}

				const stringBuffer = Buffer.from(value, "utf8");

				const lengthBuffer = Buffer.alloc(4);
				lengthBuffer.writeInt32LE(stringBuffer.length, 0);

				return Buffer.concat([lengthBuffer, stringBuffer]);
			}

			case APIDataType.Long: {
				if (
					typeof value !== "bigint" &&
					!(typeof value === "number" && Number.isSafeInteger(value))
				) {
					throw this.invalidValueError(path, "64-bit integer", value);
				}

				const buffer = Buffer.alloc(8);

				buffer.writeBigInt64LE(
					typeof value === "bigint" ? value : BigInt(value),
					0,
				);

				return buffer;
			}

			case -1:
				throw new Error(`Cannot encode a value for command "${path}".`);
		}
	}

	private decodeValue(dataType: APIDataType | -1, payload: Buffer): StateValue {
		switch (dataType) {
			case APIDataType.Boolean:
				this.assertPayloadLength(payload, 1);
				return payload.readUInt8(0) !== 0;

			case APIDataType.Integer:
				this.assertPayloadLength(payload, 4);
				return payload.readInt32LE(0);

			case APIDataType.Float:
				this.assertPayloadLength(payload, 4);
				return payload.readFloatLE(0);

			case APIDataType.Double:
				this.assertPayloadLength(payload, 8);
				return payload.readDoubleLE(0);

			case APIDataType.String:
				return this.decodeString(payload);

			case APIDataType.Long:
				this.assertPayloadLength(payload, 8);
				return payload.readBigInt64LE(0);

			case -1:
				throw new Error("Commands do not return state values.");
		}
	}

	private decodeString(payload: Buffer): string {
		this.assertPayloadLength(payload, 4);

		const stringLength = payload.readInt32LE(0);

		if (stringLength < 0 || payload.length < 4 + stringLength) {
			throw new Error("Received an invalid string payload.");
		}

		return payload.toString("utf8", 4, 4 + stringLength);
	}

	private assertPayloadLength(payload: Buffer, requiredLength: number): void {
		if (payload.length < requiredLength) {
			throw new Error(
				`Expected at least ${requiredLength} payload bytes, received ${payload.length}.`,
			);
		}
	}

	private assertSocket(): net.Socket {
		if (!this.connected || !this.socket || this.socket.destroyed) {
			throw new Error("The protocol client is not connected.");
		}

		return this.socket;
	}

	private async writeToSocket(socket: net.Socket, data: Buffer): Promise<void> {
		await new Promise<void>((resolve, reject) => {
			socket.write(data, (error) => {
				if (error) {
					reject(error);
					return;
				}

				resolve();
			});
		});
	}

	private removePendingRead(id: number, pending: PendingRead): void {
		const queue = this.pendingReads.get(id);

		if (!queue) {
			return;
		}

		const index = queue.indexOf(pending);

		if (index !== -1) {
			queue.splice(index, 1);
		}

		if (queue.length === 0) {
			this.pendingReads.delete(id);
		}
	}

	private rejectPendingRequests(error: Error): void {
		if (this.pendingManifest) {
			clearTimeout(this.pendingManifest.timer);
			this.pendingManifest.reject(error);
			this.pendingManifest = undefined;
		}

		for (const queue of this.pendingReads.values()) {
			for (const pending of queue) {
				clearTimeout(pending.timer);
				pending.reject(error);
			}
		}

		this.pendingReads.clear();
	}

	private handleProtocolFailure(error: Error): void {
		this.rejectPendingRequests(error);
		this.receiveBuffer = Buffer.alloc(0);
		this.socket?.destroy(error);
	}

	private invalidValueError(
		path: string,
		expected: string,
		value: unknown,
	): Error {
		return new TypeError(
			`Invalid value for "${path}". Expected ${expected}, received ${typeof value}.`,
		);
	}
}
