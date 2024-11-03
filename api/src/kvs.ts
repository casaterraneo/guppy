import { Hono } from 'hono';

type Bindings = {
	KV: KVNamespace;
};

const app = new Hono<{ Bindings: Bindings }>()
.get('/', async (c) => {
	// Recupera i parametri dalla query string
	const prefix = c.req.query('prefix');
	const limit = c.req.query('limit');
	const cursor = c.req.query('cursor');

	// Costruisce l'oggetto options solo con i valori presenti
	const options = {};
	if (prefix) options.prefix = prefix;
	if (limit) options.limit = limit;
	if (cursor) options.cursor = cursor;

	// Esegue la chiamata KV.list con le options (se presenti)
	const list = await c.env.KV.list(options);

	const result = await Promise.all(list.keys.map(async (key) => {
	  const value = await c.env.KV.get(key.name);
	  // Se il prefisso è dei file, restituisce una stringa vuota
	  if (key.name.startsWith("f_")) {
		return { key: key.name, value: "" };
	  }
	  return { key: key.name, value };
	}));

	return c.json(result);
  })
.get('/:key', async (c) => {
	const key = c.req.param('key');
	if (!key) return c.json({ error: 'Key is required' }, 400);
	const value = await c.env.KV.get(key);
	if (!value) return c.json({ error: 'Key not found' }, 404);
	return c.json({ key, value });
  })
.post('/', async (c) => {
	const { key, value } = await c.req.json();
	if (!key || !value) return c.json({ error: 'Key and value are required' }, 400);
	await c.env.KV.put(key, value);
	return c.json({ message: 'Item created successfully', key, value });
  })
.post('/stream', async (c) => {

	const body = c.req.body;

    // Log del tipo di body ricevuto
    if (body instanceof ReadableStream) {
        console.log("Body is a ReadableStream");
    } else if (body instanceof ArrayBuffer) {
        console.log("Body is an ArrayBuffer");
    } else if (typeof body === 'string') {
        console.log("Body is a string");
    } else if (body instanceof FormData) {
        console.log("Body is FormData");
    } else {
        console.log(`Unknown body type: ${typeof body}`);
    }

	await c.env.KV.put("stream", c.req.body);
	return c.json({ message: 'Item stream created successfully'});
  })
.put('/:key', async (c) => {
	const key = c.req.param('key');
	if (!key) return c.json({ error: 'Key is required' }, 400);
	const { value } = await c.req.json();
	if (!value) return c.json({ error: 'Value is required' }, 400);
	await c.env.KV.put(key, value);
	return c.json({ message: 'Item updated successfully', key, value });
  })
.delete('/:key', async (c) => {
	const key = c.req.param('key');
	if (!key) return c.json({ error: 'Key is required' }, 400);
	await c.env.KV.delete(key);
	return c.json({ key, deleted: true });
  });

export default app;
