// src/types/client.ts

export interface IFCClientOptions {
	host?: string;
	port?: number;

	discoveryTimeout?: number;
	connectionTimeout?: number;
	requestTimeout?: number;
}

export interface ResolvedIFCClientOptions {
	host?: string;
	port: number;
	discoveryTimeout: number;
	connectionTimeout: number;
	requestTimeout: number;
}
