import type { IUser } from '../models/user.model';

export type GraphQLContext = {
  user: IUser | null;
};

