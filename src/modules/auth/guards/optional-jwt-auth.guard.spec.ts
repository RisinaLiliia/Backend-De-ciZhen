import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

describe('OptionalJwtAuthGuard', () => {
  const guard = new OptionalJwtAuthGuard();

  it('returns user when auth succeeds', () => {
    const user = { userId: 'u1' };
    expect(guard.handleRequest(null, user, null)).toBe(user);
  });

  it('returns null when token is missing', () => {
    expect(guard.handleRequest(null, null, { message: 'No auth token' })).toBeNull();
  });

  it('returns null when token is invalid or expired', () => {
    expect(guard.handleRequest(new Error('jwt expired'), null, { message: 'jwt expired' })).toBeNull();
  });
});
