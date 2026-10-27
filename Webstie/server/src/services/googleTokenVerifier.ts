import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client();

export async function verifyGoogleToken(credential: string, audience: string) {
  const ticket = await client.verifyIdToken({ idToken: credential, audience });
  return ticket.getPayload();
}
