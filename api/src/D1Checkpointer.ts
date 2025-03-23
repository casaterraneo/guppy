import { MemorySaver } from '@langchain/langgraph';
import type { D1Database } from '@cloudflare/workers-types';
import type { RunnableConfig } from '@langchain/core/runnables';
import {
	BaseCheckpointSaver,
	type Checkpoint,
	type CheckpointTuple,
	type CheckpointMetadata,
} from '@langchain/langgraph-checkpoint';

export class D1Checkpointer extends BaseCheckpointSaver {
	private memorySaver: MemorySaver;
	private db: D1Database;

	constructor(db: D1Database) {
		super();
		this.db = db;
		this.memorySaver = new MemorySaver();
	}

	// async put(threadId: string, threadTs: number, data: any): Promise<void> {
	// 	console.log(`D1Checkpointer put ${threadId}`);
	// 	return this.memorySaver.put(threadId, threadTs, data);
	// }

	async put(
		config: RunnableConfig,
		checkpoint: Checkpoint,
		metadata: CheckpointMetadata
	): Promise<RunnableConfig> {
		console.log(`D1Checkpointer put`);

		await this.db.exec(
			`CREATE TABLE IF NOT EXISTS checkpoints (thread_id TEXT NOT NULL, checkpoint_ns TEXT NOT NULL DEFAULT '', checkpoint_id TEXT NOT NULL, parent_checkpoint_id TEXT, type TEXT, checkpoint BLOB, metadata BLOB, PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id));`
		);

		if (!config.configurable) {
			throw new Error('Empty configuration supplied.');
		}

		const thread_id = config.configurable?.thread_id;
		const checkpoint_ns = config.configurable?.checkpoint_ns ?? '';
		const parent_checkpoint_id = config.configurable?.checkpoint_id;

		if (!thread_id) {
			throw new Error(`Missing "thread_id" field in passed "config.configurable".`);
		}

		var type1 = '';
		var serializedCheckpoint = '';
		var serializedMetadata = '';

		const row = [
			thread_id,
			checkpoint_ns,
			checkpoint.id,
			parent_checkpoint_id,
			type1,
			serializedCheckpoint,
			serializedMetadata,
		];

		await this.db
			.prepare(
				`INSERT OR REPLACE INTO checkpoints (thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id, type, checkpoint, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(...row)
			.run();

		return this.memorySaver.put(config, checkpoint, metadata);
	}

	async putWrites(threadId: string, threadTs: number, writes: any[]): Promise<void> {
		console.log(`D1Checkpointer putWrites ${threadId}`);
		return this.memorySaver.putWrites(threadId, threadTs, writes);
	}

	async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
		console.log(`D1Checkpointer getTuple`);
		return this.memorySaver.getTuple(config);
	}

	async list(filter?: Partial<{ threadId: string; threadTs: number }>): Promise<any[]> {
		console.log(`D1Checkpointer list ${filter}`);
		return this.memorySaver.list(filter);
	}
}
