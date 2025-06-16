const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

// 📰 Main function - now handles dynamic URLs
const scrapeNews = async (targetUrl = '', keyword = '', sortBy = 'default') => {
    let allArticles = [];

    if (targetUrl) {
        // If a specific URL is provided, scrape that site
        const dynamicArticles = await scrapeDynamicSite(targetUrl);
        allArticles = [...dynamicArticles];
    } else {
        // If no URL provided, scrape all default sites
        const [bbc, verge, cnn, hacker] = await Promise.all([
            scrapeBBC(),
            scrapeVerge(),
            scrapeCNN(),
            scrapeHackerNews()
        ]);
        allArticles = [...bbc, ...verge, ...cnn, ...hacker];
    }

    // 1. Keyword Filtering (backend)
    if (keyword) {
        const lowerCaseKeyword = keyword.toLowerCase();
        allArticles = allArticles.filter(article =>
            article.title.toLowerCase().includes(lowerCaseKeyword) ||
            article.author.toLowerCase().includes(lowerCaseKeyword) ||
            article.source.toLowerCase().includes(lowerCaseKeyword)
        );
    }

    // 2. Sorting (backend)
    if (sortBy === 'date') {
        allArticles.sort((a, b) => {
            const dateA = new Date(a.publicationDate);
            const dateB = new Date(b.publicationDate);
            // Handle "Unknown" or invalid dates by pushing them to the end
            if (isNaN(dateA.getTime())) return 1;
            if (isNaN(dateB.getTime())) return -1;
            return dateB - dateA;
        });
    } else if (sortBy === 'relevance' && keyword) {
        const lowerCaseKeyword = keyword.toLowerCase();
        allArticles.sort((a, b) => {
            const aHasKeywordInTitle = a.title.toLowerCase().includes(lowerCaseKeyword);
            const bHasKeywordInTitle = b.title.toLowerCase().includes(lowerCaseKeyword);

            if (aHasKeywordInTitle && !bHasKeywordInTitle) return -1;
            if (!aHasKeywordInTitle && bHasKeywordInTitle) return 1;
            return 0;
        });
    }

    return allArticles;
};

// 🌐 Generic Dynamic Site Scraper
const scrapeDynamicSite = async (url) => {
    try {
        console.log(`Scraping: ${url}`);
        const { data: homepage } = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        const $ = cheerio.load(homepage);
        const articles = [];
        const baseUrl = new URL(url).origin;
        const siteName = new URL(url).hostname;

        // Multiple strategies to find article links
        const linkSelectors = [
            'a[href*="/article"]',
            'a[href*="/news"]',
            'a[href*="/story"]',
            'a[href*="/post"]',
            'a[href*="/blog"]',
            'a[href*="202"]', // for date-based URLs
            'article a',
            '.article a',
            '.news a',
            '.post a',
            'h1 a',
            'h2 a',
            'h3 a',
            '.headline a',
            '.title a',
            '[class*="headline"] a',
            '[class*="title"] a',
            '[class*="article"] a',
            '[class*="story"] a'
        ];

        const foundLinks = new Set();
        
        // Try each selector and collect unique links
        linkSelectors.forEach(selector => {
            if (foundLinks.size >= 10) return; // Limit to prevent too many requests
            
            $(selector).each((i, el) => {
                if (foundLinks.size >= 10) return;
                
                const link = $(el).attr('href');
                const text = $(el).text().trim();
                
                if (link && text && text.length > 10) { // Basic quality check
                    let fullUrl;
                    try {
                        if (link.startsWith('http')) {
                            fullUrl = link;
                        } else if (link.startsWith('/')) {
                            fullUrl = baseUrl + link;
                        } else {
                            fullUrl = baseUrl + '/' + link;
                        }
                        
                        // Filter out unwanted links
                        if (!link.includes('#') && 
                            !link.includes('mailto:') && 
                            !link.includes('javascript:') &&
                            !link.includes('/tag/') &&
                            !link.includes('/category/') &&
                            !link.includes('/author/') &&
                            text.length < 200) { // Not too long (probably not a headline)
                            
                            foundLinks.add(JSON.stringify({ url: fullUrl, title: text }));
                        }
                    } catch (e) {
                        // Skip invalid URLs
                    }
                }
            });
        });

        // Convert back to objects and scrape each article
        const linkObjects = Array.from(foundLinks).slice(0, 8).map(str => JSON.parse(str));
        
        for (const linkObj of linkObjects) {
            try {
                const articleData = await scrapeArticleDetails(linkObj.url, linkObj.title, siteName);
                if (articleData) {
                    articles.push(articleData);
                }
            } catch (err) {
                console.error(`Error scraping article: ${linkObj.url}`, err.message);
                // Create a basic article object even if detailed scraping fails
                articles.push({
                    title: linkObj.title,
                    link: linkObj.url,
                    author: 'Unknown',
                    publicationDate: 'Unknown',
                    source: siteName
                });
            }
        }

        return articles;
        
    } catch (error) {
        console.error(`Error scraping ${url}:`, error.message);
        return [{
            title: `Unable to scrape ${url}`,
            link: url,
            author: 'System',
            publicationDate: new Date().toISOString(),
            source: 'Error',
            error: error.message
        }];
    }
};

