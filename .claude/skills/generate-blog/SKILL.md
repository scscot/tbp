---
name: generate-blog
description: Generate AI-powered blog posts for Team Build Pro in 4 languages (EN, ES, PT, DE). Use when user wants to create a new blog post, research blog topics, or run the full blog automation workflow.
argument-hint: "[title] or --research or --full-auto"
allowed-tools: Bash(node *), Bash(cd *), Read, Glob, Grep
disable-model-invocation: true
---

# Blog Generation Skill

Generate SEO-optimized blog posts for Team Build Pro using AI. Posts are created in 4 languages (English, Spanish, Portuguese, German) and published to all website variants.

## Available Modes

### 1. Research Mode
Analyze trends and recommend blog topics based on MLM/direct sales industry developments.

```bash
cd /Users/sscott/tbp && ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" node scripts/generate-ai-blog.js --research
```

### 2. Generate with Specific Title
Create a blog post with a specific title. The system generates content in all 4 languages.

```bash
cd /Users/sscott/tbp && ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" node scripts/generate-ai-blog.js --generate "$ARGUMENTS"
```

### 3. Full Auto Mode
Research topics, select the best one, generate the post, deploy to Firebase, and send notification email.

```bash
cd /Users/sscott/tbp && ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" node scripts/generate-ai-blog.js --full-auto --notify-email=scscot@gmail.com
```

## Workflow Steps

When generating a blog post:

1. **Topic Selection**: Either use provided title or research trending topics
2. **Content Generation**: Create 1500-2000 word article with:
   - SEO-optimized title and meta description
   - Engaging introduction hook
   - 4-6 main sections with actionable advice
   - Team Build Pro integration (subtle, not promotional)
   - Clear CTA at the end
3. **Translation**: Generate localized versions for ES, PT, DE
4. **File Creation**: Create HTML files in web/blog/, web-es/blog/, web-pt/blog/, web-de/blog/
5. **Index Update**: Add post to blog index pages
6. **Sitemap Update**: Update sitemap.xml files with new URLs

## Terminology Balance

Blog titles and content should rotate between these terms for SEO diversity:
- "MLM" (Multi-Level Marketing)
- "Direct Sales"
- "Network Marketing"

Check existing posts to maintain balance. Script tracks terminology usage automatically.

## Quality Validation

The script automatically validates content for:
- Fabricated features (E2E encryption, biometric, etc.)
- Incorrect statistics (must match CLAUDE.md facts)
- Proper app store URLs and links
- SEO best practices (title length, meta description)

## Example Usage

```
/generate-blog "How AI is Transforming Direct Sales Recruiting in 2026"
/generate-blog --research
/generate-blog --full-auto
```

## Related Files

- Script: `scripts/generate-ai-blog.js`
- Facts source: `TEAM_BUILD_PRO_KNOWLEDGE.md`
- Blog directories: `web/blog/`, `web-es/blog/`, `web-pt/blog/`, `web-de/blog/`
- Workflow: `.github/workflows/weekly-blog.yml` (Mon/Thu 10am PST)
