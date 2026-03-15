export interface JwtPayload {
  sub: string;        // user id
  email: string;
  role: string;
  orgId: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  tokenId: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token?: string;
  user: {
    id: string;
    email: string;
    role: string;
    organizationId: string;
  };
}