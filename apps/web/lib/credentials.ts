import { verify } from "@node-rs/argon2";
import { getUserByEmail, type User } from "@tmr/db";
import { getDb } from "./db";

export async function verifyCredentials(email: string, password: string): Promise<User | null> {
  const user = await getUserByEmail(getDb(), email);
  if (!user?.passwordHash) {
    return null;
  }
  const valid = await verify(user.passwordHash, password).catch(() => false);
  if (!valid) {
    return null;
  }
  return user;
}
