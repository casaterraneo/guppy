import { Hono } from 'hono';
import { BufferMemory } from 'langchain/memory';
import { CloudflareD1MessageHistory } from '@langchain/cloudflare';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

const app = new Hono().post('barista-bot', async c => {
	const { messages } = await c.req.json();
	if (!messages) return c.json({ error: 'Message is required' }, 400);

	const input = messages[0];

	const db = c.get('db');
	const memory = new BufferMemory({
		returnMessages: true,
		chatHistory: new CloudflareD1MessageHistory({
			sessionId: 'barista-bot-session-id',
			database: db,
		}),
	});

	const prompt = ChatPromptTemplate.fromMessages([
		['system', 'You are a helpful chatbot'],
		new MessagesPlaceholder('history'),
		['user', '{input}'],
	]);

	const model = new ChatGoogleGenerativeAI({
		model: 'gemini-1.5-flash-latest',
		apiKey: c.env.GOOGLE_AI_STUDIO_TOKEN,
		temperature: 0,
	});

	const chain = RunnableSequence.from([
		{
			input: initialInput => initialInput.input,
			memory: () => memory.loadMemoryVariables({}),
		},
		{
			input: previousOutput => previousOutput.input,
			history: previousOutput => previousOutput.memory.history,
		},
		prompt,
		model,
		new StringOutputParser(),
	]);

	const chainInput = { input };

	const res = await chain.invoke(chainInput);
	await memory.saveContext(chainInput, {
		output: res,
	});

	return c.json(res);
});

export default app;
