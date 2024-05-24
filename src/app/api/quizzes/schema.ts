import { z } from "zod";

export const quizTypeSchema = z.enum(["POST_QUIZ", "PRE_QUIZ"], {
  required_error: "quiz_type is required in url url query parameters",
  invalid_type_error:
    "Invalid quiz_type.  Valid quiz_type: POST_QUIZ | PRE_QUIZ",
});
export const storyIdSchema = z
  .string({
    required_error: "story_id is required",
    invalid_type_error: "story_id must be a ObjectId",
  })
  .regex(/^[0-9a-f]{24}$/, { message: "story_id must be a valid ObjectId" });
export const quizQuestionIdSchema = z
  .string({
    required_error: "quiz_question_id is required in url query parameters",
    invalid_type_error: "quiz_question_id must be a ObjectId",
  })
  .regex(/^[0-9a-f]{24}$/, {
    message: "quiz_question_id must be a valid ObjectId",
  });

export const complexMatchingSubpartSchema = z
  .object({
    question: z.string({
      required_error: "question is required",
      invalid_type_error: "question must be a string",
    }),
    categories: z.array(
      z.string({ invalid_type_error: "value in categories must be a string" }),
      {
        required_error: "categories is required",
        invalid_type_error: "categories must be a string array",
      },
    ),
    options: z.array(
      z.string({ invalid_type_error: "value in options must be a string" }),
      {
        required_error: "options is required",
        invalid_type_error: "options must be a string array",
      },
    ),
    correct_answers: z.array(
      z.array(
        z
          .number({
            invalid_type_error:
              "value in correct_answers must be a nonnegative integer",
          })
          .nonnegative(),

        {
          invalid_type_error:
            "value is correct_answers array must be a nonnegative integer 1D array",
        },
      ),
      {
        required_error: "correct_answers is required",
        invalid_type_error:
          "correct_answers must be a nonnegative integer 2D array",
      },
    ),
    explanations: z.array(
      z.string({
        invalid_type_error: "value in explanations must be a string",
      }),
      {
        required_error: "explanations is required",
        invalid_type_error: "explanations must be a string array",
      },
    ),
  })
  //check if all length array are equal
  .refine(
    ({ categories, correct_answers, explanations }) =>
      compareAllEqual([categories, correct_answers, explanations]),
    {
      message:
        "The length array of categories, correct_answers and explanations must be all equal",
    },
  )
  //check if there is duplicate index answer
  .refine(({ correct_answers }) => !isDuplicate(correct_answers), {
    message: "There must be no duplicate index in correct_answers",
  })
  //check if index answer is out of bound
  .refine(
    ({ correct_answers, options }) => !isOutOfBound(correct_answers, options),
    {
      message:
        "index in correct_answers array must be smaller than options length",
    },
  );
export const directMatchingSubpartSchema = z
  .object({
    question: z.string({
      required_error: "question is required",
      invalid_type_error: "question must be a string",
    }),
    categories: z.array(
      z.string({ invalid_type_error: "value in categories must be a string" }),
      {
        required_error: "categories is required",
        invalid_type_error: "categories must be a string array",
      },
    ),
    options: z.array(
      z.string({ invalid_type_error: "value in options must be a string" }),
      {
        required_error: "options is required",
        invalid_type_error: "options must be a string array",
      },
    ),
    correct_answers: z.array(
      z
        .number({
          invalid_type_error:
            "value in correct_answer must be a nonnegative int number",
        })
        .int()
        .nonnegative(),
      {
        required_error: "correct_answers is required",
        invalid_type_error:
          "correct_answers must be a nonnegative integer array",
      },
    ),
    explanations: z.array(
      z.string({
        invalid_type_error: "value in explanations must be a string",
      }),
      {
        required_error: "explanations is required",
        invalid_type_error: "explanations must be a string array",
      },
    ),
  })
  //check if all length array are equal
  .refine(
    ({ categories, options, correct_answers, explanations }) =>
      compareAllEqual([categories, correct_answers, explanations, options]),
    {
      message:
        "The length array of categories, options, correct_answers and explanations must be all equal",
    },
  )
  //check if there is duplicate index answer
  .refine(({ correct_answers }) => !isDuplicate(correct_answers), {
    message: "There must be no duplicate index in correct_answers",
  })
  //check if index answer is out of bound
  .refine(
    ({ correct_answers, options }) => !isOutOfBound(correct_answers, options),
    {
      message:
        "index in correct_answers array must be smaller than options length",
    },
  );

