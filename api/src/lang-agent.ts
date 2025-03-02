import { Hono } from 'hono';

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createToolCallingAgent } from "langchain/agents";
import { AgentExecutor } from "langchain/agents";

import { ChatMessageHistory } from "@langchain/community/stores/message/in_memory";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { CloudflareD1MessageHistory } from '@langchain/cloudflare';
import { BufferMemory } from 'langchain/memory';

const magicTool = tool(
	async ({ input }: { input: number }) => {
	  return `${input + 2}`;
	},
	{
	  name: "magic_function",
	  description: "Applies a magic function to an input.",
	  schema: z.object({
		input: z.number(),
	  }),
	}
  );

const app = new Hono()
	.post('run', async c => {
		const { messages } = await c.req.json();
		if (!messages)
			return c.json({ error: 'Message is required' }, 400);

		const input = messages[0];

		const llm = new ChatGoogleGenerativeAI({
			model: 'gemini-1.5-flash-latest',
			apiKey: c.env.GOOGLE_AI_STUDIO_TOKEN,
			temperature: 0,
		});

		const tools = [magicTool];

		const prompt = ChatPromptTemplate.fromMessages([
			["system", "You are a helpful assistant"],
			["placeholder", "{chat_history}"],
			["human", "{input}"],
			["placeholder", "{agent_scratchpad}"],
		  ]);

		  const agent = createToolCallingAgent({
			llm,
			tools,
			prompt,
		  });

		  const agentExecutor = new AgentExecutor({
			agent,
			tools,
		  });

		  const output = await agentExecutor.invoke({ input: input });

		  console.log(output);

		  return c.json(output);

		// const db = c.get('db');
		// const memory = new CloudflareD1MessageHistory({
		// 	sessionId: 'agent-session-id',
		// 	database: db,
		// });
		const memory = new ChatMessageHistory();

		const agentExecutorWithMemory = new RunnableWithMessageHistory({
			runnable: agentExecutor,
			getMessageHistory: () => memory,
			inputMessagesKey: "input",
			historyMessagesKey: "chat_history",
		  });

		  const config = { configurable: { sessionId: "test-session" } };

		 let agentOutput = await agentExecutorWithMemory.invoke(
			{ input: "Hi, I'm polly! What's the output of magic_function of 3?" },
			config
		  );

		  console.log(agentOutput.output);

		  agentOutput = await agentExecutorWithMemory.invoke(
			{ input: "Remember my name?" },
			config
		  );

		  console.log(agentOutput.output);

		  agentOutput = await agentExecutorWithMemory.invoke(
			{ input: "what was that output again?" },
			config
		  );

		  console.log(agentOutput.output);

		// await memory.saveContext(chainInput, {
		// 	output: agentOutput.output,
		// });

		return c.json(agentOutput.output);
	});

export default app;
