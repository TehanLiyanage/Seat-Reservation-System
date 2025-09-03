import jwt from 'jsonwebtoken';

// ---------------- CREATE & SET JWT COOKIE ----------------
export function setAuthCookie(res, payload) {
  // Choose cookie name based on role
  const cookieName = payload.role === 'admin' ? 'admin_token' : 'intern_token';

  const token = jwt.sign(
    { id: payload.id, email: payload.email, role: payload.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/', 
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

// ---------------- CLEAR COOKIE ON LOGOUT ----------------
export function clearAuthCookies(res) {
  // Clear both, safer in case role is unknown
  res.clearCookie('intern_token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  });
  res.clearCookie('admin_token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  });
}

// ---------------- REQUIRE VALID JWT ----------------
export function authRequired(req, res, next) {
  // Look for either admin or intern token
  const token = req.cookies?.admin_token || req.cookies?.intern_token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // attach user info (id, email, role)
    next();
  } catch (err) {
    console.error('JWT verification failed:', err.message);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// ---------------- REQUIRE ADMIN ROLE ----------------
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}
