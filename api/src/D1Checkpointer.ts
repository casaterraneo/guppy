import { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';
import { MemorySaver } from '@langchain/langgraph';
import type { D1Database } from '@cloudflare/workers-types';

export class D1Checkpointer extends BaseCheckpointSaver {
	private memorySaver: MemorySaver;
	private db: D1Database;

	constructor(db: D1Database) {
		super();
		this.db = db;
		this.memorySaver = new MemorySaver();
	}

	async put(threadId: string, threadTs: number, data: any): Promise<void> {
		console.log(`D1Checkpointer put ${threadId}`);
		return this.memorySaver.put(threadId, threadTs, data);
	}

	async putWrites(threadId: string, threadTs: number, writes: any[]): Promise<void> {
		console.log(`D1Checkpointer putWrites ${threadId}`);
		return this.memorySaver.putWrites(threadId, threadTs, writes);
	}

	async getTuple(threadId: string, threadTs: number): Promise<any | null> {
		console.log(`D1Checkpointer getTuple ${threadId}`);
		return this.memorySaver.getTuple(threadId, threadTs);
	}

	async list(filter?: Partial<{ threadId: string; threadTs: number }>): Promise<any[]> {
		console.log(`D1Checkpointer list ${filter}`);
		return this.memorySaver.list(filter);
	}
}
