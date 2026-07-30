import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { User } from '../../models/User.js';
import { sendPasswordResetEmail, sendTwoFactorEmail } from '../../services/mail.service.js';

const refreshTokensStore = new Map();

const publicUser = (user) => user.toJSON();

const generateTokens = (user) => {
  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar
  };
  const accessToken = jwt.sign(payload, config.jwtAccessSecret, {
    expiresIn: config.jwtAccessExpiresIn
  });
  const refreshToken = jwt.sign({ id: user.id }, config.jwtRefreshSecret, {
    expiresIn: config.jwtRefreshExpiresIn
  });
  const tokens = refreshTokensStore.get(user.id) || new Set();
  tokens.add(refreshToken);
  refreshTokensStore.set(user.id, tokens);
  return { accessToken, refreshToken };
};

export const register = async (req, res) => {
  try {
    const { name, email, password, department, role } = req.body;
    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must contain at least 8 characters.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
    }

    const cleanName = name.trim();
    const user = await User.create({
      id: `usr-${crypto.randomUUID()}`,
      name: cleanName,
      email: normalizedEmail,
      passwordHash: await User.hashPassword(password),
      role: role || 'Procurement Head',
      department: department || 'Procurement',
      avatar: cleanName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
    });
    const tokens = generateTokens(user);
    return res.status(201).json({ success: true, ...tokens, user: publicUser(user) });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password, twoFactorCode } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() })
      .select('+passwordHash +twoFactorCodeHash +twoFactorCodeExpiresAt');
    if (!user || !(await user.verifyPassword(password))) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }
    if (user.status !== 'Active') {
      return res.status(403).json({ success: false, error: 'This account is not active.' });
    }

    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        const code = String(crypto.randomInt(100000, 1000000));
        user.twoFactorCodeHash = crypto.createHash('sha256').update(code).digest('hex');
        user.twoFactorCodeExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();
        await sendTwoFactorEmail({ to: user.email, name: user.name, code });
        return res.status(202).json({
          success: true,
          requiresTwoFactor: true,
          email: user.email,
          message: 'A sign-in code was sent to your email.'
        });
      }
      const codeHash = crypto.createHash('sha256').update(String(twoFactorCode)).digest('hex');
      if (codeHash !== user.twoFactorCodeHash || !user.twoFactorCodeExpiresAt || user.twoFactorCodeExpiresAt <= new Date()) {
        return res.status(401).json({ success: false, error: 'The sign-in code is invalid or expired.' });
      }
      user.twoFactorCodeHash = undefined;
      user.twoFactorCodeExpiresAt = undefined;
      await user.save();
    }

    const tokens = generateTokens(user);
    return res.json({ success: true, ...tokens, user: publicUser(user) });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const refreshTokenController = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ success: false, error: 'Refresh token required.' });

    const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret);
    const tokens = refreshTokensStore.get(decoded.id);
    if (!tokens?.has(refreshToken)) {
      return res.status(403).json({ success: false, error: 'Refresh token is invalid or revoked.' });
    }

    const user = await User.findOne({ id: decoded.id });
    if (!user || user.status !== 'Active') {
      return res.status(403).json({ success: false, error: 'User is unavailable.' });
    }

    tokens.delete(refreshToken);
    const newTokens = generateTokens(user);
    return res.json({ success: true, ...newTokens, user: publicUser(user) });
  } catch {
    return res.status(403).json({ success: false, error: 'Refresh token is invalid or expired.' });
  }
};

export const revokeAllSessionsController = (req, res) => {
  refreshTokensStore.delete(req.user.id);
  return res.json({ success: true, message: 'All active sessions were revoked.' });
};

export const forgotPassword = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const user = email ? await User.findOne({ email }).select('+passwordResetCodeHash +passwordResetExpiresAt') : null;
    if (user) {
      const otpCode = String(crypto.randomInt(100000, 1000000));
      user.passwordResetCodeHash = crypto.createHash('sha256').update(otpCode).digest('hex');
      user.passwordResetExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();
      await sendPasswordResetEmail({ to: user.email, name: user.name, code: otpCode });
      if (config.environment !== 'production') {
        return res.json({ success: true, message: 'Reset code generated for development.', otpCode });
      }
    }
    return res.json({ success: true, message: 'If that account exists, reset instructions were generated.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const updateTwoFactor = async (req, res) => {
  const { enabled, currentPassword } = req.body;
  if (typeof enabled !== 'boolean' || !currentPassword) {
    return res.status(400).json({ success: false, error: 'Enabled state and current password are required.' });
  }
  const user = await User.findOne({ id: req.user.id }).select('+passwordHash');
  if (!user || !(await user.verifyPassword(currentPassword))) {
    return res.status(400).json({ success: false, error: 'Current password is incorrect.' });
  }
  user.twoFactorEnabled = enabled;
  await user.save();
  return res.json({
    success: true,
    message: enabled ? 'Email two-factor authentication enabled.' : 'Two-factor authentication disabled.',
    user: publicUser(user)
  });
};

export const resetPassword = async (req, res) => {
  try {
    const { email, otpCode, newPassword } = req.body;
    if (!email || !otpCode || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'Valid email, reset code, and an 8-character password are required.' });
    }
    const codeHash = crypto.createHash('sha256').update(String(otpCode)).digest('hex');
    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      passwordResetCodeHash: codeHash,
      passwordResetExpiresAt: { $gt: new Date() }
    }).select('+passwordHash +passwordResetCodeHash +passwordResetExpiresAt');
    if (!user) return res.status(400).json({ success: false, error: 'Reset code is invalid or expired.' });

    user.passwordHash = await User.hashPassword(newPassword);
    user.passwordResetCodeHash = undefined;
    user.passwordResetExpiresAt = undefined;
    await user.save();
    refreshTokensStore.delete(user.id);
    return res.json({ success: true, message: 'Password reset successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getMe = async (req, res) => {
  const user = await User.findOne({ id: req.user.id });
  if (!user) return res.status(404).json({ success: false, error: 'User not found.' });
  return res.json({ success: true, user });
};

export const updateMe = async (req, res) => {
  const allowed = ['name', 'email', 'department'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  if (updates.email) updates.email = updates.email.trim().toLowerCase();
  if (updates.name) {
    updates.name = updates.name.trim();
    updates.avatar = updates.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  }
  const user = await User.findOneAndUpdate({ id: req.user.id }, updates, {
    new: true,
    runValidators: true
  });
  if (!user) return res.status(404).json({ success: false, error: 'User not found.' });
  return res.json({ success: true, message: 'Profile updated.', user });
};

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ success: false, error: 'Current password and an 8-character new password are required.' });
  }
  const user = await User.findOne({ id: req.user.id }).select('+passwordHash');
  if (!user || !(await user.verifyPassword(currentPassword))) {
    return res.status(400).json({ success: false, error: 'Current password is incorrect.' });
  }
  user.passwordHash = await User.hashPassword(newPassword);
  await user.save();
  refreshTokensStore.delete(user.id);
  return res.json({ success: true, message: 'Password updated. Other sessions were signed out.' });
};

export const logout = (req, res) => {
  const tokens = refreshTokensStore.get(req.user.id);
  if (req.body.refreshToken && tokens) tokens.delete(req.body.refreshToken);
  return res.json({ success: true, message: 'Signed out successfully.' });
};
