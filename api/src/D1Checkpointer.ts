import { MemorySaver } from '@langchain/langgraph';
import type { D1Database } from '@cloudflare/workers-types';
import type { RunnableConfig } from '@langchain/core/runnables';
import {
	BaseCheckpointSaver,
	type Checkpoint,
	type CheckpointTuple,
	type SerializerProtocol,
	type CheckpointMetadata,
	copyCheckpoint,
} from '@langchain/langgraph-checkpoint';

export class D1Checkpointer extends BaseCheckpointSaver {
	private memorySaver: MemorySaver;
	private db: D1Database;
	protected isSetup: boolean;

	constructor(db: D1Database, serde?: SerializerProtocol) {
		super(serde);
		this.db = db;
		this.isSetup = false;
		this.memorySaver = new MemorySaver();
	}

	protected async setup(): Promise<void> {
		if (this.isSetup) {
			return;
		}

		await this.db.exec(
			`CREATE TABLE IF NOT EXISTS checkpoints (thread_id TEXT NOT NULL, checkpoint_ns TEXT NOT NULL DEFAULT '', checkpoint_id TEXT NOT NULL, parent_checkpoint_id TEXT, type TEXT, checkpoint BLOB, metadata BLOB, PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id));`
		);
		await this.db.exec(
			`CREATE TABLE IF NOT EXISTS writes (thread_id TEXT NOT NULL,	checkpoint_ns TEXT NOT NULL DEFAULT '',	checkpoint_id TEXT NOT NULL, task_id TEXT NOT NULL,	idx INTEGER NOT NULL, channel TEXT NOT NULL, type TEXT,	value BLOB, PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx));`
		);
		this.isSetup = true;
	}

	async put(
		config: RunnableConfig,
		checkpoint: Checkpoint,
		metadata: CheckpointMetadata
	): Promise<RunnableConfig> {
		console.log(`D1Checkpointer put`);

		await this.setup();

		if (!config.configurable) {
			throw new Error('Empty configuration supplied.');
		}

		const thread_id = config.configurable?.thread_id;
		const checkpoint_ns = config.configurable?.checkpoint_ns ?? '';
		const parent_checkpoint_id = config.configurable?.checkpoint_id ?? '';

		if (!thread_id) {
			throw new Error(`Missing "thread_id" field in passed "config.configurable".`);
		}

		const preparedCheckpoint: Partial<Checkpoint> = copyCheckpoint(checkpoint);
		delete preparedCheckpoint.pending_sends;
		const [type1, serializedCheckpoint] = this.serde.dumpsTyped(preparedCheckpoint);
		const [type2, serializedMetadata] = this.serde.dumpsTyped(metadata);

		if (type1 !== type2) {
			throw new Error('Failed to serialized checkpoint and metadata to the same type.');
		}

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

		this.memorySaver.put(config, checkpoint, metadata);

		return {
			configurable: {
				thread_id,
				checkpoint_ns,
				checkpoint_id: checkpoint.id,
			},
		};
	}

	async putWrites(threadId: string, threadTs: number, writes: any[]): Promise<void> {
		console.log(`D1Checkpointer putWrites ${threadId}`);
		return this.memorySaver.putWrites(threadId, threadTs, writes);
	}

	async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
		console.log(`D1Checkpointer getTuple`);

		await this.setup();
		const { thread_id, checkpoint_ns = '', checkpoint_id } = config.configurable ?? {};

		const args = [thread_id, checkpoint_ns];
		if (checkpoint_id) {
			args.push(checkpoint_id);
		}

		const sql = `
			SELECT
				thread_id,
				checkpoint_ns,
				checkpoint_id,
				parent_checkpoint_id,
				type,
				checkpoint,
				metadata
			FROM checkpoints
			WHERE thread_id = ? AND checkpoint_ns = ? ${
				checkpoint_id ? 'AND checkpoint_id = ?' : 'ORDER BY checkpoint_id DESC LIMIT 1'
			}`;

		const checkpointResult = await this.db
			.prepare(sql)
			.bind(...args)
			.first();

		return this.memorySaver.getTuple(config);
	}

	async list(filter?: Partial<{ threadId: string; threadTs: number }>): Promise<any[]> {
		console.log(`D1Checkpointer list ${filter}`);
		return this.memorySaver.list(filter);
	}
}