// Helper function to scrape individual article details
const scrapeArticleDetails = async (articleUrl, fallbackTitle, siteName) => {
    try {
        const { data: articleHtml } = await axios.get(articleUrl, {
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        const $ = cheerio.load(articleHtml);

        // Try to extract article metadata
        const title = $('meta[property="og:title"]').attr('content') ||
                     $('meta[name="twitter:title"]').attr('content') ||
                     $('title').text() ||
                     $('h1').first().text() ||
                     fallbackTitle ||
                     'No title';

        const author = $('meta[name="author"]').attr('content') ||
                      $('meta[property="article:author"]').attr('content') ||
                      $('meta[name="byl"]').attr('content') ||
                      $('.author').first().text() ||
                      $('[class*="author"]').first().text() ||
                      'Unknown';

        const publicationDate = $('meta[property="article:published_time"]').attr('content') ||
                               $('meta[name="publish-date"]').attr('content') ||
                               $('meta[name="date"]').attr('content') ||
                               $('time').first().attr('datetime') ||
                               $('time').first().text() ||
                               $('.date').first().text() ||
                               $('[class*="date"]').first().text() ||
                               'Unknown';

        const source = $('meta[property="og:site_name"]').attr('content') ||
                      siteName ||
                      'Unknown';

        return {
            title: title.trim(),
            link: articleUrl,
            author: author.trim(),
            publicationDate: publicationDate.trim(),
            source: source.trim()
        };
        
    } catch (error) {
        // Return basic info if detailed scraping fails
        return {
            title: fallbackTitle || 'Unable to load article',
            link: articleUrl,
            author: 'Unknown',
            publicationDate: 'Unknown',
            source: siteName || 'Unknown'
        };
    }
};

// 🌐 BBC (keep existing implementation)
const scrapeBBC = async () => {
    const baseUrl = 'https://www.bbc.com/news';
    const { data: homepage } = await axios.get(baseUrl);
    const $ = cheerio.load(homepage);
    const articles = [];

    const articleLinks = [];

    $('a.gs-c-promo-heading').each((i, el) => {
        const link = $(el).attr('href');
        if (link && !link.includes('/live/') && !link.includes('#') && articleLinks.length < 5) {
            const fullUrl = link.startsWith('http') ? link : `https://www.bbc.com${link}`;
            if (!articleLinks.includes(fullUrl)) {
                articleLinks.push(fullUrl);
            }
        }
    });

    for (const link of articleLinks) {
        try {
            const { data: articleHtml } = await axios.get(link);
            const $$ = cheerio.load(articleHtml);

            const title = $$('meta[property="og:title"]').attr('content') || 'No title';
            const author = $$('meta[name="byl"]').attr('content') || 'BBC News';
            const publicationDate = $$('meta[property="article:published_time"]').attr('content') || 'Unknown';
            const source = $$('meta[property="og:site_name"]').attr('content') || 'BBC News';

            articles.push({ title, link, author, publicationDate, source });
        } catch (err) {
            console.error(`BBC error: ${link}`, err.message);
        }
    }

    return articles;
};

// 🌐 The Verge (keep existing implementation)
const scrapeVerge = async () => {
    const baseUrl = 'https://www.theverge.com/';
    const { data: homepage } = await axios.get(baseUrl);
    const $ = cheerio.load(homepage);
    const articles = [];

    const articleLinks = [];

    $('a[data-analytics-link="article"]').each((i, el) => {
        const link = $(el).attr('href');
        if (link && articleLinks.length < 5) {
            const fullUrl = link.startsWith('http') ? link : `https://www.theverge.com${link}`;
            if (!articleLinks.includes(fullUrl)) {
                articleLinks.push(fullUrl);
            }
        }
    });

    for (const link of articleLinks) {
        try {
            const { data: articleHtml } = await axios.get(link);
            const $$ = cheerio.load(articleHtml);

            const title = $$('meta[property="og:title"]').attr('content') || 'No title';
            const author = $$('meta[name="author"]').attr('content') || 'Unknown';
            const publicationDate = $$('meta[property="article:published_time"]').attr('content') || 'Unknown';
            const source = $$('meta[property="og:site_name"]').attr('content') || 'The Verge';

            articles.push({ title, link, author, publicationDate, source });
        } catch (err) {
            console.error(`Verge error: ${link}`, err.message);
        }
    }

    return articles;
};

// 🌐 CNN (keep existing implementation)
const scrapeCNN = async () => {
    const baseUrl = 'https://edition.cnn.com/';
    const { data: homepage } = await axios.get(baseUrl);
    const $ = cheerio.load(homepage);
    const articles = [];

    const articleLinks = [];

    $('a[href^="/202"]').each((i, el) => {
        const link = $(el).attr('href');
        if (link && articleLinks.length < 5) {
            const fullUrl = link.startsWith('http') ? link : `https://edition.cnn.com${link}`;
            if (!articleLinks.includes(fullUrl)) {
                articleLinks.push(fullUrl);
            }
        }
    });

    for (const link of articleLinks) {
        try {
            const { data: articleHtml } = await axios.get(link);
            const $$ = cheerio.load(articleHtml);

            const title = $$('meta[property="og:title"]').attr('content') || 'No title';
            const author = $$('meta[name="author"]').attr('content') || 'CNN';
            const publicationDate = $$('meta[property="article:published_time"]').attr('content') || 'Unknown';
            const source = $$('meta[property="og:site_name"]').attr('content') || 'CNN';

            articles.push({ title, link, author, publicationDate, source });
        } catch (err) {
                console.error(`CNN error: ${link}`, err.message);
        }
    }

    return articles;
};

// 🌐 Hacker News (keep existing implementation)
const scrapeHackerNews = async () => {
    const url = 'https://news.ycombinator.com/';
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const news = [];

    $('.athing').each((i, el) => {
        const title = $(el).find('.titleline a').text();
        const link = $(el).find('.titleline a').attr('href');
        const site = link ? new URL(link, url).hostname : 'Unknown';

        const subtext = $(el).next().find('.subtext');
        const author = subtext.find('.hnuser').text() || 'Unknown';
        const time = subtext.find('.age').text() || 'Unknown';

        news.push({
            title,
            link,
            author,
            publicationDate: time,
            source: site
        });
    });

    return news.slice(0, 5); // Limit to 5 for consistency
};

module.exports = { scrapeNews };