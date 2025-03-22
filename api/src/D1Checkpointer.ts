import { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';
import { MemorySaver } from '@langchain/langgraph';

export class D1Checkpointer extends BaseCheckpointSaver  {
	private memorySaver: MemorySaver;

	constructor() {
	  super();
	  this.memorySaver = new MemorySaver();
	}

	async put(threadId: string, threadTs: number, data: any): Promise<void> {
	  return this.memorySaver.put(threadId, threadTs, data);
	}

	async putWrites(threadId: string, threadTs: number, writes: any[]): Promise<void> {
	  return this.memorySaver.putWrites(threadId, threadTs, writes);
	}

	async getTuple(threadId: string, threadTs: number): Promise<any | null> {
	  return this.memorySaver.getTuple(threadId, threadTs);
	}

	async list(filter?: Partial<{ threadId: string; threadTs: number }>): Promise<any[]> {
	  return this.memorySaver.list(filter);
	}
  }
