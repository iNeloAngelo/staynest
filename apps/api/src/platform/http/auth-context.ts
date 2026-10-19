import type { UserDto } from '@staynest/shared';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

export type AuthContext = {
  userId: string;
  sessionId: string;
  user: UserDto;
};
