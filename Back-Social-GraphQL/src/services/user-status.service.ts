import { User } from '../models/user.model';
import { pubsub, TOPICS } from '../subscriptions/pubsub';

export const updateUserStatus = async (userId: string, status: 'online' | 'offline') => {
  const isOnline = status === 'online';
  const lastSeen = isOnline ? null : new Date();

  await User.updateOne({ _id: userId }, { userStatus: status, lastSeen }).exec();

  await pubsub.publish(TOPICS.USER_STATUS_CHANGED, {
    userStatusChanged: { userId, status, lastSeen }
  });
};