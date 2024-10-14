import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createRemoteJWKSet, jwtVerify } from 'jose'

type Bindings = {
	KV: KVNamespace;
};

const JWKS = createRemoteJWKSet(new URL('https://dev-lnkfyfu1two0vaem.us.auth0.com/.well-known/jwks.json'))
async function verifyToken(token) {
	const { payload } = await jwtVerify(token, JWKS, {
	  audience: 'https://myapi.example.com',
	  issuer: 'https://dev-lnkfyfu1two0vaem.us.auth0.com/',
	})
	return payload
  }

const app = new Hono<{ Bindings: Bindings }>();
app.use('/*', cors());

app.use('/api/*', async (c, next) => {
	const token = c.req.headers.get('Authorization')?.split(' ')[1]

	if (!token) {
	  return c.json({ error: 'No token provided' }, 401)
	}

	try {
	  const payload = await verifyToken(token)
	  c.set('user', payload)
	  return next()
	} catch (err) {
	  return c.json({ error: 'Token invalid', message: err.message }, 401)
	}
  });

// Middleware per verificare i permessi
function checkPermission(permission) {
	return (c, next) => {
	  const user = c.get('user')
	  if (user && user.permissions && user.permissions.includes(permission)) {
		return next()
	  } else {
		return c.json({ error: 'Insufficient permissions' }, 403)
	  }
	}
  }

// Middleware per aggiungere l'intestazione personalizzata
// app.use('/*', async (c, next) => {
// 	await next()
// 	c.res.headers.append('blazor-environment', 'Staging')
//   });

app.get('/api/kv/:key', async (c) => {
	const key = c.req.param('key');
	if (!key) return c.json({ error: 'Key is required' }, 400);
	const value = await c.env.KV.get(key);
	if (!value) return c.json({ error: 'Key not found' }, 404);
	return c.json({ key, value });
  });

  app.get('/api/kvs', async (c) => {
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
	  console.log(`Key "${key.name}"`);
	  // Se il prefisso è dei file, restituisce una stringa vuota
	  if (key.name.startsWith("f||")) {
		return { key: key.name, value: "" };
	  }
	  return { key: key.name, value };

	}));

	return c.json(result);
  });


  app.post('/api/kv', async (c) => {
	const { key, value } = await c.req.json();
	if (!key || !value) return c.json({ error: 'Key and value are required' }, 400);
	await c.env.KV.put(key, value);
	return c.json({ message: 'Item created successfully', key, value });
  });

  app.put('/api/kv/:key', async (c) => {
	const key = c.req.param('key');
	if (!key) return c.json({ error: 'Key is required' }, 400);
	const { value } = await c.req.json();
	if (!value) return c.json({ error: 'Value is required' }, 400);
	await c.env.KV.put(key, value);
	return c.json({ message: 'Item updated successfully', key, value });
  });

  app.delete('/api/kv/:key', async (c) => {
	const key = c.req.param('key');
	if (!key) return c.json({ error: 'Key is required' }, 400);
	await c.env.KV.delete(key);
	return c.json({ key, deleted: true });
  });

app.onError((err, c) => {
	console.error(`${err}`);
	return c.text(err.toString());
});

app.notFound(c => c.text('Not found', 404));

export default app;
