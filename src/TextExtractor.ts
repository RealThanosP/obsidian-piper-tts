/**
 * TextExtractor — converts raw Obsidian Markdown to clean plain text suitable for Piper TTS.
 *
 * Pipeline order matters:
 *  1. Strip frontmatter  (must be first)
 *  2. Strip code blocks  (must be before inline-code stripping)
 *  3. Convert headings   (semantic pauses)
 *  4. Strip HTML tags
 *  5. Convert Markdown links → display text
 *  6. Convert wiki-links  → display text
 *  7. Strip formatting markers (bold, italic, etc.)
 *  8. Convert horizontal rules → pauses
 *  9. Collapse whitespace
 */
export class TextExtractor {
	extract(rawMarkdown: string): string {
		let text = rawMarkdown;
		text = this.stripFrontmatter(text);
		text = this.stripCodeBlocks(text);
		text = this.convertHeadings(text);
		text = this.stripHtml(text);
		text = this.convertLinks(text);
		text = this.convertWikiLinks(text);
		text = this.stripFormatting(text);
		text = this.convertHorizontalRules(text);
		text = this.cleanWhitespace(text);
		return text.trim();
	}

	/** Remove YAML frontmatter block (--- ... ---) */
	private stripFrontmatter(text: string): string {
		return text.replace(/^---[\s\S]*?---\n?/, '');
	}

	/** Remove fenced code blocks (``` or ~~~) entirely */
	private stripCodeBlocks(text: string): string {
		// Triple-backtick blocks (with optional language tag)
		text = text.replace(/```[\s\S]*?```/g, '');
		// Triple-tilde blocks
		text = text.replace(/~~~[\s\S]*?~~~/g, '');
		return text;
	}

	/**
	 * Convert headings to natural speech pauses:
	 *   # H1  →  "\n\nH1.\n\n"
	 *   ## H2 →  "\nH2.\n"
	 *   ### + →  "\nH3:\n"
	 */
	private convertHeadings(text: string): string {
		text = text.replace(/^# (.+)$/gm, '\n\n$1.\n\n');
		text = text.replace(/^#{2} (.+)$/gm, '\n$1.\n');
		text = text.replace(/^#{3,} (.+)$/gm, '\n$1:\n');
		return text;
	}

	/** Strip all HTML tags */
	private stripHtml(text: string): string {
		return text.replace(/<[^>]+>/g, '');
	}

	/** [display](url) → display */
	private convertLinks(text: string): string {
		return text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
	}

	/**
	 * ![[file]] → [embedded file]
	 * [[Page|Display]] → Display
	 * [[Page]] → Page
	 */
	private convertWikiLinks(text: string): string {
		text = text.replace(/!\[\[[^\]]+\]\]/g, '[embedded file]');
		text = text.replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1');
		text = text.replace(/\[\[([^\]]+)\]\]/g, '$1');
		return text;
	}

	/**
	 * Strip formatting markers:
	 *   ~~strikethrough~~ → (removed)
	 *   **bold** → bold
	 *   __bold__ → bold
	 *   *italic* → italic
	 *   _italic_ → italic
	 *   ==highlight== → highlight
	 *   `inline code` → inline code
	 *   > blockquote → blockquote (strip ">")
	 *   - [ ] task / - [x] task → task text
	 *   - list / * list / + list → text only
	 *   1. numbered list → text only
	 */
	private stripFormatting(text: string): string {
		// Strikethrough — remove entirely
		text = text.replace(/~~(.+?)~~/gs, '');
		// Bold
		text = text.replace(/\*\*(.+?)\*\*/gs, '$1');
		text = text.replace(/__(.+?)__/gs, '$1');
		// Italic
		text = text.replace(/\*(.+?)\*/gs, '$1');
		text = text.replace(/_(.+?)_/gs, '$1');
		// Highlight
		text = text.replace(/==(.+?)==/gs, '$1');
		// Inline code
		text = text.replace(/`(.+?)`/gs, '$1');
		// Blockquote prefix
		text = text.replace(/^>\s?/gm, '');
		// Obsidian tasks: "- [ ] " or "- [x] "
		text = text.replace(/^[-*+]\s\[[ xX]\]\s/gm, '');
		// Unordered list bullets
		text = text.replace(/^[-*+]\s/gm, '');
		// Ordered list numbers
		text = text.replace(/^\d+\.\s/gm, '');
		return text;
	}

	/** Replace HR (--- / *** / ___) with double newline for a TTS pause */
	private convertHorizontalRules(text: string): string {
		return text.replace(/^[-*_]{3,}$/gm, '\n\n');
	}

	/** Collapse 3+ consecutive newlines to 2, trim trailing whitespace per line */
	private cleanWhitespace(text: string): string {
		return text.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+$/gm, '');
	}
}
