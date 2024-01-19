import prisma from "@/lib/prisma";
import { NextResponse, type NextRequest } from "next/server";
import { isEditor } from "../tools";

export type GetContactCountResult = {
  new_messages: number;
};

export async function GET(req: NextRequest) {
  const editorStatus = await isEditor();

  if (!editorStatus) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const newMessageCount = await prisma.contactMessage.count({
    where: {
      status: {
        equals: "UNOPENED",
      },
    },
  });

  return NextResponse.json({ new_messages: newMessageCount });
}
