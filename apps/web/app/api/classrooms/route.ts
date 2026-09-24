import { z } from "zod";
import { FREE_TIER } from "@tmr/core";
import {
  bankSize,
  countClassrooms,
  createClassroom,
  createGuestUser,
  hasPaidPlan,
  listClassrooms,
  listQuizzesForUserOnDate,
} from "@tmr/db";
import { handleRouteError, jsonError, jsonOk, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { GUEST_COOKIE_NAME, getCurrentUserOrGuest } from "@/lib/session";
import { localDateFor } from "@/app/api/_lib/quiz";

const createClassroomSchema = z.object({
  name: z.string().trim().min(1).max(80),
  targetLanguage: z.string().trim().min(2).max(10),
  nativeLanguage: z.string().trim().min(2).max(10),
});

export async function GET() {
  try {
    const current = await getCurrentUserOrGuest();
    if (!current) {
      return jsonError("Unauthorized", 401);
    }
    const { user } = current;
    const db = getDb();
    const classrooms = await listClassrooms(db, user.id);
    const today = localDateFor(user.timezone);
    const todaysQuizzes = await listQuizzesForUserOnDate(db, user.id, today);
    const quizByClassroom = new Map(
      todaysQuizzes.map((row) => [row.quiz.classroomId, row.quiz.id]),
    );
    const payload = await Promise.all(
      classrooms.map(async (classroom) => ({
        id: classroom.id,
        name: classroom.name,
        targetLanguage: classroom.targetLanguage,
        nativeLanguage: classroom.nativeLanguage,
        autoStopDays: classroom.autoStopDays,
        activeUntil: classroom.activeUntil,
        pausedAt: classroom.pausedAt,
        dailyResumedAt: classroom.dailyResumedAt,
        archivedAt: classroom.archivedAt,
        isActive: classroom.pausedAt === null && classroom.activeUntil.getTime() > Date.now(),
        bankSize: await bankSize(db, classroom.id),
        todayQuizId: quizByClassroom.get(classroom.id) ?? null,
      })),
    );
    return jsonOk({ classrooms: payload });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson(request, createClassroomSchema);
    const db = getDb();
    const current = await getCurrentUserOrGuest();

    let user = current?.user;
    let isNewGuest = false;

    if (!user) {
      user = await createGuestUser(db, {
        uiLanguage: body.nativeLanguage,
        timezone: "America/Toronto",
      });
      isNewGuest = true;
    }

    const existingCount = await countClassrooms(db, user.id);
    if (user.isGuest && existingCount >= 1) {
      return jsonError("Guest preview is limited to 1 classroom. Sign up to create more.", 403);
    }
    if (
      !user.isGuest &&
      existingCount >= FREE_TIER.classrooms &&
      !(await hasPaidPlan(db, user.id))
    ) {
      return jsonError("Free plan is limited to 3 classrooms", 403);
    }

    const classroom = await createClassroom(db, user.id, {
      name: body.name,
      targetLanguage: body.targetLanguage,
      nativeLanguage: body.nativeLanguage,
      activeUntil: new Date(),
    });

    const response = jsonOk({ classroom }, 201);
    if (isNewGuest) {
      response.cookies.set(GUEST_COOKIE_NAME, user.id, {
        path: "/",
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 7,
        sameSite: "lax",
      });
    }

    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
