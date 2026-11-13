import { FORK_CLI_COMMAND_NAME } from '../fork-identity'

/**
 * The one pull-request command a cloud sandbox's agent gets. The sandbox firewall passes only
 * REST calls for the sandbox's own repository, so `gh pr create`, `gh pr view` and `gh pr checks`
 * (GraphQL) are refused, and `gh auth status` calls the placeholder token invalid. Left to
 * themselves, agents then built REST calls by hand and opened pull requests with placeholder
 * titles. This command builds the allowed requests itself, so the title and body are always the
 * ones the agent was told to write. It carries only the placeholder in `GH_TOKEN`; the firewall
 * swaps in the real token.
 */
export const CLOUD_PR_COMMAND_NAME = `${FORK_CLI_COMMAND_NAME}-pr`
export const CLOUD_PR_COMMAND_PATH = `/vercel/.${FORK_CLI_COMMAND_NAME}/bin/${CLOUD_PR_COMMAND_NAME}`

/**
 * What a cloud workspace's agent is always told about pull requests. The one-click prompts carry
 * the longer note, but a request typed in chat ("open a PR") carries nothing: agents then ran
 * `gh pr create`, got a 403, and wrote the REST call by hand.
 */
export const CLOUD_PR_COMMAND_INSTRUCTION = [
  `Pull requests: to push this branch and to open or update its pull request, use only \`${CLOUD_PR_COMMAND_PATH}\`.`,
  `Write the description to a file and run \`${CLOUD_PR_COMMAND_PATH} create --title "<title>" --body-file <file>\` (add \`--draft\` for a draft, \`--base <branch>\` for another base branch): it pushes first and prints the pull request link, and when the branch already has a pull request it pushes and prints that link.`,
  `To push later commits, run \`${CLOUD_PR_COMMAND_PATH} push\`. To read the checks, run \`${CLOUD_PR_COMMAND_PATH} checks\`.`,
  '`gh pr create`, `gh pr view` and `gh pr checks` do not work here: GitHub allows this sandbox only REST calls for this repository, and `gh auth status` calls the token invalid although the command above works.',
  'Do not write the pull request call by hand with `gh api` or `curl`. If the command fails, stop and report the exact error.'
].join(' ')

