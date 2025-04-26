import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createMiddleware } from 'hono/factory';
import * as jose from 'jose';
import employees from './employees';
import kvs from './kvs';
import users from './users';

import googleAI from './google-ai';
import workersAI from './workers-ai';
import baristaBot from './barista-bot';
import agent from './lang-agent';
import agentSupervisor from './lang-agent-supervisor';

import counterDO from './counter-do';
import testClientWebSocket from './test-client-web-socket';
import testWsDo from './test-ws-do';

const JWKS = jose.createRemoteJWKSet(
	new URL('https://dev-lnkfyfu1two0vaem.us.auth0.com/.well-known/jwks.json')
);

//OK v5 KO v6
// async function verifyToken(token) {
// 	const { payload } = await jose.jwtVerify(token, JWKS, {
// 		audience: 'guppy-api',
// 		issuer: 'https://dev-lnkfyfu1two0vaem.us.auth0.com/',
// 	});
// 	return payload;
// }

//Test v6
async function verifyToken(jwt) {
	const options = {
		issuer: 'https://dev-lnkfyfu1two0vaem.us.auth0.com/',
		audience: 'guppy-api',
	};
	const { payload, protectedHeader } = await jose
		.jwtVerify(jwt, JWKS, options)
		.catch(async error => {
			if (error?.code === 'ERR_JWKS_MULTIPLE_MATCHING_KEYS') {
				for await (const publicKey of error) {
					try {
						return await jose.jwtVerify(jwt, publicKey, options);
					} catch (innerError) {
						if (innerError?.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
							continue;
						}
						throw innerError;
					}
				}
				throw new jose.errors.JWSSignatureVerificationFailed();
			}

			throw error;
		});
	return payload;
}

const tokenValidator = createMiddleware(async (c, next) => {
	const authHeader = c.req.header('Authorization');
	//console.log('[Auth Header]', authHeader);

	const token = authHeader?.split(' ')[1];
	//console.log('[Extracted Token]', token);

	if (!token) {
		console.log('[Error] No token provided');
		return c.json({ error: 'No token provided' }, 401);
	}

	try {
		//console.log('[Verify] Calling verifyToken...');
		const payload = await verifyToken(token);
		//console.log('[Success] Token payload:', payload);
		c.set('user', payload);
		return next();
	} catch (err) {
		console.error('[Verify Error]', err);
		return c.json({ error: 'Token invalid', message: err.message }, 401);
	}
});

const dbSetter = createMiddleware(async (c, next) => {
	const user = c.get('user');

	if (user && user.company_name) {
		var db = c.env.DB;
		if (c.env.ENVIRONMENT == 'production' && user.company_name == 'cli') {
			db = c.env.DB_CLI;
		}
		c.set('db', db);
		return next();
	} else {
		return c.json({ error: 'No company_name provided' }, 401);
	}
});

const app = new Hono();
app.use(logger());
app.use('/*', cors());
app.use('/api/*', tokenValidator);
app.use('/api/*', dbSetter);

app.route('/api/employees', employees);
app.route('/api/kvs', kvs);
app.route('/api/users', users);
app.route('/api/google-ai', googleAI);
app.route('/api/workers-ai', workersAI);
app.route('/api/barista-bot', baristaBot);
app.route('/api/agent', agent);
app.route('/api/agentSupervisor', agentSupervisor);
app.route('/api/counter-do', counterDO);
app.route('/ws', testClientWebSocket);
//app.route('/ws', testWsDo);

app.onError((err, c) => {
	console.error(`${err}`);
	return c.text(err.toString());
});
app.notFound(c => c.text('Not found', 404));

export { Counter } from './DurableObject/counter';
export { WebhookReceiver } from "./DurableObject/receiver";

export default {
	fetch: app.fetch,
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
		//ctx.waitUntil(env.LEADERBOARD_WORKFLOW.create());
	},
};
