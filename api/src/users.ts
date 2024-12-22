import { Hono } from 'hono';

const app = new Hono()
	.get('/:id', async c => {
		const userId = c.req.param('id');
		if (!userId) return c.json({ error: 'UserId is required' }, 400);

		// Variabili di configurazione
		const authUrl = 'https://dev-lnkfyfu1two0vaem.us.auth0.com/oauth/token';
		const clientId = '1hirdGQO6H34hzXqPXDVLbq5d1xaU93K'; //Auth0 Management API (Test Application)
		const clientSecret = c.env.AUTH0_CLIENT_SECRET; // Variabile d'ambiente per il client secret
		const audience = 'https://dev-lnkfyfu1two0vaem.us.auth0.com/api/v2/';

		// Prima chiamata per ottenere l'access token
		const tokenParams = new URLSearchParams();
		tokenParams.append('grant_type', 'client_credentials');
		tokenParams.append('client_id', clientId);
		tokenParams.append('client_secret', clientSecret);
		tokenParams.append('audience', audience);

		const tokenResponse = await fetch(authUrl, {
			method: 'POST',
			headers: {
				'content-type': 'application/x-www-form-urlencoded',
			},
			body: tokenParams.toString(),
		});

		const tokenData = await tokenResponse.json();

		// Verifica che l'access token sia stato ottenuto
		if (!tokenData.access_token) {
			return c.json({ error: 'Failed to retrieve access token' }, 400);
		}

		// Now call the Management API to get user info
		const userResponse = await fetch(
			`https://dev-lnkfyfu1two0vaem.us.auth0.com/api/v2/users/${userId}`,
			{
				method: 'GET',
				headers: {
					Authorization: `Bearer ${tokenData.access_token}`,
					Accept: 'application/json',
				},
				redirect: 'follow',
			}
		);

		if (!userResponse.ok) {
			return c.json({ error: 'Failed to retrieve user' }, userResponse.status);
		}

		const userData = await userResponse.json();
		return c.json(userData);
	})
	.patch('/:id', async c => {
		const userId = c.req.param('id');
		if (!userId) return c.json({ error: 'UserId is required' }, 400);
		const body = await c.req.json();

		if (!body.user_metadata || !body.user_metadata.favorite_color) {
			return c.json({ error: 'Invalid user_metadata' }, 400);
		}

		// Variabili di configurazione
		const authUrl = 'https://dev-lnkfyfu1two0vaem.us.auth0.com/oauth/token';
		const clientId = '1hirdGQO6H34hzXqPXDVLbq5d1xaU93K'; //Auth0 Management API (Test Application)
		const clientSecret = c.env.AUTH0_CLIENT_SECRET; // Variabile d'ambiente per il client secret
		const audience = 'https://dev-lnkfyfu1two0vaem.us.auth0.com/api/v2/';

		// Prima chiamata per ottenere l'access token
		const tokenParams = new URLSearchParams();
		tokenParams.append('grant_type', 'client_credentials');
		tokenParams.append('client_id', clientId);
		tokenParams.append('client_secret', clientSecret);
		tokenParams.append('audience', audience);

		const tokenResponse = await fetch(authUrl, {
			method: 'POST',
			headers: {
				'content-type': 'application/x-www-form-urlencoded',
			},
			body: tokenParams.toString(),
		});

		const tokenData = await tokenResponse.json();

		if (!tokenData.access_token) {
			return c.json({ error: 'Failed to retrieve access token' }, 400);
		}

		// Now call the Management API to get user info
		const userResponse = await fetch(
			`https://dev-lnkfyfu1two0vaem.us.auth0.com/api/v2/users/${userId}`,
			{
				method: 'PATCH',
				headers: {
					'Authorization': `Bearer ${tokenData.access_token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					user_metadata: {
						favorite_color: body?.user_metadata?.favorite_color,
					},
				}),
			}
		);

		if (!userResponse.ok) {
			return c.json({ error: 'Failed to update user' }, userResponse.status);
		}

		const userData = await userResponse.json();
		return c.json(userData);
	});

export default app;
