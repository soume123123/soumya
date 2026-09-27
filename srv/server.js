const cds = require('@sap/cds');
const { SELECT, UPDATE } = cds.ql;

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

  const getUser = req => {
    const username = readCookie(req.headers.cookie, 'itc-dev-user');
    return username && users[username] ? { username, ...users[username] } : null;
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
    const user = getUser(req);
    if (!user) return res.json({ signedIn: false });
    res.json({ signedIn: true, username: user.username, roles: user.roles, vendorId: user.vendorId, panNumber: user.panNumber });
  });
  app.get('/auth/profile', async (req, res) => {
    const user = getUser(req);
    if (!user) return res.status(401).json({ message: 'Not signed in' });
    let profile = {};
    if (user.vendorId) {
      const db = cds.db || await cds.connect.to('db');
      profile = await db.run(SELECT.one.from('itc.vendor.portal.Vendors').where({ ID: user.vendorId })) || {};
    }
    res.json({ username: user.username, roles: user.roles, vendorId: user.vendorId, panNumber: user.panNumber, email: profile.email || '', phone: profile.phone || '', address: profile.address || '', contactPerson: profile.contactPerson || '' });
  });
  app.post('/auth/profile', async (req, res) => {
    const user = getUser(req);
    if (!user) return res.status(401).json({ message: 'Not signed in' });
    if (!user.vendorId) return res.status(400).json({ message: 'This account has no vendor profile' });
    const fields = ['email', 'phone', 'address', 'contactPerson'];
    const changes = Object.fromEntries(fields.filter(field => typeof req.body?.[field] === 'string').map(field => [field, req.body[field].trim()]));
    const db = cds.db || await cds.connect.to('db');
    await db.run(UPDATE('itc.vendor.portal.Vendors').set(changes).where({ ID: user.vendorId }));
    res.json({ saved: true, ...changes });
  });
  app.post('/auth/password', (req, res) => {
    const user = getUser(req);
    if (!user) return res.status(401).json({ message: 'Not signed in' });
    const { currentPassword, newPassword, confirmPassword } = req.body || {};
    if (currentPassword !== user.password) return res.status(401).json({ message: 'Current password is incorrect' });
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' });
    if (newPassword !== confirmPassword) return res.status(400).json({ message: 'New passwords do not match' });
    users[user.username].password = newPassword;
    res.json({ saved: true });
  });

  app.use((req, res, next) => {
    if (req.headers.authorization || !req.path.startsWith('/api/')) return next();

    const user = getUser(req);
    if (user) req.headers.authorization = `Basic ${Buffer.from(`${user.username}:${user.password}`).toString('base64')}`;
    next();
  });
});

module.exports = cds.server;
