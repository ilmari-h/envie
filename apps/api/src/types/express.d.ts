declare namespace Express {
  interface Request {
    requester: Requester;
  }

  type Requester = ({
    userId: string;
    username: string;
  } | {
    accessTokenId: string;
    accessTokenOwnerId: string;
    pubkey: Buffer<ArrayBufferLike> | null;
    pubkeyBase64: string | null;
  })
} 