// src/connection/discoverDevice.ts

import dgram from "node:dgram";
import net from "node:net";

import { DiscoveryTimeoutError } from "../errors";
import type { InfiniteFlightDevice } from "../types/discovery";

const DISCOVERY_PORT = 15000;
const DEFAULT_DISCOVERY_TIMEOUT = 15_000;

interface DiscoveryPacket {
	state?: unknown;
	port?: unknown;
	deviceId?: unknown;
	aircraft?: unknown;
	version?: unknown;
	deviceName?: unknown;
	addresses?: unknown;
	livery?: unknown;
}

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

				const device = parseDiscoveryPacket(packet, remoteInfo.address);

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

function parseDiscoveryPacket(
	packet: DiscoveryPacket,
	remoteAddress: string,
): InfiniteFlightDevice {
	const addresses = Array.isArray(packet.addresses)
		? packet.addresses.filter(
				(address): address is string => typeof address === "string",
			)
		: [];

	if (
		typeof packet.deviceId !== "string" ||
		typeof packet.deviceName !== "string" ||
		typeof packet.aircraft !== "string" ||
		typeof packet.version !== "string"
	) {
		throw new Error("Invalid discovery packet");
	}

	if (!addresses.includes(remoteAddress)) {
		addresses.push(remoteAddress);
	}

	return {
		state: typeof packet.state === "string" ? packet.state : "Unknown",

		deviceId: packet.deviceId,
		deviceName: packet.deviceName,
		aircraft: packet.aircraft,

		livery: typeof packet.livery === "string" ? packet.livery : "",

		version: packet.version,
		addresses,

		advertisedPort: typeof packet.port === "number" ? packet.port : 10111,
	};
}

export function selectDeviceAddress(device: InfiniteFlightDevice): string {
	const ipv4Address = device.addresses.find((address) => net.isIPv4(address));

	if (ipv4Address) {
		return ipv4Address;
	}

	const ipv6Address = device.addresses.find((address) =>
		net.isIPv6(
			address.includes("%") ? address.slice(0, address.indexOf("%")) : address,
		),
	);

	if (ipv6Address) {
		return ipv6Address;
	}

	throw new Error(`No usable address was advertised by ${device.deviceName}.`);
}
