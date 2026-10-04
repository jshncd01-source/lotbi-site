// In-page navigation only: no policy changes, network requests or storage.
const page = document.querySelector('body.consumer-document main');
if (page) {
  const headings = [...page.querySelectorAll('.section h2, .about-section h2')];
  if (headings.length >= 4) {
    const firstSection = page.querySelector('.section, .about-hero');
    const contents = document.createElement('details');
    contents.className = 'consumer-document-toc';
    const summary = document.createElement('summary');
    summary.textContent = '이 페이지의 내용';
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', '이 페이지의 내용');
    for (const [index, heading] of headings.entries()) {
      if (!heading.id) heading.id = `lotbi-document-section-${index + 1}`;
      const link = document.createElement('a');
      link.href = `#${heading.id}`;
      link.textContent = heading.textContent;
      nav.append(link);
    }
    contents.append(summary, nav);
    const lead = firstSection?.querySelector('.lead-small, .about-core-message');
    if (lead) lead.after(contents);
    else firstSection?.querySelector('h1')?.after(contents);
  }
}
