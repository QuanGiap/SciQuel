import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";

export async function isEditor() {
  const session = await getServerSession();
  const user = await prisma.user.findUnique({
    where: { email: session?.user.email ?? "noemail" },
  });

  if (!user || !user.roles.includes("EDITOR")) {
    return false;
  }
  return true;
}

export async function getUserId() {
  const session = await getServerSession();
  const user = await prisma.user.findUnique({
    where: { email: session?.user.email ?? "noemail" },
  });

  if (!user) return null;
  return user.id;
}
