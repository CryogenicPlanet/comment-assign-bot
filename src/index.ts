import { Probot, Context } from "probot";
import type { WebhookEvent, EventPayloads } from "@octokit/webhooks";
import _ from "lodash";
import { discordWebhook } from "./internal";

type Assignee = { login: string };

const assignInPull = async (
  probot: Probot,
  context: WebhookEvent<EventPayloads.WebhookPayloadPullRequest> &
    Omit<Context<any>, keyof WebhookEvent<any>>
) => {
  let {
    name,
    octokit,
    payload: { action },
  } = context;
  log(probot, `responds to ${name}.${action}`);

  let issue = context.issue();

  let {
    data: { assignees, body },
  } = await octokit.pulls.get({ ...issue, pull_number: issue.issue_number });
  let newAssignees = extractAssignees(assignees ? assignees : [], body || "");

  if (newAssignees.length === 0) {
    return;
  }

  let assigneesList = newAssignees.join(", ");
  let { owner, repo, issue_number } = issue;
  log(probot, `assign [${assigneesList}] to ${owner}/${repo}#${issue_number}`);

  let params = context.issue({ assignees: newAssignees });
  await octokit.issues.addAssignees(params);
};

const assignInComment = async (
  probot: Probot,
  context: WebhookEvent<EventPayloads.WebhookPayloadIssueComment> &
    Omit<Context<any>, keyof WebhookEvent<any>>
) => {
  let {
    octokit,
    payload,
    payload: { action },
  } = context;
  log(probot, `responds to ${context.name}.${action}`);

  if (!payload.comment) {
    return;
  }

  let {
    comment: { id: commentId },
  } = payload;
  log(probot, `Comment info ${commentId}`);
  let params = context.issue({ comment_id: commentId });

  let {
    data: { body, user },
  } = await context.octokit.issues.getComment(params);
  const commentAuthor = user?.login;
  if (!commentAuthor) return;
  log(probot, `remove comment author: ${commentAuthor}`);

  let removeParams = context.issue({ assignees: [commentAuthor] });
  await octokit.issues.removeAssignees(removeParams);

  let newAssignees = extractAssignees([], body);

  if (newAssignees.length === 0) {
    log(probot, `No assignees ${body}`)
    return;
  }

  log(probot, `assign new assignees: [${newAssignees.join(", ")}]`);
  let addParams = context.issue({ assignees: newAssignees });
  await octokit.issues.addAssignees(addParams);

  const newComment = context.issue({
    body: `Assigned issue to ${newAssignees
      .map((val) => `@${val}`)
      .join(", ")}`,
  });

  const { owner } = context.issue();

  const url = (await octokit.issues.createComment({ ...newComment })).url;

  await discordWebhook(owner, newAssignees, url);
};

const log = (probot: Probot, message: string) => {
  return probot.log(`[assign-in-comment] ${message}`);
};

export = (probot: Probot) => {
  log(probot, "assign-in-comment bot is on!");
  probot.on("pull_request.opened", (context) => assignInPull(probot, context));
  probot.on("pull_request.edited", (context) => assignInPull(probot, context));
  probot.on("issue_comment.created", (context) =>
    assignInComment(probot, context)
  );
  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};

function usernameReducer(acc: string[], line: string) {
  const prefix = /^\/(assign|handover)\s+/; // /assign @user1
  const prefix2 = /^\/(a|handover)\s+/; // /a @user1

  if (!prefix.test(line) && !prefix2.test(line)) {
    return acc;
  }

  let usernames = line
    .replace(prefix, "")
    .trim()
    .split(/\s+/)
    .filter((login) => login.startsWith("@"))
    .map((username) => username.replace(/^@/, ""));

  return acc.concat(usernames);
}

const extractAssignees = (assignees: Assignee[], body = "") => {
  if (!body) {
    // body might be null
    return [];
  }

  /// check body has /a @user1 with regex
  const prefix = /\/a\s+@([^\s]+)/; // /assign @user1
  if (!prefix.test(body)) {
    return [];
  }

  let lines = body.split(/\n/).map((line) => line.trim());

  return _.chain(lines)
    .reduce(usernameReducer, [])
    .union(assignees.map((assignee) => `${assignee.login}`))
    .uniq()
    .value();
};
