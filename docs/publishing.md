# Publishing

## Prepare

Run validation:

```bash
npm run validate
```

Review the repository for secrets:

```bash
git status --short
git diff --staged
```

## Create A Public GitHub Repository

Choose the owner and repository name first. A good default is:

```bash
gh repo create soren-skills-repo --public --source . --remote origin --push
```

If the remote already exists:

```bash
git remote add origin https://github.com/<owner>/<repo>.git
git push -u origin main
```

## After Publishing

- Add repository topics such as `codex-skills`, `mcp`, `model-context-protocol`, and `agents`.
- Check that the license is correct for your intended reuse model.
- Enable branch protection if other people will contribute.
- Keep examples free of credentials and personal data.
