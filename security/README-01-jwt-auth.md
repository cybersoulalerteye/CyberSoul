# JWT authentication

This package provides RS256 access tokens, opaque rotating refresh tokens, FastAPI routes, and a JWKS endpoint. All implementation and tests are kept in `security/`.

## Host application integration

1. Install `security/requirements.txt`.
2. Store a JSON secret in AWS Secrets Manager with a `kid` and a PEM-encoded RSA `private_key`:

   ```json
   {"kid": "auth-2026-01", "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"}
   ```

   The private key must exist only in Secrets Manager and process memory. Provide the secret identifier and AWS region through deployment configuration; do not put key contents in configuration or source control. The AWS SDK uses its normal credential chain.
3. Construct `JwtService.from_aws_secrets_manager(...)` during application startup with the expected issuer and audience. Attach `create_auth_router(jwt_service, auth_store)` and `create_jwks_router(jwt_service)` to the FastAPI app.
4. Implement `AuthStore` in the host application. `authenticate` verifies the password hash and rejects inactive users. `get_active_user` reads the current active status and role for the user/tenant from the database. Refresh persistence stores only the SHA-256 hash of the high-entropy opaque token. `rotate_refresh_token` must atomically consume a valid old hash and store its replacement, honoring expiration and revocation.
5. Protect application routes with `Depends(create_current_user_dependency(jwt_service, auth_store))`. The dependency verifies RS256, issuer, audience, and expiration, then reloads the current user from the store on every request. The role claim is not used for authorization; use the returned database-backed identity.

The login route is `POST /api/v1/auth/login`; refresh is `POST /api/v1/auth/refresh`; JWKS is `GET /.well-known/jwks.json`. Login returns a 15-minute access token and a seven-day refresh token. Refresh rotates the refresh token and returns a new pair.
