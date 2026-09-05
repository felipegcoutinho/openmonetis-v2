import { db, people, user } from "@openmonetis/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { PeopleRepository } from "../services/people.service";

export const peopleRepository = {
  async findAdminByUserId(userId) {
    const [person] = await db
      .select()
      .from(people)
      .where(and(eq(people.userId, userId), eq(people.role, "admin")))
      .limit(1);
    return person ?? null;
  },
  async insert(data) {
    const [person] = await db.insert(people).values(data).returning();
    return person;
  },
  listByUser(userId) {
    return db.select().from(people).where(eq(people.userId, userId)).orderBy(asc(people.createdAt));
  },
  async findByIdForUser(id, userId) {
    const [person] = await db
      .select()
      .from(people)
      .where(and(eq(people.id, id), eq(people.userId, userId)))
      .limit(1);
    return person ?? null;
  },
  async updateForUser(id, userId, data) {
    return db.transaction(async (transaction) => {
      const [currentPerson] = await transaction
        .select()
        .from(people)
        .where(and(eq(people.id, id), eq(people.userId, userId)))
        .limit(1);
      if (!currentPerson) return null;

      if (currentPerson.role === "admin") {
        const authUserValues: {
          name?: string;
          email?: string;
          image?: string | null;
          updatedAt: Date;
        } = {
          updatedAt: new Date(),
        };
        if (data.name !== undefined) authUserValues.name = data.name;
        if (data.email !== undefined && data.email !== null) authUserValues.email = data.email;
        if (data.avatarUrl !== undefined) authUserValues.image = data.avatarUrl;
        await transaction.update(user).set(authUserValues).where(eq(user.id, userId));
      }

      const [person] = await transaction
        .update(people)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(people.id, id), eq(people.userId, userId)))
        .returning();
      return person;
    });
  },
  async updateAdminProviderAvatar(userId, avatarUrl) {
    const [person] = await db
      .update(people)
      .set({ providerAvatarUrl: avatarUrl, updatedAt: new Date() })
      .where(and(eq(people.userId, userId), eq(people.role, "admin")))
      .returning({ id: people.id });
    return Boolean(person);
  },
  async deleteExternalForUser(id, userId) {
    const [person] = await db
      .delete(people)
      .where(and(eq(people.id, id), eq(people.userId, userId), eq(people.role, "external")))
      .returning();
    return person ?? null;
  },
} satisfies PeopleRepository;

export const findPersonByIdForUser = (id: string, userId: string) =>
  peopleRepository.findByIdForUser(id, userId);
export const findAdminPersonByUserId = (userId: string) =>
  peopleRepository.findAdminByUserId(userId);

export function listPeopleByIdsForUser(ids: string[], userId: string) {
  if (!ids.length) return [];
  return db
    .select({ id: people.id, status: people.status })
    .from(people)
    .where(and(eq(people.userId, userId), inArray(people.id, ids)));
}
