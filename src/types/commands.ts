/**
 * Argument values accepted by the public command API.
 *
 * The current Connect API v2 protocol implementation rejects command
 * arguments, but this type documents the intended high-level input shape.
 */
export type CommandArgument = boolean | number | string;

/**
 * Structured command request shape for callers that want to queue or serialize
 * command work before passing it to `IFCClient.command`.
 */
export interface ProtocolCommandRequest {
	command: string;
	arguments: CommandArgument[];
}
