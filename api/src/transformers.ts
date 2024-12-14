import { Hono } from 'hono';
import { pipeline, env } from '@xenova/transformers';


const app = new Hono()
.post('/', async (c) => {
	const pipe = await pipeline('sentiment-analysis');
	const out = await pipe('I love transformers!');
	console.log(out);
	return c.json(out);
});

export default app;
