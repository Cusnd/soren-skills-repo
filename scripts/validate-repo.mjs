import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const namePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const errors = [];
const warnings = [];

function readText(path) {
  return readFileSync(path, "utf8");
}

function listDirs(path) {
  if (!existsSync(path)) {
    return [];
  }

  return readdirSync(path)
    .filter((entry) => statSync(join(path, entry)).isDirectory())
    .filter((entry) => !entry.startsWith("."));
}

function isGitTracked(path) {
  const relativePath = relative(root, path).replaceAll("\\", "/");

  try {
    execFileSync("git", ["ls-files", "--error-unmatch", relativePath], {
      cwd: root,
      stdio: "ignore"
    });
    return true;
  } catch {
    return false;
  }
}

function parseFrontmatter(markdown, filePath) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);

  if (!match) {
    errors.push(`${filePath}: missing YAML frontmatter`);
    return {};
  }

  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (field) {
      fields[field[1]] = field[2].trim().replace(/^["']|["']$/g, "");
    }
  }

  const allowed = new Set(["name", "description"]);
  for (const field of Object.keys(fields)) {
    if (!allowed.has(field)) {
      errors.push(`${filePath}: unsupported frontmatter field "${field}"`);
    }
  }

  return fields;
}

function validateSkills() {
  const skillsDir = join(root, "skills");
  const skillDirs = listDirs(skillsDir);

  if (skillDirs.length === 0) {
    warnings.push("skills/: no production skills yet");
  }

  for (const dirName of skillDirs) {
    const skillDir = join(skillsDir, dirName);
    const skillPath = join(skillDir, "SKILL.md");

    if (!namePattern.test(dirName)) {
      errors.push(`skills/${dirName}: folder name must be lowercase hyphen-case`);
    }

    if (!existsSync(skillPath)) {
      errors.push(`skills/${dirName}: missing SKILL.md`);
      continue;
    }

    const markdown = readText(skillPath);
    const frontmatter = parseFrontmatter(markdown, `skills/${dirName}/SKILL.md`);

    if (frontmatter.name !== dirName) {
      errors.push(`skills/${dirName}/SKILL.md: name must match folder name`);
    }

    if (!frontmatter.description || frontmatter.description.length < 20) {
      errors.push(`skills/${dirName}/SKILL.md: description is missing or too short`);
    }

    if (/\bTODO\b|[Rr]eplace this/.test(frontmatter.description ?? "")) {
      errors.push(`skills/${dirName}/SKILL.md: description still looks like a placeholder`);
    }

    if (existsSync(join(skillDir, "README.md"))) {
      errors.push(`skills/${dirName}: keep user-facing README files outside skill folders`);
    }
  }
}

function validateMcpServers() {
  const serversDir = join(root, "mcp", "servers");
  const serverDirs = listDirs(serversDir);

  if (serverDirs.length === 0) {
    warnings.push("mcp/servers/: no production MCP servers yet");
  }

  for (const dirName of serverDirs) {
    const serverDir = join(serversDir, dirName);

    if (!namePattern.test(dirName)) {
      errors.push(`mcp/servers/${dirName}: folder name must be lowercase hyphen-case`);
    }

    if (!existsSync(join(serverDir, "README.md"))) {
      errors.push(`mcp/servers/${dirName}: missing README.md`);
    }

    const hasManifest = [
      "package.json",
      "pyproject.toml",
      "go.mod",
      "Cargo.toml",
      "pom.xml",
      "build.gradle"
    ].some((manifest) => existsSync(join(serverDir, manifest)));

    if (!hasManifest) {
      errors.push(`mcp/servers/${dirName}: missing runnable project manifest`);
    }
  }
}

function validateWorkers() {
  const workersDir = join(root, "workers");
  const workerDirs = listDirs(workersDir);

  for (const dirName of workerDirs) {
    const workerDir = join(workersDir, dirName);

    if (!namePattern.test(dirName)) {
      errors.push(`workers/${dirName}: folder name must be lowercase hyphen-case`);
    }

    if (!existsSync(join(workerDir, "README.md"))) {
      errors.push(`workers/${dirName}: missing README.md`);
    }

    if (!existsSync(join(workerDir, "package.json"))) {
      errors.push(`workers/${dirName}: missing package.json`);
    }

    if (!existsSync(join(workerDir, "src", "index.ts"))) {
      errors.push(`workers/${dirName}: missing src/index.ts`);
    }

    if (!existsSync(join(workerDir, "wrangler.example.jsonc"))) {
      errors.push(`workers/${dirName}: missing sanitized wrangler.example.jsonc`);
    }

    if (isGitTracked(join(workerDir, "wrangler.jsonc"))) {
      errors.push(`workers/${dirName}: real wrangler.jsonc must stay untracked and ignored`);
    }

    if (isGitTracked(join(workerDir, "worker-configuration.d.ts"))) {
      errors.push(`workers/${dirName}: generated worker-configuration.d.ts must stay untracked`);
    }
  }
}

validateSkills();
validateMcpServers();
validateWorkers();

for (const warning of warnings) {
  console.warn(`warning: ${warning}`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`error: ${error}`);
  }
  process.exit(1);
}

console.log("Repository structure looks good.");
