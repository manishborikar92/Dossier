import React from 'react';
import { Document, Font, Link, Page, Text, View, renderToBuffer } from '@react-pdf/renderer';
import type { ResumeDoc, SectionDoc, EntryBlock, ContactPart } from '@/lib/resumeDoc';
import { DENSITY_SCALE, TEMPLATES } from '@/lib/templates';
import { toWinAnsi } from '@/lib/text';

// Never insert hyphens when wrapping: it would corrupt the text that ATS parsers read.
Font.registerHyphenationCallback((word) => [word]);

const GRAY = '#444444';
const SEPARATOR = '\u00a0\u00a0\u00b7\u00a0\u00a0';

/** Number of pages in a PDF produced by this renderer. */
export function countPdfPages(buffer: Uint8Array): number {
  const text = Buffer.from(buffer).toString('latin1');
  return (text.match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length;
}

export async function renderResumePdf(doc: ResumeDoc): Promise<{ buffer: Buffer; pages: number }> {
  const element = <ResumePdf doc={doc} />;
  const buffer = await renderToBuffer(element);
  return { buffer, pages: countPdfPages(buffer) };
}

function ResumePdf({ doc }: { doc: ResumeDoc }) {
  const t = TEMPLATES[doc.template];
  const scale = DENSITY_SCALE[doc.settings.density];
  const accent = doc.settings.accent;
  const bold = t.font === 'Helvetica' ? 'Helvetica-Bold' : 'Times-Bold';
  const italic = t.font === 'Helvetica' ? 'Helvetica-Oblique' : 'Times-Italic';
  const s = toWinAnsi;

  const body = { fontFamily: t.font, fontSize: t.base, color: '#000000', lineHeight: 1.28 } as const;
  const small = t.base - 0.5;

  const contact = (parts: ContactPart[]) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: t.headerAlign === 'center' ? 'center' : 'flex-start', marginTop: 3 }}>
      {parts.map((p, i) => (
        <Text key={i} style={{ ...body, fontSize: t.base - 1, color: GRAY }}>
          {p.url ? (
            <Link src={p.url} style={{ color: GRAY, textDecoration: 'none' }}>
              {s(p.text)}
            </Link>
          ) : (
            s(p.text)
          )}
          {i < parts.length - 1 ? SEPARATOR : ''}
        </Text>
      ))}
    </View>
  );

  const bullet = (key: number, children: React.ReactNode) => (
    <View key={key} wrap={false} style={{ flexDirection: 'row', marginTop: t.bulletGap * scale }}>
      <Text style={{ ...body, width: 27, paddingLeft: 13.5 }}>{'\u2022'}</Text>
      <Text style={{ ...body, flex: 1 }}>{children}</Text>
    </View>
  );

  const heading = (title: string) => (
    <View
      style={{
        marginTop: t.sectionGap * scale,
        marginBottom: 4 * scale,
        paddingBottom: t.headingRule ? 2 : 0,
        borderBottomWidth: t.headingRule ? 0.8 : 0,
        borderBottomColor: accent,
      }}
    >
      <Text style={{ fontFamily: bold, fontSize: t.headingSize, color: accent, letterSpacing: t.headingUpper ? 0.4 : 0 }}>
        {s(t.headingUpper ? title.toUpperCase() : title)}
      </Text>
    </View>
  );

  /** Title row, sub-line and technology line of an entry. */
  const entryHeader = (e: EntryBlock) => (
    <View style={{ marginTop: t.entryGap * scale }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ ...body, flex: 1 }}>
          <Text style={{ fontFamily: bold, fontSize: t.base + 0.5 }}>{s(e.title)}</Text>
          {e.org ? <Text style={{ color: GRAY }}>{s(` \u2014 ${e.org}`)}</Text> : null}
          {e.links.map((l, i) => (
            <Text key={i} style={{ color: GRAY }}>
              {'  |  '}
              <Link src={l.url} style={{ color: GRAY }}>
                {s(l.text)}
              </Link>
            </Text>
          ))}
        </Text>
        {e.right ? (
          <Text style={{ fontFamily: italic, fontSize: small, color: GRAY, marginLeft: 10, flexShrink: 0 }}>{s(e.right)}</Text>
        ) : null}
      </View>
      {e.sub ? <Text style={{ ...body, fontSize: small, color: GRAY, marginTop: 1 }}>{s(e.sub)}</Text> : null}
      {e.meta ? (
        <Text style={{ ...body, fontSize: small, color: GRAY, marginTop: 1 }}>
          {e.meta.startsWith('Tech Stack: ') ? (
            <>
              <Text style={{ fontFamily: bold }}>Tech Stack: </Text>
              <Text style={{ fontFamily: italic }}>{s(e.meta.slice('Tech Stack: '.length))}</Text>
            </>
          ) : (
            s(e.meta)
          )}
        </Text>
      ) : null}
      {e.description ? <Text style={{ ...body, marginTop: 2 * scale }}>{s(e.description)}</Text> : null}
    </View>
  );

  /** The part of an entry that must never be separated: its header and first bullet. */
  const entryLead = (e: EntryBlock) => (
    <>
      {entryHeader(e)}
      {e.bullets.length > 0 ? bullet(0, s(e.bullets[0])) : null}
    </>
  );
  const entryRest = (e: EntryBlock) => e.bullets.slice(1).map((b, i) => bullet(i + 1, s(b)));

  const lineBullet = (l: { text: string; url?: string }, i: number) =>
    bullet(
      i,
      l.url ? (
        <Link src={l.url} style={{ color: '#000000', textDecoration: 'none' }}>
          {s(l.text)}
        </Link>
      ) : (
        s(l.text)
      ),
    );

  const skillGroup = (g: { category: string; items: string[] }, i: number) => (
    <Text key={i} style={{ ...body, marginTop: 2 * scale }}>
      <Text style={{ fontFamily: bold }}>{s(`${g.category}:  `)}</Text>
      {s(g.items.join(', '))}
    </Text>
  );

  // The heading is always kept together with the first piece of content that follows it.
  const section = (sec: SectionDoc) => {
    const entries = sec.entries ?? [];
    const groups = sec.skillGroups ?? [];
    const lines = sec.lines ?? [];
    return (
      <View key={sec.key}>
        <View wrap={false}>
          {heading(sec.title)}
          {sec.text ? <Text style={body}>{s(sec.text)}</Text> : null}
          {groups.length > 0 ? skillGroup(groups[0], 0) : null}
          {entries.length > 0 ? <View key="lead">{entryLead(entries[0])}</View> : null}
          {lines.length > 0 ? lineBullet(lines[0], 0) : null}
        </View>
        {groups.slice(1).map((g, i) => skillGroup(g, i + 1))}
        {entries.length > 0 ? entryRest(entries[0]) : null}
        {entries.slice(1).map((e, i) => (
          <View key={i + 1}>
            <View wrap={false}>{entryLead(e)}</View>
            {entryRest(e)}
          </View>
        ))}
        {lines.slice(1).map((l, i) => lineBullet(l, i + 1))}
      </View>
    );
  };

  const vertical = t.margin * 0.8;
  return (
    <Document title={s(doc.title)} author={s(doc.name)} creator="Resume Vault" producer="Resume Vault">
      <Page
        size={doc.settings.pageSize}
        style={{ ...body, paddingTop: vertical, paddingBottom: vertical, paddingLeft: t.margin, paddingRight: t.margin }}
      >
        <View style={{ alignItems: t.headerAlign === 'center' ? 'center' : 'flex-start', marginBottom: 2 }}>
          <Text style={{ fontFamily: bold, fontSize: t.nameSize, lineHeight: 1.2, color: accent, textAlign: t.headerAlign }}>{s(doc.name)}</Text>
          {doc.headline ? <Text style={{ ...body, color: GRAY, marginTop: 1, textAlign: t.headerAlign }}>{s(doc.headline)}</Text> : null}
          {doc.contact.length > 0 ? contact(doc.contact) : null}
        </View>
        {doc.sections.map((sec) => section(sec))}
      </Page>
    </Document>
  );
}