export const trueFalseSubpartSchema = z
  .object({
    questions: z.array(
      z.string({
        invalid_type_error: "value in questions must be a string",
      }),
      {
        required_error: "questions is required",
        invalid_type_error: "questions must be a string array",
      },
    ),
    correct_answers: z.array(
      z.boolean({
        invalid_type_error: "value in correct_answers must be a boolean",
      }),
      {
        required_error: "correct_answers is required",
        invalid_type_error: "explanations must be a boolean array",
      },
    ),
    explanations: z.array(
      z.string({
        invalid_type_error: "value in explanations must be a string",
      }),
      {
        required_error: "explanations is required",
        invalid_type_error: "explanations must be a string array",
      },
    ),
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
    question: z.string({
      required_error: "question is required",
      invalid_type_error: "question must be a string",
    }),
    options: z.array(
      z.string({ invalid_type_error: "value in options must be a string" }),
      {
        required_error: "options is required",
        invalid_type_error: "options must be a string array",
      },
    ),
    correct_answer: z
      .number({
        invalid_type_error:
          "value in correct_answer must be a nonnegative int number",
      })
      .int()
      .nonnegative(),
    explanations: z.array(
      z.string({
        invalid_type_error: "value in explanations must be a string",
      }),
      {
        required_error: "explanations is required",
        invalid_type_error: "explanations must be a string array",
      },
    ),
  })
  .refine(
    ({ options, correct_answer, explanations }) =>
      compareAllEqual([explanations, options]) &&
      correct_answer < options.length,
    {
      message: "The lengths array of explanations and options must be equal",
    },
  )
  .refine(
    ({ correct_answer, options }) => !isOutOfBound([correct_answer], options),
    {
      message: "the correct_answer index number must be smaller options length",
    },
  );

export const selectAllSubpartSchema = z
  .object({
    question: z.string({
      required_error: "question is required",
      invalid_type_error: "question must be a string",
    }),
    options: z.array(
      z.string({ invalid_type_error: "value in options must be a string" }),
      {
        required_error: "options is required",
        invalid_type_error: "options must be a string array",
      },
    ),
    correct_answers: z.array(
      z
        .number({
          invalid_type_error:
            "value in correct_answer must be a nonnegative int number",
        })
        .int()
        .nonnegative(),
      {
        required_error: "correct_answers is required",
        invalid_type_error:
          "correct_answers must be a nonnegative integer array",
      },
    ),
    explanations: z.array(
      z.string({
        invalid_type_error: "value in explanations must be a string",
      }),
      {
        required_error: "explanations is required",
        invalid_type_error: "explanations must be a string array",
      },
    ),
  })
  //check if all array equal
  .refine(
    ({ options, explanations }) => compareAllEqual([explanations, options]),
    {
      message: "The lengths array of explanations and options must be equal",
    },
  )
  //check if index answer is out of bound
  .refine(
    ({ options, correct_answers }) => !isOutOfBound(correct_answers, options),
    {
      message:
        "index in correct_answers array must be smaller than options length",
    },
  );
export const modifiedQuizSchema = z.object({
  story_id: storyIdSchema,
  content_category: z.string({
    required_error: "content_category is required",
    invalid_type_error: "content_category must be a string",
  }),
  question_type: z.enum(
    [
      "MULTIPLE_CHOICE",
      "TRUE_FALSE",
      "DIRECT_MATCHING",
      "COMPLEX_MATCHING",
      "SELECT_ALL",
    ],
    {
      invalid_type_error:
        "Invalid question_type.  Valid question_type: MULTIPLE_CHOICE | TRUE_FALSE | DIRECT_MATCHING | COMPLEX_MATCHING | SELECT_ALL",
    },
  ),
  max_score: z
    .number({
      required_error: "max_score is required",
      invalid_type_error: "max_score must be a nonnegative int number",
    })
    .int()
    .nonnegative(),
  subpart: z.any(),
  subheader: z.string({
    required_error: "subheader is required",
    invalid_type_error: "subheader must be a string",
  }),
});
export const getQuizzesSchema = z.object({
  storyId: z
    .string({
      required_error: "story_id is required",
      invalid_type_error: "story_id must be a ObjectId",
    })
    .regex(/^[0-9a-f]{24}$/, { message: "story_id must be a valid ObjectId" }),
});

//check if all array length are equals to each other
function compareAllEqual(values: any[][]) {
  const len = values.length;
  if (len === 0) return true;
  for (let i = 1; i < values.length; i++) {
    const m = values[0].length;
    const n = values[i].length;
    if (m !== n) return false;
  }
  return true;
}
//check if there is duplicate number in array
function isDuplicate(arr: number[] | number[][]) {
  if (arr.length === 0) return false;
  const set: { [key: number]: number } = {};
  //check if arr is 2d array
  if (Array.isArray(arr[0])) {
    //confirm arr is 1d array
    arr = arr as number[][];
    for (let i = 0; i < arr.length; i++) {
      for (let j = 0; j < arr[i].length; j++) {
        const num = arr[i][j];
        if (set[num]) return true;
      }
    }
  } else {
    //confirm arr is 1d array
    arr = arr as number[];
    for (let i = 0; i < arr.length; i++) {
      const num = arr[i];
      if (set[num]) return true;
    }
  }
  return false;
}
//check if answer index is out of bound
function isOutOfBound(answears: number[] | number[][], options: string[]) {
  //check if answears is 2d array
  if (Array.isArray(answears[0])) {
    //confirm answears is 2d array
    answears = answears as number[][];
    for (let i = 0; i < answears.length; i++) {
      for (let j = 0; j < answears[i].length; j++) {
        const num = answears[i][j];
        if (num >= options.length) return true;
      }
    }
  } else {
    //confirm answears is 1d array
    answears = answears as number[];
    for (let i = 0; i < answears.length; i++) {
      const num = answears[i];
      if (num >= options.length) return true;
    }
  }
  return false;
}
