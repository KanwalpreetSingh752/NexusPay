import { Merchant, User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      merchant?: Merchant;
      apiKey?: {
        id: string;
        name: string;
        keyPrefix: string;
        environment: string;
      };
      rawBody?: Buffer;
    }
  }
}