/** Python 3 with the standard library only: the sandbox image has it, and nothing is installed. */
export const CLOUD_PR_COMMAND_SCRIPT = String.raw`#!/usr/bin/env python3
"""Open this branch's pull request and read its checks through GitHub's REST API.

  create --title TITLE --body-file FILE [--draft] [--base BRANCH]
      Pushes the branch, then opens the pull request and prints its link. When the branch
      already has an open pull request, pushes and prints that link.
  checks
      Prints every check of the branch's last commit; failing ones with their details.
  push
      Pushes the branch.

--print-request prints the request as JSON and sends nothing.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

NAME = os.path.basename(sys.argv[0])
API = "https://api.github.com"
FAILED = {"failure", "timed_out", "cancelled", "action_required", "startup_failure"}


def fail(message):
    sys.exit(NAME + ": " + message)


def git(*args):
    result = subprocess.run(["git", *args], capture_output=True, text=True)
    if result.returncode != 0:
        fail("git " + " ".join(args) + " failed: " + result.stderr.strip())
    return result.stdout.strip()


def repository():
    url = git("remote", "get-url", "origin")
    match = re.search(r"github\.com[:/]([^/]+)/([^/]+?)(?:\.git)?/?$", url)
    if not match:
        fail("origin is not a GitHub repository: " + url)
    return match.group(1), match.group(2)


def branch():
    name = git("rev-parse", "--abbrev-ref", "HEAD")
    if name == "HEAD":
        fail("the workspace is not on a branch")
    return name


def api_path(owner, repo, rest, query=None):
    path = "/repos/" + urllib.parse.quote(owner) + "/" + urllib.parse.quote(repo) + rest
    return path + ("?" + urllib.parse.urlencode(query) if query else "")


def create_request(owner, repo, head, base, title, body, draft):
    payload = {"title": title, "head": head, "base": base, "body": body}
    if draft:
        payload["draft"] = True
    return {"method": "POST", "url": API + api_path(owner, repo, "/pulls"), "body": payload}


def open_pulls_request(owner, repo, head):
    query = {"head": owner + ":" + head, "state": "open", "per_page": "5"}
    return {"method": "GET", "url": API + api_path(owner, repo, "/pulls", query), "body": None}


def repository_request(owner, repo):
    return {"method": "GET", "url": API + api_path(owner, repo, ""), "body": None}


def check_runs_request(owner, repo, sha):
    path = api_path(owner, repo, "/commits/" + sha + "/check-runs", {"per_page": "100"})
    return {"method": "GET", "url": API + path, "body": None}


def annotations_request(owner, repo, run_id):
    path = api_path(owner, repo, "/check-runs/" + str(run_id) + "/annotations", {"per_page": "30"})
    return {"method": "GET", "url": API + path, "body": None}


def send(request):
    data = None if request["body"] is None else json.dumps(request["body"]).encode("utf-8")
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": "token " + os.environ.get("GH_TOKEN", ""),
        "User-Agent": NAME,
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if data is not None:
        headers["Content-Type"] = "application/json"
    call = urllib.request.Request(request["url"], data=data, method=request["method"], headers=headers)
    try:
        with urllib.request.urlopen(call, timeout=60) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace")[:600]
        fail("GitHub answered " + str(error.code) + " for " + request["method"] + " " + request["url"] + ": " + detail)
    except urllib.error.URLError as error:
        fail("could not reach GitHub: " + str(error.reason))


def push(head):
    result = subprocess.run(["git", "push", "--set-upstream", "origin", head], text=True)
    if result.returncode != 0:
        fail("git push failed; the pull request was not opened")


def command_create(args):
    if not args.title.strip():
        fail("--title must not be empty")
    try:
        with open(args.body_file, encoding="utf-8") as handle:
            body = handle.read()
    except OSError as error:
        fail("could not read --body-file: " + str(error))
    owner, repo = repository()
    head = branch()
    if args.print_request:
        base = args.base or "<default branch>"
        print(json.dumps(create_request(owner, repo, head, base, args.title, body, args.draft), sort_keys=True))
        return
    push(head)
    existing = send(open_pulls_request(owner, repo, head))
    if existing:
        print(existing[0]["html_url"])
        return
    base = args.base or send(repository_request(owner, repo))["default_branch"]
    created = send(create_request(owner, repo, head, base, args.title, body, args.draft))
    print(created["html_url"])


def command_checks(args):
    owner, repo = repository()
    sha = git("rev-parse", "HEAD")
    request = check_runs_request(owner, repo, sha)
    if args.print_request:
        print(json.dumps(request, sort_keys=True))
        return
    runs = send(request).get("check_runs", [])
    if not runs:
        print("No checks have reported for " + sha[:12] + " yet.")
        return
    failed = 0
    for run in runs:
        state = run.get("conclusion") or run.get("status") or "unknown"
        print(state + "\t" + run.get("name", "") + "\t" + (run.get("html_url") or ""))
        if state not in FAILED:
            continue
        failed += 1
        output = run.get("output") or {}
        for part in (output.get("title"), output.get("summary")):
            if part:
                print("    " + part.strip().replace("\n", "\n    ")[:2000])
        for note in send(annotations_request(owner, repo, run["id"])):
            line = str(note.get("path", "")) + ":" + str(note.get("start_line", ""))
            print("    " + line + " " + str(note.get("message", "")).strip()[:500])
    if failed:
        sys.exit(1)


def command_push(args):
    head = branch()
    if args.print_request:
        print(json.dumps({"method": "git push", "url": "origin", "body": head}, sort_keys=True))
        return
    push(head)


def main():
    parser = argparse.ArgumentParser(prog=NAME, description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--print-request", action="store_true", help=argparse.SUPPRESS)
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("create")
    create.add_argument("--title", required=True)
    create.add_argument("--body-file", required=True)
    create.add_argument("--draft", action="store_true")
    create.add_argument("--base")
    create.set_defaults(run=command_create)
    commands.add_parser("checks").set_defaults(run=command_checks)
    commands.add_parser("push").set_defaults(run=command_push)
    args = parser.parse_args()
    args.run(args)


if __name__ == "__main__":
    main()
`
