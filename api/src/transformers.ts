import { Hono } from 'hono';
import { pipeline, env } from '@xenova/transformers';

class MyClassificationPipeline {
	static task = 'text-classification';
	static model = 'Xenova/distilbert-base-uncased-finetuned-sst-2-english';
	static instance = null;

	static async getInstance(progress_callback = null) {
	  if (this.instance === null) {

		// NOTE: Uncomment this to change the cache directory
		// env.cacheDir = './.cache';

		this.instance = pipeline(this.task, this.model, { progress_callback });
	  }

	  return this.instance;
	}
  }

//MyClassificationPipeline.getInstance();

const app = new Hono()
.post('/', async (c) => {
	const classifier = await MyClassificationPipeline.getInstance();
	let response = await classifier(text);
	//const pipe = await pipeline('sentiment-analysis');
	//const out = await pipe('I love transformers!');
	console.log(JSON.stringify(response));
	return c.json(response);
});

export default app;
