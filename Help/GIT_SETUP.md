# Git Setup Commands for OptiWMS

## Step 1: Initialize Git Repository
```bash
cd /Users/k.e.oshada/Documents/OptiWMS
git init
```

## Step 2: Add All Files (respecting .gitignore)
```bash
git add .
```

## Step 3: Verify What Will Be Committed
```bash
git status
```

## Step 4: Make Initial Commit
```bash
git commit -m "Initial commit: OptiWMS - Warehouse Management System"
```

## Step 5: Create GitHub Repository
1. Go to https://github.com/new
2. Create a new repository (e.g., `OptiWMS`)
3. **DO NOT** initialize with README, .gitignore, or license (we already have these)
4. Copy the repository URL (e.g., `https://github.com/yourusername/OptiWMS.git`)

## Step 6: Add Remote and Push
```bash
# Replace YOUR_USERNAME and REPO_NAME with your actual GitHub username and repository name
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
git branch -M main
git push -u origin main
```

## Complete Command Sequence (Copy & Paste)
```bash
cd /Users/k.e.oshada/Documents/OptiWMS
git init
git add .
git status
git commit -m "Initial commit: OptiWMS - Warehouse Management System"
# After creating GitHub repo, run:
# git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
# git branch -M main
# git push -u origin main
```

## Notes
- The `.gitignore` file will automatically exclude:
  - Warehouse/Carpet/Store folders
  - Resources folder contents (but keeps the folder via .gitkeep)
  - node_modules, build files, and other standard ignores
- The Resources folder will appear empty in the repository (only .gitkeep file)
- All other project files will be committed normally

