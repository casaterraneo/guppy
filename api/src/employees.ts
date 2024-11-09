import { Hono } from 'hono';

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

const app = new Hono()
	.get('/', checkPermission('read:employees'), async c => {
		const db = c.get('db');
		const resp = await db.prepare(`SELECT * FROM [Employee]`).all();
		return c.json(resp.results);
	});


export default app;
