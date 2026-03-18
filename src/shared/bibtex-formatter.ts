import type { Paper } from './types'

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'for',
  'and', 'or', 'but', 'is', 'are', 'was', 'were', 'with',
  'from', 'by', 'via', 'its', 'this', 'that',
])

const CONFERENCE_PATTERN =
  /\b(conference|proceedings|workshop|symposium|cvpr|iccv|eccv|neurips|nips|icml|iclr|acl|emnlp|naacl|coling|aaai|ijcai|kdd|sigkdd|www|sigir|icse|fse|usenix|sosp|osdi|vldb|sigmod|icra|iros|rss)\b/i

function getEntryType(paper: Paper): string {
  // Preprint: arXiv ID but no DOI → @misc
  if (paper.arxivId && !paper.doi) return 'misc'
  // Venue looks like a conference → @inproceedings
  if (paper.venue && CONFERENCE_PATTERN.test(paper.venue)) return 'inproceedings'
  return 'article'
}

function titleWord(title: string): string {
  const words = title.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/)
  return words.find(w => w.length > 2 && !STOP_WORDS.has(w)) ?? ''
}

function escapeTeX(str: string): string {
  if (!str) return ''
  return str
    .replace(/\\/g, '\\textbackslash ')
    .replace(/[{}&%$#_^~]/g, c => `\\${c}`)
}

export function formatBibtex(
  paper: Paper,
  existingKeys?: Set<string>
): { bibtex: string; citeKey: string } {
  const lastName = paper.authors?.[0]
    ? paper.authors[0].split(/\s+/).pop()!.toLowerCase().replace(/[^a-z]/g, '')
    : 'unknown'
  const yearPart = paper.year ?? 'nd'
  const titlePart = titleWord(paper.title)
  const base = `${lastName}${yearPart}${titlePart}`

  let citeKey = base
  if (existingKeys) {
    // Use letter suffixes (a, b, c…) for collisions, matching BibTeX convention
    const alphabet = 'abcdefghijklmnopqrstuvwxyz'
    let i = 0
    while (existingKeys.has(citeKey)) {
      citeKey = `${base}${alphabet[i % 26]}`
      i++
    }
  }

  const entryType = getEntryType(paper)
  const authors = (paper.authors ?? []).map(escapeTeX).join(' and ')

  const fields: string[] = []
  // Double-brace title to preserve capitalisation across citation styles
  fields.push(`  title = {{${escapeTeX(paper.title)}}}`)
  if (authors) fields.push(`  author = {${authors}}`)
  if (paper.year) fields.push(`  year = {${paper.year}}`)

  if (entryType === 'inproceedings' && paper.venue) {
    fields.push(`  booktitle = {${escapeTeX(paper.venue)}}`)
  } else if (entryType === 'article' && paper.venue) {
    fields.push(`  journal = {${escapeTeX(paper.venue)}}`)
  } else if (entryType === 'misc' && paper.arxivId) {
    fields.push(`  howpublished = {arXiv preprint arXiv:${paper.arxivId}}`)
  }

  if (paper.doi) fields.push(`  doi = {${paper.doi}}`)
  if (paper.arxivId) {
    fields.push(`  eprint = {${paper.arxivId}}`)
    fields.push(`  archivePrefix = {arXiv}`)
  }
  // Only include URL if it's a real external link (not an OpenAlex internal ID)
  if (paper.url && /^https?:\/\//.test(paper.url) && !paper.url.includes('openalex.org')) {
    fields.push(`  url = {${paper.url}}`)
  }

  const bibtex = `@${entryType}{${citeKey},\n${fields.join(',\n')}\n}`
  return { bibtex, citeKey }
}
