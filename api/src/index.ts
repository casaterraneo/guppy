import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger'
import { createMiddleware } from 'hono/factory'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import employees from './employees';
import kvs from './kvs';
import users from './users';

const JWKS = createRemoteJWKSet(new URL('https://dev-lnkfyfu1two0vaem.us.auth0.com/.well-known/jwks.json'))
async function verifyToken(token) {
	const { payload } = await jwtVerify(token, JWKS, {
	  audience: 'guppy-api',
	  issuer: 'https://dev-lnkfyfu1two0vaem.us.auth0.com/',
	})
	return payload
  }

const tokenValidator = createMiddleware(async (c, next) => {

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
})

const dbSetter = createMiddleware(async (c, next) => {

	const user = c.get('user');

	if (user && user.company_name) {
		var db = c.env.DB;
		if(c.env.ENVIRONMENT == "production" && user.company_name == "cli") {
			db = c.env.DB_CLI;
		}
		c.set('db', db)
		return next()
	} else {
		return c.json({ error: 'No company_name provided' }, 401)
	}
})

const app = new Hono();
app.use(logger());
app.use('/*', cors());
app.use('/api/*', tokenValidator);
app.use('/api/*', dbSetter);

app.route('/api/employees', employees);
app.route('/api/kvs', kvs);
app.route('/api/users', users);

app.onError((err, c) => {
	console.error(`${err}`);
	return c.text(err.toString());
});
app.notFound(c => c.text('Not found', 404));

async function updateAPI() {
	console.log("cron processed api");
}
async function updateAPI2() {
	console.log("cron processe api 2");
}
async function updateAPI3() {
	console.log("cron processed api 3");
}

export default {
	fetch: app.fetch,
	scheduled: async (
		controller: ScheduledController,
		env: Env,
		ctx: ExecutionContext,
	  ) => {
    // Write code for updating your API
    switch (controller.cron) {
		case "*/3 * * * *":
		  // Every three minutes
		  await updateAPI();
		  break;
		case "*/10 * * * *":
		  // Every ten minutes
		  await updateAPI2();
		  break;
		case "*/45 * * * *":
		  // Every forty-five minutes
		  await updateAPI3();
		  break;
	  }
	  console.log("cron processed");
	},
  }
