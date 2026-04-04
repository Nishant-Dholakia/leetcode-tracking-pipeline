import type { AppConfig } from "../config/env.js";
import type { AiAnalysis, NormalizedProblem, ProblemStorage } from "../types.js";
import { buildAnalysisMarkdown } from "../ai/provider.js";
import { retryOnce } from "../utils/retry.js";
import { NotionClient } from "./client.js";

function richText(text: string) {
  return chunkText(text).map((chunk) => ({
    type: "text",
    text: {
      content: chunk
    }
  }));
}

function splitIntoBlocks(text: string, chunkSize = 1800): string[] {
  const lines = text.split(/\r?\n/);
  const blocks: string[] = [];
  let current = "";

  for (const line of lines) {
    const candidate = current.length === 0 ? line : `${current}\n${line}`;
    if (candidate.length <= chunkSize) {
      current = candidate;
      continue;
    }

    if (current.length > 0) {
      blocks.push(current);
      current = "";
    }

    if (line.length <= chunkSize) {
      current = line;
      continue;
    }

    for (let index = 0; index < line.length; index += chunkSize) {
      blocks.push(line.slice(index, index + chunkSize));
    }
  }

  if (current.length > 0) {
    blocks.push(current);
  }

  return blocks.length > 0 ? blocks : [""];
}

function paragraphBlocks(text: string): unknown[] {
  return splitIntoBlocks(text).map((chunk) => ({
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: richText(chunk)
    }
  }));
}

function codeBlocks(text: string, language: string): unknown[] {
  return splitIntoBlocks(text).map((chunk) => ({
    object: "block",
    type: "code",
    code: {
      caption: [],
      rich_text: richText(chunk),
      language
    }
  }));
}
function chunkText(text: string, chunkSize = 1800): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += chunkSize) {
    chunks.push(text.slice(index, index + chunkSize));
  }
  return chunks.length > 0 ? chunks : [""];
}

function toNotionCodeLanguage(language: string): string {
  const normalized = language.trim().toLowerCase();

  const aliases: Record<string, string> = {
    "c#": "c#",
    "c++": "c++",
    cpp: "c++",
    csharp: "c#",
    golang: "go",
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    mysql: "sql",
    postgresql: "sql",
    postgres: "sql",
    sqlite: "sql",
    mariadb: "sql",
    mssql: "sql",
    "sql server": "sql",
    shell: "shell",
    sh: "shell",
    zsh: "shell",
    plaintext: "plain text",
    text: "plain text"
  };

  const supported = new Set([
    "abap",
    "abc",
    "agda",
    "arduino",
    "ascii art",
    "assembly",
    "bash",
    "basic",
    "bnf",
    "c",
    "c#",
    "c++",
    "clojure",
    "coffeescript",
    "coq",
    "css",
    "dart",
    "dhall",
    "diff",
    "docker",
    "ebnf",
    "elixir",
    "elm",
    "erlang",
    "f#",
    "flow",
    "fortran",
    "gherkin",
    "glsl",
    "go",
    "graphql",
    "groovy",
    "haskell",
    "hcl",
    "html",
    "idris",
    "java",
    "javascript",
    "json",
    "julia",
    "kotlin",
    "latex",
    "less",
    "lisp",
    "livescript",
    "llvm ir",
    "lua",
    "makefile",
    "markdown",
    "markup",
    "matlab",
    "mathematica",
    "mermaid",
    "nix",
    "notion formula",
    "objective-c",
    "ocaml",
    "pascal",
    "perl",
    "php",
    "plain text",
    "powershell",
    "prolog",
    "protobuf",
    "purescript",
    "python",
    "r",
    "racket",
    "reason",
    "ruby",
    "rust",
    "sass",
    "scala",
    "scheme",
    "scss",
    "shell",
    "smalltalk",
    "solidity",
    "sql",
    "swift",
    "toml",
    "typescript",
    "vb.net",
    "verilog",
    "vhdl",
    "visual basic",
    "webassembly",
    "xml",
    "yaml",
    "java/c/c++/c#"
  ]);

  const mapped = aliases[normalized] ?? normalized;
  return supported.has(mapped) ? mapped : "plain text";
}

