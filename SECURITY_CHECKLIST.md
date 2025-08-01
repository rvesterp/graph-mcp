# 🔒 Security Checklist for GitHub Deployment

Before pushing your Graph MCP server to GitHub, follow this checklist to ensure no sensitive information is exposed.

## ✅ Pre-Push Security Checklist

### 1. Verify .gitignore is Working
```bash
# Check if sensitive files are being tracked
git status

# Should NOT show:
# - config/config.js
# - data/ directory
# - Any .env files
# - Any .key, .pem, .crt files
```

### 2. Run Security Check Script
```bash
npm run security-check
```
This should show: "✅ No sensitive files found!"

### 3. Verify Template Configuration
- ✅ `config/config.template.js` exists and is committed
- ✅ `config/config.js` is NOT tracked by git
- ✅ Template contains placeholder values only

### 4. Check for Sensitive Data in Commits
```bash
# Search for potential secrets in git history
git log --all --full-history -- "config/config.js"
git log --all --full-history -- "data/"
```

### 5. Verify Environment Variables
- ✅ No hardcoded secrets in code
- ✅ All sensitive values use environment variables or config files
- ✅ Template files show the structure without real values

## 🚨 If You Find Sensitive Files

### Remove from Git History
```bash
# Remove file from git tracking (but keep locally)
git rm --cached config/config.js
git rm --cached -r data/

# Commit the removal
git commit -m "Remove sensitive files from tracking"

# If files were already pushed, you may need to rewrite history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch config/config.js' \
  --prune-empty --tag-name-filter cat -- --all
```

### Update .gitignore
If you find files that should be ignored, add them to `.gitignore`:
```bash
echo "filename" >> .gitignore
git add .gitignore
git commit -m "Update .gitignore"
```

## 📋 Safe Files to Commit

### ✅ Safe to Commit
- Source code (`.js` files)
- `package.json` and `package-lock.json`
- `README.md`
- `config/config.template.js`
- `.gitignore`
- Documentation files
- Test files

### ❌ Never Commit
- `config/config.js` (contains real credentials)
- `data/` directory (contains encrypted tokens)
- `.env` files
- Certificate files (`.key`, `.pem`, `.crt`)
- Authentication tokens
- Personal credentials

## 🔄 After Pushing Safely

### For New Users
1. Clone the repository
2. Copy `config/config.template.js` to `config/config.js`
3. Add their own Azure credentials
4. Run `npm install`
5. Start the server

### For You
1. Keep your local `config/config.js` with your credentials
2. The file will remain untracked due to `.gitignore`
3. Your tokens in `data/` directory will remain secure

## 🆘 Emergency Actions

If you accidentally commit sensitive data:

1. **Immediately revoke credentials** in Azure Portal
2. **Generate new credentials**
3. **Remove from git history** (see above)
4. **Force push** to overwrite the repository
5. **Notify any collaborators** about the security incident

## 📞 Security Best Practices

1. **Regular checks**: Run `npm run security-check` before each commit
2. **Environment variables**: Use environment variables for production secrets
3. **Template files**: Always provide template files for configuration
4. **Documentation**: Keep setup instructions clear and secure
5. **Monitoring**: Regularly check what's being committed

---

**Remember**: Once sensitive data is pushed to a public repository, consider it compromised. Always err on the side of caution! 