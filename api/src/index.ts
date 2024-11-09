import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import employees from './employees';
import kvs from './kvs';

const JWKS = createRemoteJWKSet(new URL('https://dev-lnkfyfu1two0vaem.us.auth0.com/.well-known/jwks.json'))
async function verifyToken(token) {
	const { payload } = await jwtVerify(token, JWKS, {
	  audience: 'guppy_api',
	  issuer: 'https://dev-lnkfyfu1two0vaem.us.auth0.com/',
	})
	return payload
  }

const app = new Hono();
app.use(logger());
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

app.route('/api/employees', employees);
app.route('/api/kvs', kvs);

app.onError((err, c) => {
	console.error(`${err}`);
	return c.text(err.toString());
});

app.notFound(c => c.text('Not found', 404));

export default app;
