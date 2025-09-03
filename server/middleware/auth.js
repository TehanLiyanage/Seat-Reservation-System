import jwt from 'jsonwebtoken';

// ---------------- CREATE & SET JWT COOKIE ----------------
export function setAuthCookie(res, payload) {
  const cookieName = payload.role === 'admin' ? 'admin_token' : 'intern_token';

  const token = jwt.sign(
    { id: payload.id, email: payload.email, role: payload.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: 'None',      // ✅ allow cross-site cookies (Vercel <-> Render)
    secure: true,          // ✅ required for HTTPS-only environments
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

// ---------------- CLEAR COOKIE ON LOGOUT ----------------
export function clearAuthCookies(res) {
  res.clearCookie('intern_token', {
    httpOnly: true,
    sameSite: 'None',   // ✅ must match setAuthCookie
    secure: true,
    path: '/'
  });
  res.clearCookie('admin_token', {
    httpOnly: true,
    sameSite: 'None',   // ✅ must match setAuthCookie
    secure: true,
    path: '/'
  });
}

// ---------------- REQUIRE VALID JWT ----------------
export function authRequired(req, res, next) {
  const token = req.cookies?.admin_token || req.cookies?.intern_token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
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
