export interface ConnectionManifest {
	host: string;
	port: number;
	connectedAt: Date;

	aircraft: {
		type: string;
		livery?: string;
	};

	device?: {
		id: string;
		name: string;
		version: string;
	};

	discovery: {
		automatic: boolean;
	};

	validation: {
		sampledStates: string[];
		responseTimeMs: number;
	};
}
