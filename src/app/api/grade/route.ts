/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { PrismaClient, QuizType } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { getSubpartQuizAnswear } from "../tools/SubpartQuiz";
import { getUserId } from "../tools/User";
import { postSchema, storyIdSchema } from "./schema";
import { grading } from "./tools";

const ROUND_UP_DECIMAL = 2;
const prisma = new PrismaClient();
interface quizRecordI {
  grades: {
    userResponse: {
      id: string;
    };
    maxScore: number;
    totalScore: number;
  }[];
  createAt: Date;
  storyId: string;
  quizType: QuizType;
  maxScore: number;
  score: number;
}
export async function POST(req: NextRequest) {
  try {
    const bodyParamParse = postSchema.safeParse(await req.json());
    if (!bodyParamParse.success) {
      return new NextResponse(
        JSON.stringify({ error: bodyParamParse.error.errors[0].message }),
        {
          status: 400,
        },
      );
    }
    const bodyParam = bodyParamParse.data;
    //get quiz record
    const quizRecordPromise = prisma.quizRecord.findUnique({
      where: { id: bodyParam.quiz_record_id },
      select: {
        quizQuestionIdRemain: true,
        storyId: true,
        totalCorrectAnswer: true,
      },
    });
    const userIdPromise = getUserId();
    const quizQuestionPromise = getSubpartQuizAnswear(
      bodyParam.quiz_question_id,
    );
    const [quizQuestion, quizRecord, userId] = await Promise.all([
      quizQuestionPromise,
      quizRecordPromise,
      userIdPromise,
    ]);
    if (!userId) {
      return new NextResponse(
        JSON.stringify({ error: "Authentication is required" }),
        {
          status: 400,
        },
      );
    }
    if (!quizRecord) {
      return new NextResponse(
        JSON.stringify({ error: "Quiz Record not found" }),
        {
          status: 404,
        },
      );
    }
    if (!quizQuestion) {
      return new NextResponse(
        JSON.stringify({ error: "Quiz Question not found" }),
        {
          status: 404,
        },
      );
    }

    //check quiz question id in quiz record
    const indexFound = quizRecord.quizQuestionIdRemain.indexOf(
      quizQuestion.quizQuestionId,
    );
    if (indexFound === -1) {
      return new NextResponse(
        JSON.stringify({ error: "This Quiz Question is already graded" }),
        {
          status: 403,
        },
      );
    }

    //start grading
    const { errorMessage, errors, results, score, userResponse } = grading({
      ...quizQuestion,
      userAnswer: bodyParam.answer,
    });
    if (errorMessage) {
      return new NextResponse(JSON.stringify({ error: errorMessage, errors }), {
        status: 400,
      });
    }

    //store value to put in database
    const isCorrect = results.every((result) => result.every((val) => val));
    const isLastQuestion = quizRecord.quizQuestionIdRemain.length === 1;
    //create user response
    const userRes = await prisma.userResponse.create({
      data: {
        userId,
        userAns: userResponse,
        quizQuestionId: quizQuestion.quizQuestionId,
        questionType: quizQuestion.questionType,
      },
    });

    //create grade
    const createGradePromise = prisma.grade.create({
      data: {
        userId,
        userResponseId: userRes.id,
        quizQuestionId: quizQuestion.quizQuestionId,
        totalScore: score,
        maxScore: quizQuestion.maxScore,
        quizRecordId: bodyParam.quiz_record_id,
      },
    });

    //remove graded quizQuestionId from quizQuestionIdRemain
    const updatequizRecordPromise = prisma.quizRecord.update({
      where: { id: bodyParam.quiz_record_id },
      data: {
        quizQuestionIdRemain: quizRecord.quizQuestionIdRemain.filter(
          (str) => str != quizQuestion.quizQuestionId,
        ),
        totalCorrectAnswer: { increment: isCorrect ? 1 : 0 },
      },
    });

    //upsert: update data if exist, create data if not exist
    //record user answer if this is their first attempt,
    const userFirstAnsPromise = prisma.questionAnswerFirstTime.upsert({
      where: {
        userId_quizQuestionId: {
          userId,
          quizQuestionId: quizQuestion.quizQuestionId,
        },
      },
      create: {
        userId,
        quizQuestionId: quizQuestion.quizQuestionId,
        isCorrect,
      },
      update: {},
    });

    //record user score of quiz story if this is their first attempt,
    let userFirstScorePromise = new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve("foo");
      }, 100);
    });
    if (isLastQuestion) {
      userFirstScorePromise = prisma.storyQuizScoreFirstTime.upsert({
        where: {
          userId_storyId: {
            userId,
            storyId: quizRecord.storyId,
          },
        },
        create: {
          userId,
          storyId: quizRecord.storyId,
          totalCorrectAnswer:
            quizRecord.totalCorrectAnswer + (isCorrect ? 1 : 0),
        },
        update: {},
      });
    }
    await Promise.all([
      createGradePromise,
      updatequizRecordPromise,
      userFirstAnsPromise,
      userFirstScorePromise,
    ]);
    //count how many people answer correct question
    const countPeopleAnswerCorrectPromise =
      prisma.questionAnswerFirstTime.count({
        where: { quizQuestionId: quizQuestion.quizQuestionId, isCorrect: true },
      });
    const countPeopleAnswerPromise = prisma.questionAnswerFirstTime.count({
      where: { quizQuestionId: quizQuestion.quizQuestionId },
    });
    const [countPeopleAnswerCorrect, countPeopleAnswer] = await Promise.all([
      countPeopleAnswerCorrectPromise,
      countPeopleAnswerPromise,
    ]);
    const percentage = (countPeopleAnswerCorrect / countPeopleAnswer) * 100;

    //return result
    return new NextResponse(
      JSON.stringify({
        message: "Quiz question graded",
        score,
        max_score: quizQuestion.maxScore,
        results: results.map((value, index) => {
          return {
            correct: value,
            explaination: quizQuestion.explanations[index],
          };
        }),
        percent_people_answer_correct: percentage.toFixed(ROUND_UP_DECIMAL),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error processing request:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal Server Error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export async function GET(req: NextRequest) {
  const userId = await getUserId();

  if (!userId) {
    return new NextResponse(JSON.stringify({ error: "User ID is required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { searchParams } = new URL(req.url);

  //get story_id and check type if exist
  const storyId = searchParams.get("story_id");
  let storyIdParse = null;
  if (storyId) {
    storyIdParse = storyIdSchema.safeParse(storyId);
    if (!storyIdParse.success) {
      return new NextResponse(
        JSON.stringify({ error: storyIdParse.error.errors[0].message }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  const quizRecordArg = {
    where: {
      userId: userId,
      storyId: storyIdParse ? storyIdParse.data : undefined,
    },
    select: {
      storyId: true,
      quizType: true,
      maxScore: true,
      score: true,
      createAt: true,
      grades: {
        select: {
          userResponse: {
            select: {
              id: true,
            },
          },
          totalScore: true,
          maxScore: true,
        },
      },
    },
  };
  try {
    const firstQuizRecordPromise = await prisma.quizRecord.findFirst({
      ...quizRecordArg,
      orderBy: {
        createAt: "asc",
      },
    });
    const mostRecentQuizRecordPromise = await prisma.quizRecord.findFirst({
      ...quizRecordArg,
      orderBy: {
        createAt: "desc",
      },
    });
    return new NextResponse(
      JSON.stringify({
        first_quiz_record: createResponseQuizRecord(firstQuizRecordPromise),
        most_recent_quiz: createResponseQuizRecord(mostRecentQuizRecordPromise),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error processing request:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal Server Error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
function createResponseQuizRecord(quizRecord: quizRecordI | null) {
  if (!quizRecord) return null;
  const { grades, createAt, storyId, score, maxScore, quizType } = quizRecord;
  return {
    story_id: storyId,
    score,
    max_score: maxScore,
    quiz_type: quizType,
    create_at: createAt,
    grades: grades.map((grade) => {
      const { userResponse, maxScore, totalScore } = grade;
      return {
        user_response_id: userResponse.id,
        total_score: totalScore,
        max_score: maxScore,
      };
    }),
  };
}
