/*
 * Copyright © 2020 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Logging } from "@google-cloud/logging";

/**
 * Severity of User-facing skill logging
 *
 * Note: This starts at Info level because everything below should
 * be considered debug output considered for the skill author only.
 */
export enum Severity {
	Info,
	Warning,
	Error,
}

/**
 * Simple logging object suitable for submitting Skill audit logs
 */
export interface Logger {
	/**
	 * Log a certain message or object to the skill audit log
	 * @param msg simple string or array of strings to log
	 * @param severity severity of skill audit message
	 * @param labels additional labels to be added to the audit log
	 */
	log(
		msg: string | string[],
		severity?: Severity,
		labels?: Record<string, any>,
	): Promise<void>;
}

/**
 * Create an instance of Logger from the current GCF context object
 * @param context the context parameter passed into the GCF handler entry point
 * @param labels additional labels to be added to the audit log
 */
export function createLogger(
	context: { eventId?: string; correlationId: string; workspaceId: string },
	labels: Record<string, any> = {},
	name = "skills_audit",
	project?: string,
): Logger {
	if (!context || !context.correlationId || !context.workspaceId) {
		throw new Error(
			`Provided context is missing correlationId and/or workspaceId: ${JSON.stringify(
				context,
			)}`,
		);
	}

	const logging = new Logging({
		projectId: project,
	});
	const log = logging.log(name);

	return {
		log: async (msg, severity = Severity.Info, labelss = {}) => {
			const metadata = {
				labels: {
					...labels,
					...labelss,
					execution_id: context.eventId,
					correlation_id: context.correlationId,
					workspace_id: context.workspaceId,
				},
				resource: {
					type: "global",
				},
			};

			const entries = [];
			if (Array.isArray(msg)) {
				entries.push(...msg.map(m => log.entry(metadata, m)));
			} else {
				entries.push(log.entry(metadata, msg));
			}

			switch (severity) {
				case Severity.Warning:
					await log.warning(entries);
					break;
				case Severity.Error:
					await log.error(entries);
					break;
				default:
					await log.info(entries);
					break;
			}
		},
	};
}
