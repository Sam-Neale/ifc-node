export type CommandArgument = boolean | number | string;

export interface ProtocolCommandRequest {
	command: string;
	arguments: CommandArgument[];
}
