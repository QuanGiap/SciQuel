import prisma from "@/lib/prisma";
import { type User as UserType } from "@prisma/client";
import { getServerSession, Session } from "next-auth";

export default class User {
  session: Session | null;
  user: UserType | null;
  constructor() {
    this.session = null;
    this.user = null;
  }

  async _getUserInfo() {
    this.session = await getServerSession();
    this.user = await prisma.user.findUnique({
      where: { email: this.session?.user.email ?? "noemail" },
    });
  }

  async getSession() {
    if (!this.session) {
      await this._getUserInfo();
    }
    return this.session || null;
  }

  async isEditor() {
    if (!this.session) {
      await this._getUserInfo();
    }

    if (!this.user || !this.user.roles.includes("EDITOR")) {
      return false;
    }
    return true;
  }

  async getUserId() {
    if (!this.session) {
      await this._getUserInfo();
    }

    return this.user?.id || null;
  }

  async getUser() {
    if (!this.session) {
      await this._getUserInfo();
    }
    return this.user;
  }
}
