export const isUserRequester = (requester: Express.Requester): requester is { userId: string, username: string } => {
  return 'userId' in requester;
};