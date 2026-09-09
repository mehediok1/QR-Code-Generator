const { Actor } = require('apify');
const { CheerioCrawler } = require('crawlee');

Actor.main(async () => {
    const input = await Actor.getInput();

    const {
        startUrls = [
            {
                url: 'https://zoneoftools.com/tools/qr-code-generator'
            }
        ],
        maxCrawlPages = 1,
        includeImages = true,
        includeLinks = true
    } = input;

    if (!startUrls.length) {
        throw new Error('Please provide at least one URL.');
    }

    const crawler = new CheerioCrawler({
        maxRequestsPerCrawl: maxCrawlPages,

        async requestHandler({ request, $, log }) {
            log.info(`Crawling: ${request.url}`);

            const finalUrl = request.loadedUrl || request.url;

            // Page Title
            const title = $('title')
                .first()
                .text()
                .trim();

            // Meta Description
            const metaDescription =
                $('meta[name="description"]')
                    .attr('content')
                    ?.trim() || '';

            // Canonical URL
            const canonicalUrl =
                $('link[rel="canonical"]')
                    .attr('href')
                    ?.trim() || '';

            // Language
            const language =
                $('html')
                    .attr('lang')
                    ?.trim() || '';

            // H1
            const h1 = $('h1')
                .first()
                .text()
                .replace(/\s+/g, ' ')
                .trim();

            // All Headings
            const headings = [];

            $('h1, h2, h3, h4, h5, h6').each(
                (index, element) => {
                    const tag =
                        $(element)
                            .prop('tagName')
                            ?.toLowerCase() || '';

                    const text = $(element)
                        .text()
                        .replace(/\s+/g, ' ')
                        .trim();

                    if (text) {
                        headings.push({
                            level: tag,
                            text
                        });
                    }
                }
            );

            // Clone body for clean content extraction
            const contentRoot = $('body').clone();

            // Remove unnecessary elements
            contentRoot.find(
                'script, style, noscript, iframe, svg, canvas, nav, footer, header, form'
            ).remove();

            // Extract page content
            const content = contentRoot
                .text()
                .replace(/\s+/g, ' ')
                .trim();

            // Word count
            const wordCount = content
                ? content
                      .split(/\s+/)
                      .filter(Boolean)
                      .length
                : 0;

            // Images
            const images = [];

            if (includeImages) {
                $('img').each(
                    (index, element) => {
                        const src =
                            $(element).attr('src');

                        const alt =
                            $(element).attr('alt') || '';

                        if (src) {
                            try {
                                const absoluteUrl =
                                    new URL(
                                        src,
                                        finalUrl
                                    ).href;

                                images.push({
                                    url: absoluteUrl,
                                    alt: alt.trim()
                                });
                            } catch {
                                // Ignore invalid image URLs
                            }
                        }
                    }
                );
            }

            // Internal and External Links
            const internalLinks = [];
            const externalLinks = [];

            if (includeLinks) {
                let baseHostname = '';

                try {
                    baseHostname =
                        new URL(finalUrl).hostname;
                } catch {
                    baseHostname = '';
                }

                $('a[href]').each(
                    (index, element) => {
                        const href =
                            $(element).attr('href');

                        if (!href) return;

                        try {
                            const absoluteUrl =
                                new URL(
                                    href,
                                    finalUrl
                                ).href;

                            const linkHostname =
                                new URL(
                                    absoluteUrl
                                ).hostname;

                            if (
                                linkHostname ===
                                baseHostname
                            ) {
                                internalLinks.push(
                                    absoluteUrl
                                );
                            } else {
                                externalLinks.push(
                                    absoluteUrl
                                );
                            }
                        } catch {
                            // Ignore invalid URLs
                        }
                    }
                );
            }

            // Remove duplicate links
            const uniqueInternalLinks = [
                ...new Set(internalLinks)
            ];

            const uniqueExternalLinks = [
                ...new Set(externalLinks)
            ];

            // Remove duplicate images
            const uniqueImages = Array.from(
                new Map(
                    images.map((image) => [
                        image.url,
                        image
                    ])
                ).values()
            );

            // Final dataset result
            const result = {
                url: finalUrl,
                title,
                metaDescription,
                canonicalUrl,
                h1,
                headings,
                content,
                wordCount,
                images: uniqueImages,
                internalLinks: uniqueInternalLinks,
                externalLinks: uniqueExternalLinks,
                language,
                scrapedAt:
                    new Date().toISOString()
            };

            // Push data to Apify Dataset
            await Actor.pushData(result);

            log.info(
                `Successfully extracted ${wordCount} words from ${finalUrl}`
            );
        },

        async failedRequestHandler({
            request,
            log
        }) {
            log.error(
                `Request failed: ${request.url}`
            );
        }
    });

    // Add URLs to crawler
    await crawler.addRequests(
        startUrls.map((item) => ({
            url: item.url
        }))
    );

    // Start crawler
    await crawler.run();

    console.log(
        'QR Code Generator Content Scraper finished successfully.'
    );
});
