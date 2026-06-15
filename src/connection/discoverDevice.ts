import dgram from "node:dgram";
import net from "node:net";

import { DiscoveryTimeoutError } from "../errors";
import type { InfiniteFlightDevice } from "../types/discovery";

const DISCOVERY_PORT = 15000;
const DEFAULT_DISCOVERY_TIMEOUT = 15_000;

/**
 * Raw UDP discovery packet shape.
 *
 * Discovery packets arrive as JSON, so every field starts as unknown and is
 * checked before being copied into the public `InfiniteFlightDevice` type.
 */
interface DiscoveryPacket {
	state?: unknown;
	port?: unknown;
	deviceID?: unknown;
	aircraft?: unknown;
	version?: unknown;
	deviceName?: unknown;
	addresses?: unknown;
	livery?: unknown;
}

/**
 * Wait for an Infinite Flight UDP discovery packet.
 *
 * Infinite Flight advertises device identity, aircraft details, candidate
 * network addresses, and an advertised port on UDP port 15000. The first valid
 * packet wins.
 *
 * @param timeout Maximum time to wait in milliseconds.
 * @returns Parsed device metadata.
 */
export async function discoverDevice(
	timeout = DEFAULT_DISCOVERY_TIMEOUT,
): Promise<InfiniteFlightDevice> {
	return new Promise((resolve, reject) => {
		const socket = dgram.createSocket("udp4");

		let settled = false;

		const finish = (error?: Error, device?: InfiniteFlightDevice): void => {
			if (settled) {
				return;
			}

			settled = true;
			clearTimeout(timer);
			socket.close();

			if (error) {
				reject(error);
				return;
			}

			resolve(device!);
		};

		const timer = setTimeout(() => {
			finish(new DiscoveryTimeoutError(timeout));
		}, timeout);

		socket.on("error", (error) => {
			finish(error);
		});

		socket.on("message", (message, remoteInfo) => {
			try {
				const packet = JSON.parse(message.toString("utf8")) as DiscoveryPacket;
				const device = parseDiscoveryPacket(packet);
				console.log(device);
				finish(undefined, device);
			} catch {
				// Ignore unrelated or malformed UDP packets.
			}
		});

		socket.bind(DISCOVERY_PORT, () => {
			socket.setBroadcast(true);
		});
	});
}

/**
 * Validate and normalize a discovery packet.
 *
 * The remote UDP sender address is added to the address list
 */
function parseDiscoveryPacket(packet: DiscoveryPacket): InfiniteFlightDevice {
	// Check for the presence of required fields with the expected types. (address: string[], port: int, devideID, version, deviceName,state,aircraft,livery)
	if (
		typeof packet.state !== "string" ||
		typeof packet.port !== "number" ||
		typeof packet.deviceID !== "string" ||
		typeof packet.version !== "string" ||
		typeof packet.deviceName !== "string" ||
		typeof packet.aircraft !== "string" ||
		typeof packet.livery !== "string" ||
		!Array.isArray(packet.addresses) ||
		!packet.addresses.every((address) => typeof address === "string")
	) {
		throw new Error("Received an invalid discovery packet.");
	}

	//Find a singular address from the addresses, which is ipv4 and makes sense (not 127.0.0.1 or 192.0.0.1/2)
	let validAddress: string | null = null;
	validAddress =
		packet.addresses.find((address) => {
			return (
				net.isIPv4(address) &&
				!address.startsWith("127.") &&
				!address.startsWith("192.0.0.")
			);
		}) || null;

	if (validAddress === null) {
		throw new Error("No valid address found in discovery packet.");
	}

	return {
		state: packet.state,
		deviceId: packet.deviceID,
		deviceName: packet.deviceName,
		aircraft: packet.aircraft,
		livery: packet.livery,
		version: packet.version,
		address: validAddress,
		advertisedPort: packet.port,
	};
}
