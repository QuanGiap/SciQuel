/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { number, z } from "zod";
import { isEditor } from "../contact/tools";
import {
  complexMatchingSubpartSchema,
  createQuizSchema,
  directMatchingSubpartSchema,
  multipleChoiceSubpartSchema,
  quizTypeSchema,
  selectAllSubpartSchema,
  storyIdSchema,
  trueFalseSubpartSchema,
} from "./schema";

const prisma = new PrismaClient();
type createQuizType = z.infer<typeof createQuizSchema>;
interface QuizQuestionI {
  contentCategory: string;
  questionType:
    | "MULTIPLE_CHOICE"
    | "TRUE_FALSE"
    | "DIRECT_MATCHING"
    | "COMPLEX_MATCHING"
    | "SELECT_ALL";
  maxScore: number;
  subpartId: string;
}
export async function POST(req: NextRequest) {
  try {
    const editor = await isEditor();
    if (!editor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requestBody = await req.json();
    const parsed = createQuizSchema.safeParse(requestBody);

    if (!parsed.success) {
      return new NextResponse(JSON.stringify({ error: parsed.error }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
    const quizData = parsed.data;

    const CountStoryExist = await prisma.story.count({
      where: { id: quizData.story_id },
    });
    if (CountStoryExist === 0) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }
    const { subpart, errorMessage } = await createQuiz(quizData);
    if (errorMessage) {
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    const createdQuiz = await prisma.quizQuestion.create({
      data: {
        storyId: quizData.story_id,
        contentCategory: quizData.content_category,
        questionType: quizData.question_type,
        maxScore: quizData.max_score,
        subpartId: subpart.id,
        subheader: quizData.subheader,
      },
    });
    return new NextResponse(
      JSON.stringify({
        message: "Quiz question created",
        quizData: { ...createdQuiz, subpart },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error processing request:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal Server Error" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const storyId = url.searchParams.get("story_id");
    const quizType = url.searchParams.get("quiz_type");
    const quizTypeParse = quizTypeSchema.safeParse(quizType);
    const storyIdParse = storyIdSchema.safeParse(storyId);
    if (!storyId) {
      return new NextResponse(
        JSON.stringify({ error: "story_id is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    if (!quizType) {
      return new NextResponse(
        JSON.stringify({ error: "quiz_type is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    if (!storyIdParse.success) {
      return new NextResponse(
        JSON.stringify({ error: storyIdParse.error.errors[0].message }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    if (!quizTypeParse.success) {
      return new NextResponse(
        JSON.stringify({ error: quizTypeParse.error.errors[0].message }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const session = await getServerSession();
    if (!session) {
      return new NextResponse(
        JSON.stringify({ error: "Authentication is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email || "" },
    });
    if (!user) {
      return new NextResponse(JSON.stringify({ error: "user not found" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const quizzes = await prisma.quizQuestion.findMany({
      where: { storyId: storyId },
      select: {
        id: true,
        contentCategory: true,
        questionType: true,
        maxScore: true,
        subpartId: true,
      },
    });
    if (quizzes.length == 0) {
      return new NextResponse(
        JSON.stringify({ quizzes: [], quiz_record_id: "" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    //get subpart
    const subpartPromises = quizzes.map((quiz) => getSubpartPromise(quiz));
    const subparts = await Promise.all(subpartPromises);
    const quizRecord = await prisma.quizRecord.create({
      data: {
        storyId: storyIdParse.data,
        userId: user.id,
        maxScore: quizzes.reduce((sum, quiz) => sum + quiz.maxScore, 0),
        score: 0,
        quizType: quizTypeParse.data,
      },
    });
    const quizResponse = quizzes.map((quiz, index) => {
      return { ...quiz, ...subparts[index] };
    });
    return new NextResponse(
      JSON.stringify({ quizzes: quizResponse, quiz_record_id: quizRecord.id }),
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

async function createQuiz(quiz: createQuizType) {
  let errorMessage = null;
  let subpart = { id: "" };
  let error = null;
  const data = quiz.subpart;
  if (quiz.question_type === "COMPLEX_MATCHING") {
    const parsedData = complexMatchingSubpartSchema.safeParse(data);
    if (!parsedData.success) {
      errorMessage = parsedData.error.errors[0].message;
      error = parsedData.error;
    } else {
      const { categories, correct_answers, question, options, explanations } =
        parsedData.data;
      const correctAnswer = correct_answers.map((numbers) => {
        let str = "";
        numbers.forEach((number) => {
          str += number + " ";
        });
        str = str.substring(0, str.length - 1);
        return str;
      });
      subpart = await prisma.complexMatchingSubpart.create({
        data: {
          categories,
          options,
          correctAnswer,
          question,
          explanations,
        },
      });
    }
  } else if (quiz.question_type === "DIRECT_MATCHING") {
    const parsedData = directMatchingSubpartSchema.safeParse(data);
    if (!parsedData.success) {
      errorMessage = parsedData.error.errors[0].message;
      error = parsedData.error;
    } else {
      const { categories, correct_answers, question, options, explanations } =
        parsedData.data;
      const correctAnswer = correct_answers.map((number) => number.toString());
      subpart = await prisma.directMatchingSubpart.create({
        data: {
          categories,
          options,
          correctAnswer,
          question,
          explanations,
        },
      });
    }
  } else if (quiz.question_type === "MULTIPLE_CHOICE") {
    const parsedData = multipleChoiceSubpartSchema.safeParse(data);
    if (!parsedData.success) {
      errorMessage = parsedData.error.errors[0].message;
      error = parsedData.error;
    } else {
      const { question, options, correct_answer, explanations } =
        parsedData.data;
      subpart = await prisma.multipleChoiceSubpart.create({
        data: {
          options,
          correctAnswer: correct_answer,
          question,
          explanations,
        },
      });
    }
  } else if (quiz.question_type === "SELECT_ALL") {
    const parsedData = selectAllSubpartSchema.safeParse(data);
    if (!parsedData.success) {
      errorMessage = parsedData.error.errors[0].message;
      error = parsedData.error;
    } else {
      const { correct_answers, question, options, explanations } =
        parsedData.data;
      subpart = await prisma.selectAllSubpart.create({
        data: {
          options,
          correctAnswer: correct_answers,
          question,
          explanations,
        },
      });
    }
  } else if (quiz.question_type === "TRUE_FALSE") {
    const parsedData = trueFalseSubpartSchema.safeParse(data);
    if (!parsedData.success) {
      errorMessage = parsedData.error.errors[0].message;
      error = parsedData.error;
    } else {
      const { questions, correct_answers, explanations } = parsedData.data;
      subpart = await prisma.trueFalseSubpart.create({
        data: {
          correctAnswer: correct_answers,
          questions: questions,
          explanations,
        },
      });
    }
  } else {
    errorMessage = "Unknown type: " + quiz.question_type;
  }
  return { subpart, errorMessage, error };
}

function getSubpartPromise(quiz: QuizQuestionI) {
  if (quiz.questionType === "COMPLEX_MATCHING") {
    return prisma.complexMatchingSubpart.findUnique({
      where: { id: quiz.subpartId },
      select: {
        question: true,
        categories: true,
        options: true,
      },
    });
  } else if (quiz.questionType === "DIRECT_MATCHING") {
    return prisma.directMatchingSubpart.findUnique({
      where: { id: quiz.subpartId },
      select: {
        question: true,
        categories: true,
        options: true,
      },
    });
  } else if (quiz.questionType === "MULTIPLE_CHOICE") {
    return prisma.multipleChoiceSubpart.findUnique({
      where: { id: quiz.subpartId },
      select: {
        question: true,
        options: true,
      },
    });
  } else if (quiz.questionType === "SELECT_ALL") {
    return prisma.selectAllSubpart.findUnique({
      where: { id: quiz.subpartId },
      select: {
        question: true,
        options: true,
      },
    });
  } else {
    return prisma.trueFalseSubpart.findUnique({
      where: { id: quiz.subpartId },
      select: { questions: true },
    });
  }
}
