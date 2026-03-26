import gql from 'graphql-tag';

export const typeDefs = gql`
  scalar DateTime
  scalar Upload

  enum PostPrivacy {
    public
    private
    friends
  }

  enum FriendRequestStatus {
    pending
    accepted
    rejected
  }

  type Query {
    health: Health!

    me: User
    user(id: ID!): User
    searchUsers(q: String!): [User!]!

    post(id: ID!): Post
    feedPosts: [Post!]!
    myPosts: [Post!]!
    postsByUser(userId: ID!): [Post!]!

    friendRequests: [FriendRequest!]!
    friends: [User!]!

    chats: [Chat!]!
    messages(chatId: ID!): [Message!]!
  }

  type Mutation {
    register(input: RegisterInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!

    updateDetails(input: UpdateDetailsInput!): Boolean!
    uploadAvatar(file: Upload!): User!

    createPost(input: PostInput!, imageFile: Upload): Post!
    updatePost(id: ID!, input: PostInput!, imageFile: Upload): Post!
    deletePost(id: ID!): Boolean!
    toggleLike(postId: ID!): Post!
    addComment(postId: ID!, content: String!): Post!

    sendFriendRequest(userId: ID!): FriendRequest!
    acceptFriendRequest(requestId: ID!): Boolean!
    rejectFriendRequest(requestId: ID!): Boolean!
    removeFriend(friendId: ID!): Boolean!

    createOrAccessChat(userId: ID!): Chat!
    createGroupChat(input: CreateGroupChatInput!): Chat!
    renameGroup(chatId: ID!, name: String!): Chat!
    addToGroup(chatId: ID!, userId: ID!): Chat!
    removeFromGroup(chatId: ID!, userId: ID!): Chat!

    sendMessage(chatId: ID!, content: String!): Message!
    markChatRead(chatId: ID!): Boolean!

    setTypingStatus(chatId: ID!, isTyping: Boolean!): Boolean!
    setUserStatus(status: String!): Boolean!
  }

  type Subscription {
    messageAdded(chatId: ID!): Message!
    typingStatus(chatId: ID!): TypingEvent!
    userStatusChanged: UserStatusEvent!
    friendRequestReceived(userId: ID!): FriendRequest!
    friendRequestResponded(userId: ID!): FriendRequestResponseEvent!
    postUpdated(postId: ID!): Post!
    postInteraction(userId: ID!): PostInteractionEvent!
  }

  type Health {
    status: String!
    message: String!
    apiVersion: String
    timestamp: String!
  }

  type AuthPayload {
    token: String!
  }

  input RegisterInput {
    username: String!
    email: String!
    password: String!
    firstName: String
    lastName: String
  }

  input LoginInput {
    email: String!
    password: String!
  }

  input UpdateDetailsInput {
    password: String!
    newPassword: String
    firstName: String
    lastName: String
    username: String
    email: String
    bio: String
  }

  type User {
    _id: ID!
    username: String!
    email: String!
    firstName: String
    lastName: String
    bio: String
    avatar: String
    role: String
    friends: [User!]!
    friendRequests: [FriendRequest!]!
    following: [FriendRequest!]!
    userStatus: String
    lastSeen: DateTime
  }

  type Comment {
    _id: ID
    user: User!
    content: String!
    createdAt: DateTime!
  }

  type Post {
    _id: ID!
    author: User!
    content: String!
    privacy: PostPrivacy!
    tags: [String!]!
    media: [String!]!
    likes: [User!]!
    comments: [Comment!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  input PostInput {
    content: String!
    privacy: PostPrivacy
    tags: [String!]
  }

  type FriendRequest {
    _id: ID!
    sender: User!
    recipient: User!
    status: FriendRequestStatus!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Chat {
    _id: ID!
    id: ID
    chatName: String!
    isGroupChat: Boolean!
    users: [User!]!
    latestMessage: Message
    groupAdmin: User
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Message {
    _id: ID!
    chat: Chat!
    sender: User!
    content: String!
    readBy: [User!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type TypingEvent {
    chatId: ID!
    user: User!
    isTyping: Boolean!
  }

  type UserStatusEvent {
    userId: ID!
    status: String!
    lastSeen: DateTime
  }

  type FriendRequestResponseEvent {
    status: String!
    user: User!
    requestId: ID!
  }

  type PostInteractionEvent {
    type: String!
    postId: ID!
    commentId: ID
    actorId: ID!
    actorName: String!
    post: Post!
  }

  input CreateGroupChatInput {
    name: String!
    userIds: [ID!]!
  }
`;

