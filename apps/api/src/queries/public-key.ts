import { isUserRequester } from "../types/cast"
import { getAccessTokenByNameOrId, getUserByNameOrId } from "./user"

export async function getRequesterPublicKey(pubkeyBase64: string, requester: Express.Requester) {
  if(isUserRequester(requester)) {
    const user = await getUserByNameOrId(requester.userId)
    if(!user) {
      return null
    }

  return user.userPublicKeys.find(pk => pk.publicKey.id === pubkeyBase64)?.publicKey ?? null
  } else {
    const accessToken = await getAccessTokenByNameOrId(requester.accessTokenId)
    if(!accessToken || accessToken.publicKey.id !== pubkeyBase64) {
      return null
    }
    return accessToken.publicKey
  }

}