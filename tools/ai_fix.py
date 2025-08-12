# tools/ai_fix.py
import json, os, subprocess, sys, textwrap, pathlib, time
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parents[1]
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
MODEL = os.environ.get("AI_FIX_MODEL", "gpt-4o-mini")
GOAL = os.environ.get("AI_FIX_GOAL") or ""
MAX_ATTEMPTS = int(os.environ.get("AI_FIX_MAX_ATTEMPTS", "5"))

if not OPENAI_API_KEY:
    print("ERROR: OPENAI_API_KEY not set.")
    sys.exit(0)  # don't hard-fail the job setup; end step with 'failure' later triggers re-run

def sh(cmd, check=True, capture=False):
    if capture:
        return subprocess.run(cmd, shell=True, check=check, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT).stdout
    return subprocess.run(cmd, shell=True, check=check)

def read(p): 
    p = ROOT / p
    return p.read_text(encoding="utf-8") if p.exists() else ""

def write(path, content):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")

def run_validator():
    # Run the sim first (so we have a fresh log)
    try:
        sh(f"python {ROOT/'test_multiball_basketball.py'}", check=True)
    except subprocess.CalledProcessError as e:
        # keep going; we still want the failure output
        pass
    # Validate and capture output
    out = ""
    try:
        out = sh(f"python {ROOT/'tools/validate_log.py'} {ROOT/'play_by_play_log.txt'}", check=False, capture=True)
    except Exception as e:
        out = f"Validator crashed: {e}"
    log = read("play_by_play_log.txt")
    return out, log

SYSTEM_MSG = """You are a software engineer tasked with fixing a basketball simulation so its play-by-play log passes a strict validator.
Return ONLY valid JSON (no prose) with this schema:
[
  {"path": "multiball_basketball.py", "content": "<FULL NEW FILE CONTENT>"},
  {"path": "test_multiball_basketball.py", "content": "<FULL NEW FILE CONTENT>"}
]
Only include files you actually changed. Keep code runnable with Python 3.11.
Make minimal, targeted fixes guided by the validator errors and the goal.
"""

def build_user_prompt(goal, validator_output, log_text, file_bundle):
    return textwrap.dedent(f"""
    GOAL:
    {goal.strip()}

    VALIDATOR OUTPUT (most recent run):
    {validator_output.strip()}

    CURRENT PLAY-BY-PLAY (tail may be enough for context):
    {log_text[-8000:]}

    REPO FILES (each starts with >>> path):
    {file_bundle}

    TASK:
    - Fix the simulation logic so the validator passes.
    - Common issues to fix: possession flip after made FG/turnover; rebound only after a missed shot (and to correct team); FT sequences (2 for 2PT shooting foul, 3 for 3PT; 1 for and-1) and possession timing; inline score updates.
    - Adjust ONLY the code files; do not change the validator.
    - Return JSON with updated file contents. No extra keys, no prose.
    """)

def gather_files():
    paths = [
        "multiball_basketball.py",
        "test_multiball_basketball.py",
        "tools/validate_log.py",
        ".ai-fix/goal.md",
        "requirements.txt",
        ".github/workflows/auto-fix-sim.yml",
    ]
    parts = []
    for p in paths:
        content = read(p)
        if content:
            parts.append(f">>> {p}\n{content}\n<<< END {p}\n")
    return "\n".join(parts)

def call_openai(system_content, user_content):
    url = "https://api.openai.com/v1/chat/completions"
    headers = {"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"}
    data = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system_content},
            {"role": "user", "content": user_content},
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"} if MODEL.startswith("gpt-4.1") else None,
    }
    resp = requests.post(url, headers=headers, json=data, timeout=120)
    resp.raise_for_status()
    text = resp.json()["choices"][0]["message"]["content"]
    return text

def apply_changes(json_text):
    try:
        arr = json.loads(json_text)
        assert isinstance(arr, list)
    except Exception as e:
        print("Model did not return valid JSON list. Aborting this attempt.")
        return False
    changed = []
    for item in arr:
        if not isinstance(item, dict): 
            continue
        path = item.get("path")
        content = item.get("content")
        if path and content is not None:
            write(path, content)
            changed.append(path)
    if not changed:
        print("No changes returned by model.")
        return False
    # commit & push
    sh('git config user.name "github-actions[bot]"')
    sh('git config user.email "github-actions[bot]@users.noreply.github.com"')
    sh("git add .")
    msg = "AI fix: apply changes to pass validator"
    sh(f'git commit -m "{msg}"', check=False)
    # push back to same branch
    sh("git push", check=False)
    print(f"Committed & pushed changes to: {', '.join(changed)}")
    return True

def main():
    # Use goal.md if GOAL env not set
    if not GOAL:
        GOAL = read(".ai-fix/goal.md")
    attempts = 0
    while attempts < MAX_ATTEMPTS:
        attempts += 1
        print(f"=== Attempt {attempts}/{MAX_ATTEMPTS} ===")
        validator_output, log_text = run_validator()
        if "VALIDATION PASSED" in validator_output:
            print("Validator already passes. Nothing to do.")
            return 0
        file_bundle = gather_files()
        prompt = build_user_prompt(GOAL, validator_output, log_text, file_bundle)
        try:
            reply = call_openai(SYSTEM_MSG, prompt)
        except Exception as e:
            print("OpenAI call failed:", e)
            return 0
        ok = apply_changes(reply)
        if not ok:
            print("No valid changes applied; stopping.")
            return 0
        # Give the workflow a chance to re-run on push; exit here
        return 0
    return 0

if __name__ == "__main__":
    sys.exit(main())
