/** biome-ignore-all lint/suspicious/noConsole: logging util */

export type LogLevel = "VERBOSE" | "INFO" | "DEBUG" | "WARNING" | "ERROR";

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
	VERBOSE: 0,
	INFO: 1,
	DEBUG: 2,
	WARNING: 3,
	ERROR: 4,
};

const LOG_COLORS = {
	VERBOSE: "\x1b[37m", // Medium gray
	INFO: "\x1b[90m", // Dark gray
	DEBUG: "\x1b[36m", // Cyan
	WARNING: "\x1b[33m", // Yellow
	ERROR: "\x1b[31m", // Red
	RESET: "\x1b[0m", // Reset
};

type Logger = {
	verbose: (message: string, data?: unknown) => void;
	info: (message: string, data?: unknown) => void;
	debug: (message: string, data?: unknown) => void;
	warn: (message: string, data?: unknown) => void;
	error: (message: string, data?: unknown) => void;
};

/**
 * Creates a logger instance for a specific service.
 * The log level is determined by the LOG_LEVEL environment variable.
 * Defaults to 'INFO' if not set.
 *
 * @param service - The name of the service using this logger
 * @returns A logger object with methods for each log level
 *
 * @example
 * ```ts
 * const logger = createLogger('UserService');
 * logger.info('User created successfully', { userId: '123' });
 * logger.error('Failed to fetch user', { error: 'Not found' });
 * ```
 */
export function createLogger(service: string): Logger {
	const envLogLevel = (process.env.LOG_LEVEL || "INFO") as LogLevel;
	const currentLogLevel = LOG_LEVEL_ORDER[envLogLevel] ?? LOG_LEVEL_ORDER.INFO;

	const shouldLog = (level: LogLevel): boolean =>
		LOG_LEVEL_ORDER[level] >= currentLogLevel;

	const formatMessage = (
		level: LogLevel,
		message: string,
		data?: unknown
	): string => {
		const timestamp = new Date().toISOString();
		const color = LOG_COLORS[level];
		const reset = LOG_COLORS.RESET;

		let output = `${color}[${timestamp}] [${level}] [${service}] ${message}${reset}`;

		if (data) {
			try {
				output += ` ${JSON.stringify(data)}`;
			} catch {
				output += ` ${String(data)}`;
			}
		}

		return output;
	};

	const log = (level: LogLevel, message: string, data?: unknown): void => {
		if (!shouldLog(level)) {
			return;
		}

		const formattedMessage = formatMessage(level, message, data);

		switch (level) {
			case "ERROR":
				console.error(formattedMessage);
				break;
			case "WARNING":
				console.warn(formattedMessage);
				break;
			case "DEBUG":
				console.debug(formattedMessage);
				break;
			case "INFO":
				console.info(formattedMessage);
				break;
			default:
				console.log(formattedMessage);
				break;
		}
	};

	return {
		verbose: (message: string, data?: unknown) => log("VERBOSE", message, data),
		info: (message: string, data?: unknown) => log("INFO", message, data),
		debug: (message: string, data?: unknown) => log("DEBUG", message, data),
		warn: (message: string, data?: unknown) => log("WARNING", message, data),
		error: (message: string, data?: unknown) => log("ERROR", message, data),
	};
}
