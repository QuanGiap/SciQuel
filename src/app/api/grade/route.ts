/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { PrismaClient, type Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { getSubpartQuizAnswear } from "../tools/SubpartQuiz";
import { getUserId } from "../tools/User";
import { postSchema } from "./schema";
import { grading } from "./tools";

const prisma = new PrismaClient();

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
      },
    });
    //upsert: update data if exist, create data if not exist
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
        corrections: results.map((result) => result.every((val) => val)),
      },
      update: {},
    });
    await Promise.all([
      createGradePromise,
      updatequizRecordPromise,
      userFirstAnsPromise,
    ]);
    //return result
    return new NextResponse(
      JSON.stringify({
        message: "Quiz question graded",
        score,
        maxScore: quizQuestion.maxScore,
        results: results.map((value, index) => {
          return {
            correct: value,
            explaination: quizQuestion.explanations[index],
          };
        }),
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
  const userId = req.nextUrl.searchParams.get("userId");

  if (!userId) {
    return new NextResponse(JSON.stringify({ error: "User ID is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstQuizRecord: true,
        mostRecentQuizRecord: true,
      },
    });

    if (!user) {
      return new NextResponse(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new NextResponse(
      JSON.stringify({
        firstQuizRecord: user.firstQuizRecord,
        mostRecentQuizRecord: user.mostRecentQuizRecord,
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
