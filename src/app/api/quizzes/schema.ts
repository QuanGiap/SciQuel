import { z } from "zod";

export const quizTypeSchema = z.enum(["POST_QUIZ", "PRE_QUIZ"]);
export const storyIdSchema = z
  .string({
    required_error: "story_id is required",
    invalid_type_error: "story_id must be a ObjectId",
  })
  .regex(/^[0-9a-f]{24}$/, { message: "story_id must be a valid ObjectId" });

export const complexMatchingSubpartSchema = z
  .object({
    question: z.string(),
    categories: z.array(z.string()),
    options: z.array(z.string()),
    correct_answers: z.array(z.array(z.number().nonnegative())),
    explanations: z.array(z.string()),
  })
  //check if all length array are equal
  .refine(
    ({ categories, correct_answers, explanations }) =>
      compareAllEqual([categories, correct_answers, explanations]),
    {
      message:
        "The length array of categories, correct_answers and explanations must be all equal",
    },
  );
export const directMatchingSubpartSchema = z
  .object({
    question: z.string(),
    categories: z.array(z.string()),
    options: z.array(z.string()),
    correct_answers: z.array(z.number().nonnegative()),
    explanations: z.array(z.string()),
  })
  //check if all length array are equal
  .refine(
    ({ categories, options, correct_answers, explanations }) =>
      compareAllEqual([categories, correct_answers, explanations, options]),
    {
      message:
        "The length array of categories, options, correct_answers and explanations must be all equal",
    },
  );

export const trueFalseSubpartSchema = z
  .object({
    questions: z.array(z.string()),
    correct_answers: z.array(z.boolean()),
    explanations: z.array(z.string()),
  })
  .refine(
    ({ questions, correct_answers, explanations }) =>
      compareAllEqual([questions, correct_answers, explanations]),
    {
      message:
        "The length array of categories, options, correct_answers and explanations must be all equal",
    },
  );

export const multipleChoiceSubpartSchema = z
  .object({
    question: z.string(),
    options: z.array(z.string()),
    correct_answer: z.number().int().nonnegative(),
    explanations: z.array(z.string()),
  })
  .refine(
    ({ options, correct_answer, explanations }) =>
      compareAllEqual([explanations, options]) &&
      correct_answer < options.length,
    {
      message:
        "The lengths array of explanations and options must be equal, and the correct_answer index number must be smaller options length",
    },
  );

export const selectAllSubpartSchema = z
  .object({
    question: z.string(),
    options: z.array(z.string()),
    correct_answer: z.array(z.number().int().nonnegative()),
    explanations: z.array(z.string()),
  })
  .refine(
    ({ options, correct_answer, explanations }) => {
      const length = options.length;
      //check if any index answear is greater than options array length
      for (let i = 0; i < correct_answer.length; i++) {
        if (correct_answer[i] >= length) return false;
      }
      return compareAllEqual([explanations, options]);
    },
    {
      message:
        "The lengths array of explanations and options must be equal, and each index number in correct_answer must be smaller options length",
    },
  );

export const createQuizSchema = z.object({
  story_id: storyIdSchema,
  content_category: z.string(),
  question_type: z.enum([
    "MULTIPLE_CHOICE",
    "TRUE_FALSE",
    "DIRECT_MATCHING",
    "COMPLEX_MATCHING",
    "SELECT_ALL",
  ]),
  max_score: z.number().int().nonnegative(),
  subpart: z.any(),
  subheader: z.string(),
});
export const getQuizzesSchema = z.object({
  storyId: z.string(),
});

//check if all array length are equals to each other
function compareAllEqual(values: any[]) {
  for (let i = 0; i < values.length - 1; i++) {
    for (let j = i + 1; j < values.length; j++) {
      const m = values[i].length;
      const n = values[j].length;
      if (m !== n) return false;
    }
  }
  return true;
}
