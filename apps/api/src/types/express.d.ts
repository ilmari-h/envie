declare namespace Express {
  interface Request {
    requester: Requester;
  }

  type Requester = {
    userId: string;
    username: string;
  } | {
    apiKeyId: string;
    apiKeyOwnerId: string;
  }
} 