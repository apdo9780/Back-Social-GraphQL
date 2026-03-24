import { Request, Response } from 'express';
import { FriendRequest } from '../models/friend-request.model';
import { User } from '../models/user.model';
import { io } from 'socket.io-client';
import { getSocketInstance } from '../services/socket-context';
import { log } from 'node:console';

interface IRequest extends Request {
    user?: any;
}

// @desc    Send friend request
// @route   POST /api/v1/friends/request/:userId
// @access  Private
export const sendFriendRequest = async (req: IRequest, res: Response,): Promise<any> => {
    try {
        const recipientId: any = req.params.userId;
        const senderId = req.user._id;

        // Check if users exist
        const [sender, recipient] = await Promise.all([
            User.findById(senderId),
            User.findById(recipientId)
        ]);

        if (!recipient || !sender) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Check if request already exists
        const existingRequest = await FriendRequest.findOne({
            $or: [
                { sender: senderId, recipient: recipientId },
                { sender: recipientId, recipient: senderId }
            ]
        });

        if (existingRequest) {
            return res.status(400).json({
                success: false,
                error: 'Friend request already exists'
            });
        }

        // Check if users are already friends
        if (sender.friends.includes(recipientId)) {
            return res.status(400).json({
                success: false,
                error: 'Users are already friends'
            });
        }

        // Create friend request
        const friendRequest:any = await FriendRequest.create({
            sender: senderId,
            recipient: recipientId
        });

        // Add request to recipient's friendRequests
        sender.following.push(friendRequest._id);
        await sender.save();
        recipient.friendRequests.push(friendRequest._id);
        await recipient.save();
const socketService = getSocketInstance();


const recId = friendRequest.recipient.toString(); // اللي جاله الطلب
const senId = friendRequest.sender.toString(); // اللي بعت الطلب

socketService.emitToUser(recId, 'new_friend_request', {
    sender: {
        _id: senId,
        
    },
    timestamp: new Date()
});

        res.status(201).json({
            success: true,
            data: friendRequest
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// @desc    Accept friend request
// @route   PUT /api/v1/friends/accept/:requestId
// @access  Private
export const acceptFriendRequest = async (req: IRequest, res: Response): Promise<any> => {
    try {
        const requestId = req.params.requestId;
        const userId = req.user._id;

        const friendRequest = await FriendRequest.findById(requestId);

        if (!friendRequest) {
            return res.status(404).json({
                success: false,
                error: 'Friend request not found'
            });
        }

        // Check if user is the recipient
        if (friendRequest.recipient.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to accept this request'
            });
        }


        if (friendRequest.status == 'accepted') {
            return res.status(404).json({
                success: false,
                error: 'Already accepted '
            });
        }
 
        if (friendRequest.status == 'rejected') {
            return res.status(404).json({
                success: false,
                error: 'Already rejected '
            });
        }
        // Update request status
        // friendRequest.status = 'accepted';
        // await friendRequest.save();
        await friendRequest.deleteOne();


        // Add users to each other's friends lists
        const [sender, recipient]:any = await Promise.all([
            User.findById(friendRequest.sender),
            User.findById(friendRequest.recipient)
        ]);

        if (!sender || !recipient) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        sender.friends.push(recipient._id);
        recipient.friends.push(sender._id);

        // Remove request from recipient's friendRequests
        recipient.friendRequests = recipient.friendRequests.filter(
            (req: any) => req.toString() !== requestId.toString()
        );
        sender.following = sender.following.filter(
            (req: any) => req.toString() !== requestId.toString()
        );

        await Promise.all([sender.save(), recipient.save()]);

        res.status(200).json({
            success: true,
            data: friendRequest
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// @desc    Reject friend request
// @route   PUT /api/v1/friends/reject/:requestId
// @access  Private
export const rejectFriendRequest = async (req: IRequest, res: Response): Promise<any> => {
    try {
        const requestId = req.params.requestId;
        const userId = req.user._id;

        const friendRequest = await FriendRequest.findById(requestId);

        if (!friendRequest) {
            return res.status(404).json({
                success: false,
                error: 'Friend request not found'
            });
        }

        // Check if user is the recipient
        if (friendRequest.recipient.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to reject this request'
            });
        }
        if (friendRequest.status == 'accepted') {
            return res.status(404).json({
                success: false,
                error: 'Already accepted '
            });
        }

        if (friendRequest.status == 'rejected') {
            return res.status(404).json({
                success: false,
                error: 'Already rejected '
            });
        }
        // Update request status
        // friendRequest.status = 'rejected';
        // await friendRequest.save();
        await friendRequest.deleteOne();

        // Remove request from recipient's friendRequests
        const recipient = await User.findById(userId);
        const sender = await User.findById(friendRequest.sender);
        if (recipient && sender) {
            recipient.friendRequests = recipient.friendRequests.filter(
                req => req.toString() !== requestId.toString()
            );
             sender.following = sender.following.filter(
            (req: any) => req.toString() !== requestId.toString()
        );
            await recipient.save();
            await sender.save();
        }

        res.status(200).json({
            success: true,
            data: friendRequest
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// @desc    Get all friend requests
// @route   GET /api/v1/friends/requests
// @access  Private
export const getFriendRequests = async (req: IRequest, res: Response) => {
    try {
        const requests = await FriendRequest.find({
            recipient: req.user._id,
            status: 'pending'
        }).populate('sender', '-_id username email firstName lastName avatar');

        res.status(200).json({
            success: true,
            data: requests
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// @desc    Get all friends
// @route   GET /api/v1/friends
// @access  Private
export const getFriends = async (req: IRequest, res: Response) => {
    try {
        const user = await User.findById(req.user._id)
            .populate('friends', 'username avatar email');

        res.status(200).json({
            success: true,
            data: user?.friends || []
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// @desc    Remove friend
// @route   DELETE /api/v1/friends/:friendId
// @access  Private
export const removeFriend = async (req: IRequest, res: Response): Promise<any> => {
    try {
        const friendId = req.params.friendId;
        const userId = req.user._id;

        const [user, friend] = await Promise.all([
            User.findById(userId),
            User.findById(friendId)
        ]);

        if (!user || !friend) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Remove from each other's friends lists
        user.friends = user.friends.filter(id => id.toString() !== friendId.toString());
        friend.friends = friend.friends.filter(id => id.toString() !== userId.toString());

        await Promise.all([user.save(), friend.save()]);

        res.status(200).json({
            success: true,
            message: 'Friend removed successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};
