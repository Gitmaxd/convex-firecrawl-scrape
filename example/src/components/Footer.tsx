function TechLogo({
  href,
  title,
  src,
}: {
  href: string;
  title: string;
  src: string;
}) {
  return (
    <a
      className="techLogo"
      href={href}
      target="_blank"
      rel="noreferrer"
      title={title}
      aria-label={title}
    >
      <img
        className="techLogoImg"
        src={src}
        alt=""
        aria-hidden="true"
        loading="lazy"
      />
    </a>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="footerLink">
      {children}
    </a>
  );
}

export function Footer() {
  return (
    <footer className="footer" aria-label="Project footer">
      <div className="container">
        <div className="footerGrid">
          <div className="footerCol">
            <div className="footerBrand">Convex Firecrawl Scrape</div>
            <div className="footerBrandSub">
              Durable web scraping with caching
            </div>
            <div className="footerTechLabel">Powered by</div>
            <div className="footerTech" aria-label="Technology stack">
              <TechLogo
                href="https://convex.dev"
                title="Convex"
                src="/logos/convex.svg"
              />
              <TechLogo
                href="https://www.firecrawl.dev"
                title="Firecrawl"
                src="/logos/firecrawl.svg"
              />
              <TechLogo
                href="https://react.dev"
                title="React"
                src="/logos/react.svg"
              />
              <TechLogo
                href="https://vitejs.dev"
                title="Vite"
                src="/logos/vite.svg"
              />
              <TechLogo
                href="https://www.typescriptlang.org"
                title="TypeScript"
                src="/logos/typescript.svg"
              />
            </div>
          </div>

          <div className="footerCol">
            <div className="footerColTitle">Resources</div>
            <nav className="footerLinks" aria-label="Resources">
              <FooterLink href="https://github.com/Gitmaxd/convex-firecrawl-scrape#readme">
                README
              </FooterLink>
              <FooterLink href="https://github.com/Gitmaxd/convex-firecrawl-scrape/blob/main/CONTRIBUTING.md">
                Contributing
              </FooterLink>
              <FooterLink href="https://github.com/Gitmaxd/convex-firecrawl-scrape/issues">
                Report an Issue
              </FooterLink>
            </nav>
            <div className="footerColTitle" style={{ marginTop: 16 }}>
              Security
            </div>
            <div className="footerSecurityNote">
              Report vulnerabilities via{" "}
              <a
                href="https://github.com/Gitmaxd/convex-firecrawl-scrape/security/advisories"
                target="_blank"
                rel="noreferrer"
              >
                GitHub Security Advisories
              </a>
            </div>
          </div>

          <div className="footerCol">
            <div className="footerColTitle">Connect</div>
            <nav className="footerLinks" aria-label="Connect">
              <FooterLink href="https://github.com/gitmaxd/convex-firecrawl-scrape">
                GitHub
              </FooterLink>
              <FooterLink href="https://x.com/GitMaxd">X (@GitMaxd)</FooterLink>
            </nav>
          </div>
        </div>

        <div className="footerBottom">
          <span>© {new Date().getFullYear()} GitMaxd</span>
          <span className="footerDot">·</span>
          <a
            href="https://github.com/Gitmaxd/convex-firecrawl-scrape/blob/main/LICENSE"
            target="_blank"
            rel="noreferrer"
          >
            Apache-2.0 License
          </a>
        </div>
      </div>
    </footer>
  );
}
