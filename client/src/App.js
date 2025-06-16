import { useEffect, useState } from 'react';
import axios from 'axios';
import './App.css'; // Add spinner styles here

function App() {
    const [news, setNews] = useState([]);
    const [url, setUrl] = useState(''); // Start with empty URL
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [searchKeyword, setSearchKeyword] = useState('');
    const [sortBy, setSortBy] = useState('default');
    const [filterSource, setFilterSource] = useState('All');

    // Popular news sites for quick selection
    const popularSites = [
        { name: 'All Default Sites', url: '' },
        { name: 'BBC News', url: 'https://www.bbc.com/news' },
        { name: 'The Verge', url: 'https://www.theverge.com' },
        { name: 'CNN', url: 'https://edition.cnn.com' },
        { name: 'TechCrunch', url: 'https://techcrunch.com' },
        { name: 'Reddit News', url: 'https://www.reddit.com/r/news' },
        { name: 'Hacker News', url: 'https://news.ycombinator.com' }
    ];

    const fetchNews = async (scrapeUrl, keyword = '', sortOrder = 'default') => {
        setLoading(true);
        setError('');
        
        try {
            console.log('Fetching news from:', scrapeUrl || 'default sites');
            
            const res = await axios.get('http://localhost:5000/api/news', {
                params: {
                    url: scrapeUrl || '', // Send empty string for default sites
                    keyword: keyword,
                    sortBy: sortOrder
                },
                timeout: 30000 // 30 second timeout for scraping
            });
            
            if (res.data && Array.isArray(res.data)) {
                setNews(res.data);
                setFilterSource('All'); // reset source filter
                
                if (res.data.length === 0) {
                    setError('No articles found. The website might not be supported or may be blocking scraping requests.');
                }
            } else {
                setError('Unexpected response format from server.');
                setNews([]);
            }
            
        } catch (err) {
            console.error('Fetch error:', err);
            
            if (err.code === 'ECONNABORTED') {
                setError('Request timeout. The website took too long to respond.');
            } else if (err.response && err.response.status === 500) {
                setError('Server error. The website might be blocking requests or have an unusual structure.');
            } else {
                setError(`Failed to fetch news: ${err.message}. Please check the URL or try again.`);
            }
            setNews([]);
        }
        
        setLoading(false);
    };

    // Load default sites on initial mount
    useEffect(() => {
        fetchNews('', searchKeyword, sortBy);
    }, []);

    // Validation function for URLs
    const isValidUrl = (string) => {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    };

    // --- Derived data & Handlers ---
    const uniqueSources = [...new Set(news.map(item => item.source))];

    const filteredBySourceNews = news.filter(item => {
        return filterSource === 'All' || item.source === filterSource;
    });

    const handleScrapeSubmit = (e) => {
        e.preventDefault();
        
        if (url && !isValidUrl(url)) {
            setError('Please enter a valid URL (including http:// or https://)');
            return;
        }
        
        fetchNews(url, searchKeyword, sortBy);
    };

    const handleQuickSiteSelect = (siteUrl) => {
        setUrl(siteUrl);
        setError(''); // Clear any previous errors
        fetchNews(siteUrl, searchKeyword, sortBy);
    };

    const handleSearchKeywordChange = (e) => {
        setSearchKeyword(e.target.value);
    };

    const handleSortByChange = (e) => {
        setSortBy(e.target.value);
        fetchNews(url, searchKeyword, e.target.value);
    };

    const handleFilterSourceChange = (e) => {
        setFilterSource(e.target.value);
    };

    const handleClearAll = () => {
        setUrl('');
        setSearchKeyword('');
        setSortBy('default');
        setFilterSource('All');
        setError('');
        setNews([]);
    };

    return (
        <div className="App" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>📰 Dynamic News Scraper</h1>

            {/* Quick Site Selection */}
            <div style={{ marginBottom: '1rem' }}>
                <h3>Quick Select:</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                    {popularSites.map((site, index) => (
                        <button
                            key={index}
                            onClick={() => handleQuickSiteSelect(site.url)}
                            style={{
                                padding: '0.5rem 1rem',
                                border: '1px solid #ddd',
                                borderRadius: '5px',
                                backgroundColor: url === site.url ? '#007bff' : '#f8f9fa',
                                color: url === site.url ? 'white' : '#333',
                                cursor: 'pointer',
                                fontSize: '0.9rem'
                            }}
                            disabled={loading}
                        >
                            {site.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Custom URL input */}
            <form onSubmit={handleScrapeSubmit} style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                        type="url"
                        placeholder="Enter any news website URL (e.g. https://example.com)"
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                        style={{ 
                            flex: '1', 
                            minWidth: '300px',
                            padding: '0.75rem', 
                            fontSize: '1rem',
                            border: '1px solid #ddd',
                            borderRadius: '5px'
                        }}
                    />
                    <button 
                        type="submit" 
                        style={{ 
                            padding: '0.75rem 1.5rem',
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontSize: '1rem'
                        }}
                        disabled={loading}
                    >
                        {loading ? 'Scraping...' : 'Scrape'}
                    </button>
                    <button 
                        type="button"
                        onClick={handleClearAll}
                        style={{ 
                            padding: '0.75rem 1rem',
                            backgroundColor: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer'
                        }}
                        disabled={loading}
                    >
                        Clear
                    </button>
                </div>
            </form>

            {/* Loading spinner */}
            {loading && (
                <div style={{ 
                    textAlign: 'center', 
                    padding: '2rem',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '5px',
                    marginBottom: '1rem'
                }}>
                    <div className="spinner" style={{
                        border: '4px solid #f3f3f3',
                        borderTop: '4px solid #3498db',
                        borderRadius: '50%',
                        width: '40px',
                        height: '40px',
                        animation: 'spin 2s linear infinite',
                        margin: '0 auto 1rem'
                    }}></div>
                    <p>Scraping news from {url || 'default sites'}... This may take a moment.</p>
                </div>
            )}

            {/* Error message */}
            {error && (
                <div style={{ 
                    color: '#dc3545', 
                    backgroundColor: '#f8d7da',
                    border: '1px solid #f5c6cb',
                    borderRadius: '5px',
                    padding: '1rem',
                    marginBottom: '1rem'
                }}>
                    <strong>Error:</strong> {error}
                </div>
            )}

            {/* Controls */}
            {!loading && news.length > 0 && (
                <div style={{ 
                    marginBottom: '2rem', 
                    padding: '1rem',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '5px',
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '1rem', 
                    alignItems: 'center' 
                }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong>Keyword Search:</strong>
                        <input
                            type="text"
                            placeholder="e.g. technology, politics"
                            value={searchKeyword}
                            onChange={handleSearchKeywordChange}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    handleScrapeSubmit(e);
                                }
                            }}
                            style={{ 
                                padding: '0.5rem', 
                                fontSize: '1rem',
                                border: '1px solid #ddd',
                                borderRadius: '3px'
                            }}
                        />
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong>Sort By:</strong>
                        <select 
                            value={sortBy} 
                            onChange={handleSortByChange}
                            style={{ 
                                padding: '0.5rem',
                                fontSize: '1rem',
                                border: '1px solid #ddd',
                                borderRadius: '3px'
                            }}
                        >
                            <option value="default">Default</option>
                            <option value="date">Newest First</option>
                            <option value="relevance">Relevance</option>
                        </select>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong>Filter by Source:</strong>
                        <select 
                            value={filterSource} 
                            onChange={handleFilterSourceChange}
                            style={{ 
                                padding: '0.5rem',
                                fontSize: '1rem',
                                border: '1px solid #ddd',
                                borderRadius: '3px'
                            }}
                        >
                            <option value="All">All ({news.length})</option>
                            {uniqueSources.map((source, i) => (
                                <option key={i} value={source}>
                                    {source} ({news.filter(item => item.source === source).length})
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            )}

            {/* Results summary */}
            {!loading && news.length > 0 && (
                <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
                    <p style={{ 
                        fontSize: '1.1rem',
                        color: '#28a745',
                        fontWeight: 'bold'
                    }}>
                        Found {filteredBySourceNews.length} articles
                        {searchKeyword && ` matching "${searchKeyword}"`}
                        {url && ` from ${new URL(url).hostname}`}
                    </p>
                </div>
            )}

            {/* News List */}
            <div className="news-list">
                {!loading && filteredBySourceNews.length === 0 && news.length === 0 && !error && (
                    <div style={{ 
                        textAlign: 'center', 
                        padding: '3rem',
                        color: '#6c757d'
                    }}>
                        <h3>Welcome to Dynamic News Scraper!</h3>
                        <p>Select a quick site above or enter any news website URL to get started.</p>
                    </div>
                )}

                {!loading && filteredBySourceNews.length === 0 && news.length > 0 && (
                    <p style={{ textAlign: 'center', color: '#6c757d', fontSize: '1.1rem' }}>
                        No articles match your current filters.
                    </p>
                )}

                {filteredBySourceNews.map((item, i) => (
                    <div key={i} className="news-card" style={{
                        border: '1px solid #ddd',
                        borderRadius: '10px',
                        padding: '1.5rem',
                        marginBottom: '1rem',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        backgroundColor: 'white',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                    }}
                    >
                        <h2 style={{ 
                            marginBottom: '1rem',
                            fontSize: '1.3rem',
                            lineHeight: '1.4'
                        }}>
                            <a 
                                href={item.link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{
                                    color: '#007bff',
                                    textDecoration: 'none',
                                    borderBottom: '1px solid transparent',
                                    transition: 'border-bottom-color 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.target.style.borderBottomColor = '#007bff';
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.borderBottomColor = 'transparent';
                                }}
                            >
                                {item.title}
                            </a>
                        </h2>
                        
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                            gap: '0.5rem',
                            color: '#6c757d',
                            fontSize: '0.9rem'
                        }}>
                            <p><strong>Author:</strong> {item.author}</p>
                            <p><strong>Date:</strong> {item.publicationDate}</p>
                            <p><strong>Source:</strong> 
                                <span style={{
                                    backgroundColor: '#e9ecef',
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '15px',
                                    marginLeft: '0.5rem',
                                    fontSize: '0.8rem'
                                }}>
                                    {item.source}
                                </span>
                            </p>
                        </div>
                        
                        {item.error && (
                            <div style={{
                                marginTop: '0.5rem',
                                padding: '0.5rem',
                                backgroundColor: '#fff3cd',
                                border: '1px solid #ffeaa7',
                                borderRadius: '3px',
                                fontSize: '0.8rem',
                                color: '#856404'
                            }}>
                                Note: Limited data available - {item.error}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Footer */}
            <footer style={{ 
                marginTop: '3rem', 
                textAlign: 'center', 
                color: '#6c757d',
                borderTop: '1px solid #dee2e6',
                paddingTop: '2rem'
            }}>
                <p>
                    <strong>Tips:</strong> try to understand your code challenge
                </p>
                <p style={{ fontSize: '0.9rem', marginTop: '1rem' }}>
                    IMPOSSIBLE!
                </p>
            </footer>
        </div>
    );
}

export default App;