export class NotionService implements ProblemStorage {
  private databaseIdPromise?: Promise<string>;

  constructor(
    private readonly config: AppConfig,
    private readonly client = new NotionClient(config)
  ) {}

  async hasProblem(titleSlug: string): Promise<boolean> {
    const databaseId = await this.ensureDatabaseId();
    const response = await this.client.queryDatabase(databaseId, {
      filter: {
        property: "Question Slug",
        rich_text: {
          equals: titleSlug
        }
      },
      page_size: 1
    });

    return response.results.length > 0;
  }

  async createProblemEntry(problem: NormalizedProblem, analysis: AiAnalysis): Promise<void> {
    const databaseId = await this.ensureDatabaseId();
    const body = {
      parent: {
        database_id: databaseId
      },
      properties: {
        Title: {
          title: richText(`#${problem.questionFrontendId} ${problem.title}`)
        },
        "Question Slug": {
          rich_text: richText(problem.titleSlug)
        },
        "Question Number": {
          number: Number(problem.questionFrontendId)
        },
        Difficulty: {
          select: {
            name: problem.difficulty
          }
        },
        "Topic Tags": {
          multi_select: problem.topicTags.map((tag) => ({ name: tag }))
        },
        "Date Solved": {
          date: {
            start: problem.solvedAt
          }
        },
        "Problem URL": {
          url: problem.problemUrl
        },
        "Revision Status": {
          select: {
            name: "New"
          }
        },
        Confidence: {
          select: {
            name: "Medium"
          }
        },
        "Mistakes / Learnings": {
          rich_text: []
        }
      },
      children: this.buildPageChildren(problem, analysis)
    };

    await retryOnce(async () => this.client.createPage(body), 5000);
  }

  private async ensureDatabaseId(): Promise<string> {
    if (!this.databaseIdPromise) {
      this.databaseIdPromise = this.resolveDatabaseId();
    }

    return this.databaseIdPromise;
  }

  private async resolveDatabaseId(): Promise<string> {
    if (this.config.NOTION_DATABASE_ID) {
      return this.config.NOTION_DATABASE_ID;
    }

    const database = await this.client.createDatabase({
      parent: {
        type: "page_id",
        page_id: this.config.NOTION_PARENT_PAGE_ID
      },
      title: richText("LeetCode Interview Prep Tracker"),
      properties: {
        Title: { title: {} },
        "Question Slug": { rich_text: {} },
        "Question Number": { number: {} },
        Difficulty: {
          select: {
            options: [{ name: "Easy" }, { name: "Medium" }, { name: "Hard" }]
          }
        },
        "Topic Tags": { multi_select: {} },
        "Date Solved": { date: {} },
        "Problem URL": { url: {} },
        "Revision Status": {
          select: {
            options: [{ name: "New" }, { name: "Reviewed" }, { name: "Needs Revision" }, { name: "Mastered" }]
          }
        },
        Confidence: {
          select: {
            options: [{ name: "Low" }, { name: "Medium" }, { name: "High" }]
          }
        },
        "Mistakes / Learnings": { rich_text: {} }
      }
    });

    return database.id;
  }

  private buildPageChildren(problem: NormalizedProblem, analysis: AiAnalysis): unknown[] {
    const aiSummary = buildAnalysisMarkdown(problem, analysis);

    return [
      this.heading("Problem URL"),
      ...paragraphBlocks(problem.problemUrl),
      this.heading("My Solution"),
      ...codeBlocks(problem.solutionCode, toNotionCodeLanguage(problem.language)),
      this.heading("AI Summary"),
      ...paragraphBlocks(aiSummary),
      this.heading("Revision Notes"),
      ...paragraphBlocks("Add your revision notes here."),
      this.heading("Mistakes / Learnings"),
      ...paragraphBlocks("Capture mistakes, patterns, and interview takeaways here.")
    ];
  }

  private heading(text: string): unknown {
    return {
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: richText(text)
      }
    };
  }

  private paragraph(text: string): unknown {
    return {
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: richText(text)
      }
    };
  }

  private code(text: string, language: string): unknown {
    return {
      object: "block",
      type: "code",
      code: {
        caption: [],
        rich_text: richText(text),
        language
      }
    };
  }
}
