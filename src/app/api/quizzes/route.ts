/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { PrismaClient, QuestionType } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isEditor } from "../contact/tools";
import {
  complexMatchingSubpartSchema,
  directMatchingSubpartSchema,
  modifiedQuizSchema,
  multipleChoiceSubpartSchema,
  quizQuestionIdSchema,
  quizTypeSchema,
  selectAllSubpartSchema,
  storyIdSchema,
  trueFalseSubpartSchema,
} from "./schema";

const prisma = new PrismaClient();
type QuizQuestion = z.infer<typeof modifiedQuizSchema>;
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
type questinoType = QuizQuestionI["questionType"];

export async function POST(req: NextRequest) {
  try {
    const editor = await isEditor();
    if (!editor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requestBody = await req.json();
    const parsed = modifiedQuizSchema.safeParse(requestBody);

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
    const { subpartPromise, errorMessage } = modifiedQuiz({
      subpartData: quizData.subpart,
      question_type: quizData.question_type,
    });
    const subpart = await subpartPromise;
    if (errorMessage) {
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    if (!subpart) {
      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 },
      );
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
      where: { storyId: storyIdParse.data },
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
    const subpartPromises = quizzes.map((quiz) => getFindSubpartPromise(quiz));
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
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const quizQuestionId = url.searchParams.get("quiz_question_id");
    const quizQuestionIdParse = quizQuestionIdSchema.safeParse(quizQuestionId);

    if (!quizQuestionIdParse.success) {
      return new NextResponse(
        JSON.stringify({ error: quizQuestionIdParse.error.errors[0].message }),
        {
          status: 400,
        },
      );
    }

    const editor = await isEditor();
    if (!editor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const quizQuestionCheck = await prisma.quizQuestion.findUnique({
      where: { id: quizQuestionIdParse.data },
      select: { subpartId: true, questionType: true },
    });

    if (!quizQuestionCheck) {
      return new NextResponse(
        JSON.stringify({ error: "Quiz question not found" }),
        {
          status: 404,
        },
      );
    }

    const quizQuestionDeletePromise = prisma.quizQuestion.delete({
      where: { id: quizQuestionIdParse.data },
    });
    const subpartDeletePromise = getDeleteSuppartPrismaPromise({
      ...quizQuestionCheck,
    });

    await Promise.all([quizQuestionDeletePromise, subpartDeletePromise]);

    return new NextResponse(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
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

export async function PATCH(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const quizQuestionId = url.searchParams.get("quiz_question_id");
    const quizQuestionIdParse = quizQuestionIdSchema.safeParse(quizQuestionId);

    if (!quizQuestionIdParse.success) {
      return new NextResponse(
        JSON.stringify({ error: quizQuestionIdParse.error.errors[0].message }),
        {
          status: 400,
        },
      );
    }

    const editor = await isEditor();
    if (!editor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requestBody = await req.json();
    const parsed = modifiedQuizSchema.safeParse(requestBody);

    if (!parsed.success) {
      return new NextResponse(JSON.stringify({ error: parsed.error }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
    const quizData = parsed.data;

    const quizQuestionCheck = await prisma.quizQuestion.findUnique({
      where: { id: quizQuestionIdParse.data },
      select: { subpartId: true, questionType: true },
    });

    if (!quizQuestionCheck) {
      return new NextResponse(
        JSON.stringify({ error: "Quiz question not found" }),
        {
          status: 404,
        },
      );
    }

    if (quizQuestionCheck.questionType !== quizData.question_type) {
      return new NextResponse(
        JSON.stringify({ error: "Can not change type of quiz question" }),
        {
          status: 400,
        },
      );
    }

    const { errorMessage, subpartPromise } = modifiedQuiz({
      question_type: quizQuestionCheck.questionType,
      subpartId: quizQuestionCheck.subpartId,
      subpartData: quizData.subpart,
    });
    if (errorMessage) {
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    const patchQuizQuestionPromise = prisma.quizQuestion.update({
      data: {
        storyId: quizData.story_id,
        contentCategory: quizData.content_category,
        questionType: quizData.question_type,
        maxScore: quizData.max_score,
        subheader: quizData.subheader,
      },
      where: {
        id: quizQuestionIdParse.data,
      },
    });
    const [subpart, quizQuestion] = await Promise.all([
      subpartPromise,
      patchQuizQuestionPromise,
    ]);

    return new NextResponse(
      JSON.stringify({
        message: "Quiz question created",
        quizData: { ...quizQuestion, subpart },
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

function modifiedQuiz(data: {
  question_type: QuestionType;
  subpartId?: string;
  subpartData: any;
}) {
  const { question_type, subpartId = "", subpartData } = data;
  const isUpdateType = subpartId.length != 0;
  let errorMessage = null;
  let subpartPromise = null;
  let error = null;
  if (question_type === "COMPLEX_MATCHING") {
    const parsedData = complexMatchingSubpartSchema.safeParse(subpartData);
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

      if (isUpdateType) {
        subpartPromise = prisma.complexMatchingSubpart.update({
          data: {
            categories,
            options,
            correctAnswer,
            question,
            explanations,
          },
          where: {
            id: subpartId,
          },
        });
      } else {
        subpartPromise = prisma.complexMatchingSubpart.create({
          data: {
            categories,
            options,
            correctAnswer,
            question,
            explanations,
          },
        });
      }
    }
  } else if (question_type === "DIRECT_MATCHING") {
    const parsedData = directMatchingSubpartSchema.safeParse(subpartData);
    if (!parsedData.success) {
      errorMessage = parsedData.error.errors[0].message;
      error = parsedData.error;
    } else {
      const { categories, correct_answers, question, options, explanations } =
        parsedData.data;
      const correctAnswer = correct_answers.map((number) => number.toString());
      if (isUpdateType) {
        subpartPromise = prisma.directMatchingSubpart.update({
          data: {
            categories,
            options,
            correctAnswer,
            question,
            explanations,
          },
          where: {
            id: subpartId,
          },
        });
      } else {
        subpartPromise = prisma.directMatchingSubpart.create({
          data: {
            categories,
            options,
            correctAnswer,
            question,
            explanations,
          },
        });
      }
    }
  } else if (question_type === "MULTIPLE_CHOICE") {
    const parsedData = multipleChoiceSubpartSchema.safeParse(subpartData);
    if (!parsedData.success) {
      errorMessage = parsedData.error.errors[0].message;
      error = parsedData.error;
    } else {
      const { question, options, correct_answer, explanations } =
        parsedData.data;
      if (isUpdateType) {
        subpartPromise = prisma.multipleChoiceSubpart.update({
          data: {
            options,
            correctAnswer: correct_answer,
            question,
            explanations,
          },
          where: {
            id: subpartId,
          },
        });
      } else {
        subpartPromise = prisma.multipleChoiceSubpart.create({
          data: {
            options,
            correctAnswer: correct_answer,
            question,
            explanations,
          },
        });
      }
    }
  } else if (question_type === "SELECT_ALL") {
    const parsedData = selectAllSubpartSchema.safeParse(subpartData);
    if (!parsedData.success) {
      errorMessage = parsedData.error.errors[0].message;
      error = parsedData.error;
    } else {
      const { correct_answers, question, options, explanations } =
        parsedData.data;
      if (isUpdateType) {
        subpartPromise = prisma.selectAllSubpart.update({
          data: {
            options,
            correctAnswer: correct_answers,
            question,
            explanations,
          },
          where: {
            id: subpartId,
          },
        });
      } else {
        subpartPromise = prisma.selectAllSubpart.create({
          data: {
            options,
            correctAnswer: correct_answers,
            question,
            explanations,
          },
        });
      }
    }
  } else if (question_type === "TRUE_FALSE") {
    const parsedData = trueFalseSubpartSchema.safeParse(subpartData);
    if (!parsedData.success) {
      errorMessage = parsedData.error.errors[0].message;
      error = parsedData.error;
    } else {
      const { questions, correct_answers, explanations } = parsedData.data;
      if (isUpdateType) {
        subpartPromise = prisma.trueFalseSubpart.update({
          data: {
            correctAnswer: correct_answers,
            questions: questions,
            explanations,
          },
          where: {
            id: subpartId,
          },
        });
      } else {
        subpartPromise = prisma.trueFalseSubpart.create({
          data: {
            correctAnswer: correct_answers,
            questions: questions,
            explanations,
          },
        });
      }
    }
  } else {
    errorMessage = "Unknown type: " + question_type;
  }
  return { subpartPromise, errorMessage, error };
}

function getDeleteSuppartPrismaPromise({
  questionType,
  subpartId,
}: {
  questionType: questinoType;
  subpartId: string;
}) {
  if (questionType === "COMPLEX_MATCHING") {
    return prisma.complexMatchingSubpart.delete({ where: { id: subpartId } });
  } else if (questionType === "DIRECT_MATCHING") {
    return prisma.directMatchingSubpart.delete({ where: { id: subpartId } });
  } else if (questionType === "MULTIPLE_CHOICE") {
    return prisma.multipleChoiceSubpart.delete({ where: { id: subpartId } });
  } else if (questionType === "SELECT_ALL") {
    return prisma.selectAllSubpart.delete({ where: { id: subpartId } });
  } else {
    return prisma.trueFalseSubpart.delete({ where: { id: subpartId } });
  }
}

function getFindSubpartPromise(quiz: QuizQuestionI) {
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
