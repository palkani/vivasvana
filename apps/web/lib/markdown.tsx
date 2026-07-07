import * as React from 'react';

/**
 * Tiny CommonMark-ish renderer for blog content. Trusted-input only —
 * the only people who write Markdown here are admins. Still escapes HTML
 * so accidentally pasted HTML renders as text, not markup.
 *
 * Supports: # headings 1–4, paragraphs, **bold**, *italic*, `inline code`,
 * triple-backtick code blocks, [text](url) links, ![alt](url) images,
 * unordered lists (- or *), ordered lists (1.), --- horizontal rules,
 * > blockquotes.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Inline pass: bold, italic, inline code, links, images. Runs after escape.
function renderInline(text: string): string {
  let out = escapeHtml(text);

  // images first (so ![ doesn't get caught by links)
  out = out.replace(
    /!\[([^\]]*?)\]\(([^)\s]+)\)/g,
    (_, alt, url) =>
      `<img src="${alt && url ? url : ''}" alt="${alt ?? ''}" class="my-6 rounded-lg" loading="lazy" />`,
  );
  // links
  out = out.replace(
    /\[([^\]]+?)\]\(([^)\s]+)\)/g,
    (_, label, url) =>
      `<a href="${url}" class="text-primary underline underline-offset-4" target="_blank" rel="noopener noreferrer">${label}</a>`,
  );
  // inline code
  out = out.replace(
    /`([^`]+?)`/g,
    (_, code) => `<code class="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]">${code}</code>`,
  );
  // bold
  out = out.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  // italic — single * not adjacent to space
  out = out.replace(/(^|\s)\*([^*\s][^*]*?[^*\s]|[^*\s])\*/g, '$1<em>$2</em>');

  return out;
}

interface Block {
  type: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'ul' | 'ol' | 'code' | 'hr' | 'quote';
  items?: string[];
  text?: string;
  lang?: string;
}

function parse(md: string): Block[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    if (!line.trim()) {
      i++;
      continue;
    }

    // Code fence
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith('```')) {
        buf.push(lines[i]!);
        i++;
      }
      i++; // skip closing fence
      blocks.push({ type: 'code', text: buf.join('\n'), lang });
      continue;
    }

    // Horizontal rule
    if (/^-{3,}\s*$/.test(line)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Headings
    const hMatch = /^(#{1,4})\s+(.*)$/.exec(line);
    if (hMatch) {
      const level = hMatch[1]!.length;
      blocks.push({ type: (`h${level}` as Block['type']), text: hMatch[2]!.trim() });
      i++;
      continue;
    }

    // Blockquote — accumulate consecutive > lines
    if (line.startsWith('> ')) {
      const buf: string[] = [];
      while (i < lines.length && lines[i]!.startsWith('> ')) {
        buf.push(lines[i]!.slice(2));
        i++;
      }
      blocks.push({ type: 'quote', text: buf.join('\n') });
      continue;
    }

    // Lists
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Paragraph — accumulate lines until blank/special
    const buf: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i]!.trim() &&
      !/^(#{1,4}\s|[-*]\s|\d+\.\s|>\s|```|-{3,}\s*$)/.test(lines[i]!)
    ) {
      buf.push(lines[i]!);
      i++;
    }
    blocks.push({ type: 'p', text: buf.join(' ') });
  }

  return blocks;
}

export function renderMarkdown(md: string): React.ReactElement {
  const blocks = parse(md);

  return (
    <article className="prose prose-slate max-w-none">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'h1':
            return (
              <h1
                key={idx}
                className="mt-10 font-serif text-3xl font-semibold tracking-tight"
                dangerouslySetInnerHTML={{ __html: renderInline(block.text!) }}
              />
            );
          case 'h2':
            return (
              <h2
                key={idx}
                className="mt-8 font-serif text-2xl font-semibold tracking-tight"
                dangerouslySetInnerHTML={{ __html: renderInline(block.text!) }}
              />
            );
          case 'h3':
            return (
              <h3
                key={idx}
                className="mt-6 font-serif text-xl font-semibold"
                dangerouslySetInnerHTML={{ __html: renderInline(block.text!) }}
              />
            );
          case 'h4':
            return (
              <h4
                key={idx}
                className="mt-5 font-serif text-lg font-semibold"
                dangerouslySetInnerHTML={{ __html: renderInline(block.text!) }}
              />
            );
          case 'p':
            return (
              <p
                key={idx}
                className="mt-4 leading-relaxed text-foreground/90"
                dangerouslySetInnerHTML={{ __html: renderInline(block.text!) }}
              />
            );
          case 'ul':
            return (
              <ul key={idx} className="mt-4 list-disc space-y-1.5 pl-6 text-foreground/90">
                {block.items!.map((item, j) => (
                  <li key={j} dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={idx} className="mt-4 list-decimal space-y-1.5 pl-6 text-foreground/90">
                {block.items!.map((item, j) => (
                  <li key={j} dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
                ))}
              </ol>
            );
          case 'code':
            return (
              <pre
                key={idx}
                className="mt-4 overflow-x-auto rounded-md bg-muted p-4 font-mono text-xs"
              >
                <code>{block.text}</code>
              </pre>
            );
          case 'quote':
            return (
              <blockquote
                key={idx}
                className="mt-4 border-l-4 border-brand-400 bg-brand-50/40 px-4 py-2 italic text-foreground/80"
                dangerouslySetInnerHTML={{ __html: renderInline(block.text!) }}
              />
            );
          case 'hr':
            return <hr key={idx} className="my-8" />;
          default:
            return null;
        }
      })}
    </article>
  );
}
