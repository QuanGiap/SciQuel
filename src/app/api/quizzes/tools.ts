import prisma from "@/lib/prisma";
import { QuestionType } from "@prisma/client";
import { getServerSession } from "next-auth";
import { z } from "zod";
import {
  complexMatchingSubpartSchema,
  directMatchingSubpartSchema,
  modifiedQuizSchema,
  multipleChoiceSubpartSchema,
  selectAllSubpartSchema,
  trueFalseSubpartSchema,
} from "./schema";

type modifiedQuizType = z.infer<typeof modifiedQuizSchema>;
type questinoType = modifiedQuizType["question_type"];

interface QuizQuestionI {
  contentCategory: string;
  questionType: questinoType;
  maxScore: number;
  subpartId: string;
}

export function modifiedQuiz(data: {
  question_type: QuestionType;
  subpartId?: string;
  subpartData: any;
}) {
  const { question_type, subpartId = "", subpartData } = data;
  const isUpdateType = subpartId.length != 0;
  let errorMessage = null;
  let subpartPromise = null;
  let errors: string[] = [];
  if (question_type === "COMPLEX_MATCHING") {
    const parsedData = complexMatchingSubpartSchema.safeParse(subpartData);
    if (!parsedData.success) {
      errorMessage = parsedData.error.errors[0].message;
      errors = parsedData.error.errors.map((value) => value.message);
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
      errors = parsedData.error.errors.map((value) => value.message);
    } else {
      const { categories, correct_answers, question, options, explanations } =
        parsedData.data;
      if (isUpdateType) {
        subpartPromise = prisma.directMatchingSubpart.update({
          data: {
            categories,
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
        subpartPromise = prisma.directMatchingSubpart.create({
          data: {
            categories,
            options,
            correctAnswer: correct_answers,
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
      errors = parsedData.error.errors.map((value) => value.message);
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
      errors = parsedData.error.errors.map((value) => value.message);
    } else {
      const { correct_answers, question, options, explanations } =
        parsedData.data;
      let correctAnswer: boolean[] = [];
      for (let i = 0; i < options.length; i++) {
        correctAnswer.push(false);
      }
      correct_answers.forEach((val) => {
        correctAnswer[val] = true;
      });
      if (isUpdateType) {
        subpartPromise = prisma.selectAllSubpart.update({
          data: {
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
        subpartPromise = prisma.selectAllSubpart.create({
          data: {
            options,
            correctAnswer,
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
      errors = parsedData.error.errors.map((value) => value.message);
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
    throw new Error(
      "Unknown type: " + question_type + " in modifiedQuiz function",
    );
  }
  return { subpartPromise, errorMessage, errors };
}

export function getDeleteSuppart({
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
  } else if (questionType === "TRUE_FALSE") {
    return prisma.trueFalseSubpart.delete({ where: { id: subpartId } });
  } else {
    throw new Error(
      "Unknow type " + questionType + " in getting delete Subpart promise",
    );
  }
}

export function getSubpart(quiz: QuizQuestionI) {
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
  } else if (quiz.questionType === "TRUE_FALSE") {
    return prisma.trueFalseSubpart.findUnique({
      where: { id: quiz.subpartId },
      select: { questions: true },
    });
  } else {
    throw new Error(
      "Unknow type " + quiz.questionType + " in finding Subpart promise",
    );
  }
}
