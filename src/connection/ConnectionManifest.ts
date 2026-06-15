export interface ConnectionManifest {
	host: string;
	port: number;
	connectedAt: Date;

	aircraft: {
		type: string;
	};

	validation: {
		sampledStates: string[];
		responseTimeMs: number;
	};
}
