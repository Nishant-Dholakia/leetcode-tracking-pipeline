export const RECENT_SUBMISSIONS_QUERY = `
  query recentAcSubmissions($username: String!) {
    recentAcSubmissionList(username: $username) {
      id
      title
      titleSlug
      timestamp
      statusDisplay
      lang
    }
  }
`;

export const QUESTION_DETAILS_QUERY = `
  query questionDetails($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      questionFrontendId
      title
      titleSlug
      content
      difficulty
      topicTags {
        name
      }
    }
  }
`;

export const SUBMISSION_DETAILS_QUERY = `
  query submissionDetails($submissionId: Int!) {
    submissionDetails(submissionId: $submissionId) {
      code
      lang {
        name
        verboseName
      }
      question {
        questionFrontendId
        title
        titleSlug
      }
    }
  }
`;
