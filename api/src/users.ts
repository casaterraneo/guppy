import { Hono } from 'hono';

const app = new Hono()
.get('/:id', async (c) => {
	const userId = c.req.param('id');
	if (!userId) return c.json({ error: 'UserId is required' }, 400);

	// Variabili di configurazione
	const authUrl = `https://${c.env.AUTH0_DOMAIN}/oauth/token`;
	const clientId = '1hirdGQO6H34hzXqPXDVLbq5d1xaU93K'; //Auth0 Management API (Test Application)
	const clientSecret = c.env.AUTH0_CLIENT_SECRET; // Variabile d'ambiente per il client secret
	const audience = `https://${c.env.AUTH0_DOMAIN}/api/v2/`;

	// Prima chiamata per ottenere l'access token
	const tokenParams = new URLSearchParams();
	tokenParams.append('grant_type', 'client_credentials');
	tokenParams.append('client_id', clientId);
	tokenParams.append('client_secret', clientSecret);
	tokenParams.append('audience', audience);

	//console.log('tokenParams :' + tokenParams.toString());

	const tokenResponse = await fetch(authUrl, {
		method: 'POST',
		headers: {
		'content-type': 'application/json',
		},
		body: tokenParams.toString(),
	});

	const tokenData = await tokenResponse.json();

	//console.log('tokenData: ' + tokenData);

	// Verifica che l'access token sia stato ottenuto
	if (!tokenData.access_token) {
		console.log('Failed to retrieve access token');
		return c.json({ error: 'Failed to retrieve access token' }, 400);
	}

	console.log('Access token ok');
	const { access_token } = tokenData.access_token;

	// Now call the Management API to get user info
	const userResponse = await fetch(`https://${c.env.AUTH0_DOMAIN}/api/v2/users/${userId}`, {
	  method: 'GET',
	  headers: {
		Authorization: `Bearer ${access_token}`,
		'Content-Type': 'application/json',
	  },
	});

	if (!userResponse.ok) {
	  console.log('Failed to retrieve user');
	  return c.json({ error: 'Failed to retrieve user' }, userResponse.status);
	}

	const userData = await userResponse.json();
	return c.json(userData);
  });

  export default app;
