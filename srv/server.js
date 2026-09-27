const cds = require('@sap/cds');

cds.on('bootstrap', (app) => {
  if (process.env.NODE_ENV === 'production') return;

  const users = {
    vendor1: { password: 'vendor1', roles: ['vendor'], vendorId: 'v001', panNumber: 'ABCDE1234F' },
    vendor2: { password: 'vendor2', roles: ['vendor'], vendorId: 'v002', panNumber: 'FGHIJ5678K' },
    admin1: { password: 'admin1', roles: ['admin', 'approver', 'finance', 'treasury', 'vendor'], vendorId: 'v001', panNumber: 'ABCDE1234F' },
    Admin1: { password: 'admin1', roles: ['admin', 'approver', 'finance', 'treasury'] }
  };

  const readCookie = (header, name) => {
    const value = (header || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`));
    return value ? decodeURIComponent(value.slice(name.length + 1)) : null;
  };

  app.use(require('express').json());
  app.post('/auth/login', (req, res) => {
    const user = users[req.body?.username];
    if (!user || user.password !== req.body?.password) return res.status(401).json({ message: 'Invalid username or password' });
    res.setHeader('Set-Cookie', `itc-dev-user=${encodeURIComponent(req.body.username)}; Path=/; SameSite=Lax`);
    res.json({ signedIn: true, username: req.body.username, roles: user.roles });
  });
  app.post('/auth/logout', (req, res) => {
    res.setHeader('Set-Cookie', 'itc-dev-user=; Path=/; Max-Age=0; SameSite=Lax');
    res.status(204).end();
  });
  app.get('/auth/session', (req, res) => {
    const username = readCookie(req.headers.cookie, 'itc-dev-user');
    const user = users[username];
    if (!user) return res.json({ signedIn: false });
    res.json({ signedIn: true, username, roles: user.roles, vendorId: user.vendorId, panNumber: user.panNumber });
  });

  app.use((req, res, next) => {
    if (req.headers.authorization || !req.path.startsWith('/api/')) return next();

    const username = readCookie(req.headers.cookie, 'itc-dev-user');
    const user = users[username];
    if (user) req.headers.authorization = `Basic ${Buffer.from(`${username}:${user.password}`).toString('base64')}`;
    next();
  });
});

module.exports = cds.server;
