// ==UserScript==
// @name         Page Style Extractor
// @namespace    https://github.com/kstrikis/MCPMonkey
// @version      0.4
// @description  Extract complete styling information from a webpage for AI-based cloning
// @author       MCPMonkey
// @match        *://*/*
// @grant        unsafeWindow
// @grant        GM_info
// @grant        GM_xmlhttpRequest
// @noframes
// ==/UserScript==

(function() {
    'use strict';

    // Initialize data object at the top level
    let data = null; // We'll initialize this when processing starts

    // Log environment info
    console.log('Userscript environment:', {
        scriptHandler: GM_info.scriptHandler,
        version: GM_info.version,
        injectInto: GM_info.injectInto,
        script: {
            name: GM_info.script.name,
            namespace: GM_info.script.namespace,
            description: GM_info.script.description,
            version: GM_info.script.version,
            grant: GM_info.script.grant
        }
    });

    // Message types for communication
    const MESSAGE_TYPES = {
        STYLE_REQUEST: 'MM_ext:styleRequest',
        STYLE_RESPONSE: 'MM_us:styleResponse'
    };
    // Configuration limits - **DEFINE HERE**
    const LIMITS = {
        MAX_ELEMENTS: 500,
        MAX_RULES_PER_SELECTOR: 20,
        MAX_MEDIA_QUERIES: 20,
        MAX_PSEUDO_ELEMENTS: 10,
        MAX_ANIMATIONS: 5,
        MAX_SELECTOR_SPECIFICITY: 2
    };

    // Track processed message IDs to prevent loops
    const processedMessages = new Set();

    /**
     * Generate a UUID v4
     * @returns {string} A random UUID
     */
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Process an external stylesheet using GM_xmlhttpRequest to bypass CORS
     * @returns {Promise} Promise that resolves when stylesheet is processed
     */
    function processExternalStylesheet(href, allStyles) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: href,
                onload: function(response) {
                    try {
                        // Create a style element to parse the CSS
                        const style = document.createElement('style');
                        style.textContent = response.responseText;
                        document.head.appendChild(style);

                        // Process the rules
                        const sheet = style.sheet;
                        // Pass allStyles (which is data.styles)
                        processStylesheetRules(sheet, allStyles);

                        // Remove the temporary style element
                        document.head.removeChild(style);
                        resolve();
                    } catch (e) {
                        console.warn('Error processing external stylesheet:', href, e);
                        // Instead of resolving, add to errors
                        allStyles.errors.push({
                            type: 'external_stylesheet_fetch',
                            message: e.message,
                            url: href
                        });
                        resolve(); // Resolve to continue processing other stylesheets
                    }
                },
                onerror: function(error) {
                    console.warn('Failed to fetch external stylesheet:', href, error);
                    // Add to errors
                    allStyles.errors.push({
                        type: 'external_stylesheet_fetch',
                        message: 'Failed to fetch',
                        url: href
                    });
                    resolve(); // Resolve to continue processing other stylesheets
                }
            });
        });
    }

    /**
     * Process all rules in a stylesheet
     */
    async function processStylesheetRules(sheet, allStyles) {
        try {
            // Skip cross-origin stylesheets that we can't access directly
            if (!sheet.cssRules) {
                const href = sheet.href;
                if (href) {
                    // *** IMMEDIATE PROCESSING OF CROSS-ORIGIN STYLESHEETS ***
                    await processExternalStylesheet(href, allStyles); // Use await here
                }
                return;
            }

            const rules = Array.from(sheet.cssRules || []);
            const processedSelectors = new Set();

            rules.forEach(rule => {
                if (rule instanceof CSSStyleRule) {
                    // Skip if we've already processed this selector
                    if (processedSelectors.has(rule.selectorText)) return;
                    
                    // Skip overly complex selectors
                    if (rule.selectorText.split(',').length > 2 || // Max 2 comma-separated selectors
                        rule.selectorText.split(/[\s>+~]/).length > 3) { // Max 3 combinators
                        return;
                    }

                    // Store only if the selector matches any important elements
                    const matchesImportant = Array.from(document.querySelectorAll(rule.selectorText))
                        .some(el => isImportantElement(el));

                    if (matchesImportant) {
                        processedSelectors.add(rule.selectorText);
                        
                        // Clean up the styles
                        const cleanedStyles = {};
                        let ruleCount = 0;
                        
                        for (let i = 0; i < rule.style.length && ruleCount < LIMITS.MAX_RULES_PER_SELECTOR; i++) {
                            const prop = rule.style[i];
                            const value = rule.style.getPropertyValue(prop);
                            
                            // Skip default values
                            if (value === 'initial' || value === 'none' || value === 'auto') continue;
                            
                            // Validate and store
                            if (isValidCSSProperty(prop)) {
                                const validatedValue = isValidCSSValue(prop, value);
                                if (validatedValue !== false) {
                                    cleanedStyles[prop] = validatedValue;
                                    ruleCount++;
                                }
                            }
                        }
                        
                        if (Object.keys(cleanedStyles).length > 0) {
                            allStyles.importantRules[rule.selectorText] = cleanedStyles;
                            data.styles.metadata.stats.rulesProcessed++;
                        }
                    }
                } else if (rule instanceof CSSMediaRule && 
                          rule.conditionText.includes('screen') &&
                          allStyles.mediaQueries.length < LIMITS.MAX_MEDIA_QUERIES) {
                    // Normalize the query
                    const query = rule.conditionText.toLowerCase()
                        .replace(/\s+/g, ' ')
                        .replace(/0px/g, '0')
                        .trim();
                    
                    // Extract rules and add them
                    const mediaRules = [];
                    Array.from(rule.cssRules).forEach(r => {
                        if (r instanceof CSSStyleRule) {
                            // Apply similar filtering as for regular rules
                            const matchesImportant = Array.from(document.querySelectorAll(r.selectorText))
                                .some(el => isImportantElement(el));
                            
                            if (matchesImportant) {
                                const cleanedStyles = {};
                                let ruleCount = 0;
                                
                                for (let i = 0; i < r.style.length && ruleCount < LIMITS.MAX_RULES_PER_SELECTOR; i++) {
                                    const prop = r.style[i];
                                    const value = r.style.getPropertyValue(prop);
                                    
                                    if (isValidCSSProperty(prop)) {
                                        const validatedValue = isValidCSSValue(prop, value);
                                        if (validatedValue !== false) {
                                            cleanedStyles[prop] = validatedValue;
                                            ruleCount++;
                                        }
                                    }
                                }
                                
                                if (Object.keys(cleanedStyles).length > 0) {
                                    mediaRules.push({
                                        selector: r.selectorText,
                                        styles: cleanedStyles
                                    });
                                }
                            }
                        }
                    });
                    
                    // Always call addMediaQueryRule, even if mediaRules is empty
                    addMediaQueryRule(query, mediaRules);
                } else if (rule instanceof CSSKeyframesRule) {
                    // Only store keyframe animations that are actually used
                    const isUsed = document.querySelector(`[style*="animation-name: ${rule.name}"]`) ||
                                 document.querySelector(`[style*="animation: ${rule.name}"]`);
                    
                    if (isUsed) {
                        allStyles.animations[rule.name] = {
                            name: rule.name,
                            keyframes: Array.from(rule.cssRules).map(kf => ({
                                keyText: kf.keyText,
                                style: Object.fromEntries(
                                    Array.from(kf.style).filter(prop => isValidCSSProperty(prop))
                                        .map(prop => [prop, kf.style.getPropertyValue(prop)])
                                )
                            }))
                        };
                    }
                }
            });
        } catch (e) {
            if (!allStyles.errors) allStyles.errors = [];
            allStyles.errors.push({
                type: 'stylesheet_processing',
                message: e.message,
                source: sheet.href || 'inline' // More context in error
            });
        }
    }

    /**
     * Process styles for a single element
     */
    function processElementStyles(element, allStyles) {
        const computedStyle = window.getComputedStyle(element);
        const identifier = getElementIdentifier(element);

        // Store computed styles, filtered
        allStyles.computedStyles[identifier] = {};
        filterAndStoreComputedStyles(element, computedStyle, allStyles.computedStyles[identifier]);

        // Merge inline styles with computed styles
        if (element.style.length) {
            for (let i = 0; i < element.style.length; i++) {
                const prop = element.style[i];
                allStyles.computedStyles[identifier][prop] = element.style[prop]; // Inline styles override computed
            }
        }

        // Process pseudo-elements
        ['::before', '::after'].forEach(pseudo => {
            const pseudoStyle = window.getComputedStyle(element, pseudo);
            if (pseudoStyle.content !== 'none') {
                const pseudoIdentifier = `${identifier}${pseudo}`;
                allStyles.computedStyles[pseudoIdentifier] = {};
                filterAndStoreComputedStyles(element, pseudoStyle, allStyles.computedStyles[pseudoIdentifier]);
            }
        });
    }

    /**
     * Generate a unique identifier for an element
     */
    function getElementIdentifier(element) {
        const id = element.id ? `#${element.id}` : '';
        const classes = element.classList.length ? `.${Array.from(element.classList).join('.')}` : '';
        const nthChild = getNthChild(element);
        return `${element.tagName.toLowerCase()}${id}${classes}${nthChild}`;
    }

    /**
     * Get the nth-child selector for an element
     */
    function getNthChild(element) {
        if (!element.parentElement) return '';
        const children = element.parentElement.children;
        const index = Array.from(children).indexOf(element) + 1;
        return `:nth-child(${index})`;
    }

    /**
     *  Filters and stores computed styles, using a whitelist and improved inheritance checks.
     */
    function filterAndStoreComputedStyles(element, computedStyle, targetObject) {
        const whitelistedProperties = new Set([
            'display', 'position', 'top', 'right', 'bottom', 'left',
            'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
            'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
            'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
            'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
            'border-width', 'border-style', 'border-color',
            'background', 'background-color', 'background-image', 'background-position', 'background-repeat', 'background-size',
            'color',
            'font', 'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant',
            'line-height',
            'text-align', 'text-decoration', 'text-transform',
            'box-shadow',
            'border-radius',
            'overflow', 'overflow-x', 'overflow-y',
            'opacity',
            'z-index',
            'flex', 'flex-direction', 'justify-content', 'align-items', 'flex-grow', 'flex-shrink', 'flex-basis',
            'grid', 'grid-template-columns', 'grid-template-rows', 'grid-template-areas', 'grid-column-gap', 'grid-row-gap',
            'transform',
            'transition',
            'content'
        ]);

        // Create a temporary element to get default styles
        const tempElement = document.createElement(element.tagName);
        document.body.appendChild(tempElement);
        const defaultComputedStyle = window.getComputedStyle(tempElement);

        const backgroundImageUrls = []; // Store URLs here

        for (let i = 0; i < computedStyle.length; i++) {
            const prop = computedStyle[i];

            // Only store whitelisted properties
            if (!whitelistedProperties.has(prop)) continue;

            let value = computedStyle.getPropertyValue(prop);
            const defaultValue = defaultComputedStyle.getPropertyValue(prop);

            // Skip default values *if* they are the same as the default for this element type
            if (value === defaultValue) continue;

            // Improved Inheritance Check (for commonly inherited properties)
            if (element.parentElement) {
                const parentComputedStyle = window.getComputedStyle(element.parentElement);
                const parentValue = parentComputedStyle.getPropertyValue(prop);

              if (value === parentValue) continue;

              // Special handling for font-family (compare the *first* font)
              if (prop === 'font-family') {
                  const parentFonts = parentValue.split(',');
                  const elementFonts = value.split(',');
                  if (elementFonts[0].trim() === parentFonts[0].trim()) continue;
              }
                if (prop === 'font-size'){
                    if (value.endsWith('em') || value.endsWith('rem') || value.endsWith('%')){
                        // Get the parent font size as a number
                        let parentFontSize = parseFloat(parentComputedStyle.fontSize);

                        // Calculate the child font size
                        let childFontSize;
                        if(value.endsWith('em')){
                            childFontSize = parseFloat(value) * parentFontSize;
                        } else if (value.endsWith('rem')){
                            let rootFontSize = parseFloat(window.getComputedStyle(document.documentElement).fontSize);
                            childFontSize = parseFloat(value) * rootFontSize;
                        } else if (value.endsWith('%')){
                            childFontSize = (parseFloat(value)/100) * parentFontSize;
                        }

                        // If they are the same, skip
                        if (childFontSize === parentFontSize) continue;
                    }
                }
            }

            if (prop === 'background-image' && value !== 'none') {
                // Extract URL(s) from the value
                const urls = value.match(/url\(['"]?(.*?)['"]?\)/g);
                if (urls) {
                    urls.forEach(url => {
                        backgroundImageUrls.push(url.slice(4, -1).replace(/['"]/g, ''));
                    });
                }
            }

            targetObject[prop] = value;
        }

        // Add backgroundImageUrls *after* the loop
        if (backgroundImageUrls.length > 0) {
            targetObject.backgroundImageUrls = backgroundImageUrls;
        }

        document.body.removeChild(tempElement); // Clean up
    }

    /**
     * Extract color scheme information
     */
    function extractColorScheme(allStyles) {
        const root = document.documentElement;
        const body = document.body;
        const computedRoot = window.getComputedStyle(root);
        const computedBody = window.getComputedStyle(body);

        allStyles.colorScheme = {
            backgroundColor: computedBody.backgroundColor,
            textColor: computedBody.color,
            linkColor: window.getComputedStyle(document.querySelector('a') || document.createElement('a')).color,
            // Additional color properties
            selection: {
                background: window.getComputedStyle(root).getPropertyValue('--selection-background') || computedRoot.getPropertyValue('background'),
                color: window.getComputedStyle(root).getPropertyValue('--selection-color') || computedRoot.getPropertyValue('color')
            },
            accent: computedRoot.getPropertyValue('accent-color'),
            theme: {
                color: computedRoot.getPropertyValue('color-scheme'),
                background: computedRoot.backgroundColor
            }
        };
    }

    /**
     * Extract typography information
     */
    function extractTypography(allStyles) {
        const root = document.documentElement;
        const body = document.body;
        const computedRoot = window.getComputedStyle(root);
        const computedBody = window.getComputedStyle(body);

        allStyles.typography = {
            base: {
                fontFamily: computedBody.fontFamily,
                fontSize: computedBody.fontSize,
                lineHeight: computedBody.lineHeight,
                fontWeight: computedBody.fontWeight,
                letterSpacing: computedBody.letterSpacing,
                wordSpacing: computedBody.wordSpacing,
                textAlign: computedBody.textAlign,
                textTransform: computedBody.textTransform
            },
            headings: {},
            spacing: {
                paragraph: computedBody.getPropertyValue('margin-bottom'),
                line: computedBody.lineHeight
            }
        };

        // Get heading styles
        ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
            const element = document.createElement(tag);
            document.body.appendChild(element);
            const style = window.getComputedStyle(element);
            allStyles.typography.headings[tag] = {
                fontSize: style.fontSize,
                lineHeight: style.lineHeight,
                fontWeight: style.fontWeight,
                marginTop: style.marginTop,
                marginBottom: style.marginBottom
            };
            document.body.removeChild(element);
        });
    }

    /**
     * Extract layout information
     */
    function extractLayoutInfo(allStyles) {
        const root = document.documentElement;
        const body = document.body;
        const computedRoot = window.getComputedStyle(root);
        const computedBody = window.getComputedStyle(body);

        allStyles.layoutInfo = {
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            root: {
                width: root.scrollWidth,
                height: root.scrollHeight
            },
            body: {
                width: body.scrollWidth,
                height: body.scrollHeight,
                margin: computedBody.margin,
                padding: computedBody.padding
            },
            grid: {
                columns: computedRoot.getPropertyValue('grid-template-columns'),
                rows: computedRoot.getPropertyValue('grid-template-rows'),
                areas: computedRoot.getPropertyValue('grid-template-areas')
            },
            flexbox: {
                used: Array.from(document.querySelectorAll('*')).some(el => 
                    window.getComputedStyle(el).display === 'flex' || 
                    window.getComputedStyle(el).display === 'inline-flex'
                )
            }
        };
    }

    /**
     * Extract custom properties (CSS variables)
     */
    function extractCustomProperties(allStyles) {
        const root = document.documentElement;
        const computedRoot = window.getComputedStyle(root);
        
        allStyles.customProperties = {};
        
        // Get all CSS custom properties
        for (const property of computedRoot) {
            if (property.startsWith('--')) {
                allStyles.customProperties[property] = computedRoot.getPropertyValue(property);
            }
        }
    }

    /**
     * Extract all relevant styling information from the current page
     * @returns {Object} The page style information
     */
    async function getRealPageStyling() {
        try {
            // Initialize fresh data object for this extraction
            data = {
                styles: {
                    computedStyles: {},      // Essential computed styles (non-inherited)
                    pseudoElements: {},      // Pseudo-element styles with actual content
                    animations: {},          // Only used keyframe animations
                    colorScheme: {},         // Color theme information
                    typography: {},          // Typography system
                    mediaQueries: [],        // Deduplicated and normalized media queries
                    importantRules: {},      // Critical and !important rules
                    customProperties: {},    // CSS variables in use
                    layoutInfo: {},          // Layout structure
                    errors: [],              // Error tracking
                    metadata: {              // Metadata section
                        extractedAt: Date.now(),
                        url: window.location.href,
                        viewport: {
                            width: window.innerWidth,
                            height: window.innerHeight
                        },
                        userAgent: navigator.userAgent,
                        stats: {
                            totalElementsScanned: 0,
                            elementsProcessed: 0,
                            rulesProcessed: 0,
                            filteredOut: 0
                        }
                    }
                }
            };

            // Configuration limits
            const LIMITS = {
                MAX_ELEMENTS: 500,
                MAX_RULES_PER_SELECTOR: 20,
                MAX_MEDIA_QUERIES: 20,
                MAX_PSEUDO_ELEMENTS: 10,
                MAX_ANIMATIONS: 5,
                MAX_SELECTOR_SPECIFICITY: 2
            };

            // --- OPTIMIZED ELEMENT SELECTION ---
            const importantTags = ['HEADER', 'FOOTER', 'NAV', 'MAIN', 'ARTICLE', 'SECTION', 'ASIDE', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'IMG', 'A'];
            const importantPatterns = [
                'header', 'footer', 'nav', 'main', 'content',
                'container', 'wrapper', 'layout', 'banner', 'hero',
                'product', 'item', 'card', 'list', 'grid',
                '-root', '-main', '-primary', '-container', '-item'
            ];

            // Combine for a more targeted initial selector
            const initialSelector = importantTags.join(',') + ',' +
                                   importantPatterns.map(p => `[class*="${p}"], [id*="${p}"]`).join(',');

            const allElements = document.querySelectorAll(initialSelector); // More targeted!
            data.styles.metadata.stats.totalElementsScanned = allElements.length;

            // Get viewport dimensions
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;

            // Sort elements by importance (viewport visibility and role)
            const importantElements = Array.from(allElements)
                .filter(el => {
                    // --- VIEWPORT CHECK FIRST ---
                    const rect = el.getBoundingClientRect();
                    const isInViewport = !(rect.bottom < 0 ||
                                         rect.top > viewportHeight ||
                                         rect.right < 0 ||
                                         rect.left > viewportWidth);

                    if (!isInViewport) {
                        data.styles.metadata.stats.filteredOut++;
                        return false;
                    }

                    return isImportantElement(el); // Now called *after* viewport check
                })
                .sort((a, b) => {
                    const aRect = a.getBoundingClientRect();
                    const bRect = b.getBoundingClientRect();
                    
                    // Calculate how much of the element is in the viewport
                    const aVisibleArea = Math.min(aRect.bottom, viewportHeight) - Math.max(aRect.top, 0);
                    const bVisibleArea = Math.min(bRect.bottom, viewportHeight) - Math.max(bRect.top, 0);
                    
                    // Sort by visible area (larger first)
                    return bVisibleArea - aVisibleArea;
                })
                .slice(0, LIMITS.MAX_ELEMENTS);

            // Process stylesheets, focusing only on rules that affect our important elements
            const styleSheets = Array.from(document.styleSheets);
            const processedSelectors = new Set();
            
            // Use Promise.all for concurrent stylesheet processing
            await Promise.all(styleSheets.map(async sheet => { // Use async here
                await processStylesheetRules(sheet, data.styles); // Await processStylesheetRules
            }));

            // Process important elements
            importantElements.forEach(element => {
                try {
                    processElement(element, getElementIdentifier(element));
                    data.styles.metadata.stats.elementsProcessed++;
                } catch (e) {
                    data.styles.errors.push({
                        type: 'element_processing',
                        message: e.message,
                        element: getElementIdentifier(element)
                    });
                }
            });

            // Extract theme information
            extractColorScheme(data.styles);
            extractTypography(data.styles);
            extractLayoutInfo(data.styles);
            extractCustomProperties(data.styles); // Extract custom properties

            // Clean up and optimize
            Object.keys(data.styles).forEach(key => {
                const value = data.styles[key];
                if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
                    delete data.styles[key];
                }
            });

            return data.styles;
        } catch (error) {
            console.error('Fatal error extracting page styles:', error);
            throw error;
        }
    }

    function isValidCSSProperty(property) {
        // Comprehensive whitelist of commonly used and important CSS properties
        const validProperties = [
            // Layout
            "display", "position", "top", "right", "bottom", "left", "float", "clear",
            "width", "height", "min-width", "max-width", "min-height", "max-height",
            "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
            "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
            
            // Box model
            "border", "border-width", "border-style", "border-color",
            "border-top", "border-right", "border-bottom", "border-left",
            "border-radius", "box-shadow", "box-sizing", "outline",
            
            // Typography
            "color", "font-family", "font-size", "font-weight", "font-style",
            "line-height", "letter-spacing", "text-align", "text-decoration",
            "text-transform", "white-space", "word-break", "word-wrap",
            
            // Visual
            "background", "background-color", "background-image",
            "background-position", "background-repeat", "background-size",
            "opacity", "visibility", "z-index", "overflow", "overflow-x", "overflow-y",
            
            // Flexbox
            "flex", "flex-basis", "flex-direction", "flex-flow", "flex-grow",
            "flex-shrink", "flex-wrap", "justify-content", "align-items",
            "align-content", "align-self", "order",
            
            // Grid
            "grid", "grid-template-columns", "grid-template-rows",
            "grid-template-areas", "grid-area", "grid-column", "grid-row",
            "gap", "grid-gap", "grid-column-gap", "grid-row-gap",
            
            // Transforms & Transitions
            "transform", "transform-origin", "transition", "transition-property",
            "transition-duration", "transition-timing-function", "transition-delay",
            
            // Animation
            "animation", "animation-name", "animation-duration",
            "animation-timing-function", "animation-delay", "animation-iteration-count",
            "animation-direction", "animation-fill-mode", "animation-play-state",
            
            // Pseudo-elements
            "content",
            
            // Misc
            "cursor", "pointer-events", "user-select"
        ];
        
        // Remove vendor prefixes and check the standardized property
        const standardProperty = property.replace(/^-(webkit|moz|ms|o)-/, '');
        return validProperties.includes(standardProperty);
    }

    function isValidCSSValue(property, value) {
        if (!value || value === 'initial' || value === 'inherit' || value === 'unset') return true;
        
        // Helper function to check numeric values with units
        const isValidNumericValue = (val) => {
            return typeof val === 'string' && (
                val === 'auto' ||
                val === '0' ||
                /^-?\d*\.?\d+(px|em|rem|%|vh|vw|vmin|vmax|ch|ex|cm|mm|in|pt|pc)$/.test(val) ||
                /^calc\(.+\)$/.test(val)
            );
        };
        
        // Helper function to check color values
        const isValidColor = (val) => {
            return typeof val === 'string' && (
                val === 'transparent' ||
                val === 'currentColor' ||
                /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(val) ||
                /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/.test(val) ||
                /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[0-1]?\.?\d+\s*\)$/.test(val) ||
                /^hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)$/.test(val) ||
                /^hsla\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*,\s*[0-1]?\.?\d+\s*\)$/.test(val)
            );
        };

        // Normalize the property name
        const normalizedProp = property.toLowerCase();
        
        switch (true) {
            // Dimensions and positions
            case /^(width|height|top|right|bottom|left|margin|padding|min-|max-)/i.test(normalizedProp):
                // Allow "none" for max-width and max-height
                if ((normalizedProp === 'max-width' || normalizedProp === 'max-height') && value === 'none') {
                    return true;
                }
                return isValidNumericValue(value);
                
            // Colors
            case /color$|background(-color)?$|border(-color)?$/i.test(normalizedProp):
                if (value === 'none') return 'transparent';
                return isValidColor(value);
                
            // Display
            case normalizedProp === 'display':
                return [
                    'none', 'block', 'inline', 'inline-block', 'flex', 'inline-flex',
                    'grid', 'inline-grid', 'table', 'table-cell', 'contents'
                ].includes(value);
                
            // Position
            case normalizedProp === 'position':
                return ['static', 'relative', 'absolute', 'fixed', 'sticky'].includes(value);
                
            // Font weight
            case normalizedProp === 'font-weight':
                return ['normal', 'bold', 'lighter', 'bolder'].includes(value) ||
                       (Number(value) >= 100 && Number(value) <= 900 && Number(value) % 100 === 0);
                
            // Opacity
            case normalizedProp === 'opacity':
                const num = parseFloat(value);
                return !isNaN(num) && num >= 0 && num <= 1;
                
            // Border style
            case /border(-.*)?-style$/i.test(normalizedProp):
                return ['none', 'hidden', 'solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset'].includes(value);
                
            // Text align
            case normalizedProp === 'text-align':
                // Allow -moz-center
                return ['left', 'right', 'center', 'justify', 'start', '-moz-center'].includes(value);
                
            // Overflow
            case /^overflow(-[xy])?$/i.test(normalizedProp):
                return ['visible', 'hidden', 'scroll', 'auto'].includes(value);
                
            // Visibility
            case normalizedProp === 'visibility':
                return ['visible', 'hidden', 'collapse'].includes(value);
                
            // Z-index
            case normalizedProp === 'z-index':
                return value === 'auto' || !isNaN(parseInt(value, 10));
                
            // Transform
            case normalizedProp === 'transform':
                return value === 'none' || /^(matrix|translate|scale|rotate|skew)/.test(value);
                
            // Flex properties
            case /^flex-/i.test(normalizedProp):
                if (normalizedProp === 'flex-direction') {
                    return ['row', 'row-reverse', 'column', 'column-reverse'].includes(value);
                }
                if (normalizedProp === 'flex-wrap') {
                    return ['nowrap', 'wrap', 'wrap-reverse'].includes(value);
                }
                return true; // Other flex properties have complex validation

            // Default case
            default:
                return true; // Accept unknown properties but log them
        }
    }

    function getComputedStyles(element, pseudo) {
        const computed = window.getComputedStyle(element, pseudo);
        const styles = {};

        for (let i = 0; i < computed.length; i++) {
            const property = computed[i];
            const value = computed.getPropertyValue(property);

            // 1. Whitelist check
            if (!isValidCSSProperty(property)) {
                continue;
            }

            // 2. Value validation
            const validatedValue = isValidCSSValue(property, value);
            if (!validatedValue) {
                console.warn(`Invalid value for ${property}: ${value}`);
                continue; // Skip invalid values
            }
            // Use validated value (which might have been corrected, like "none" -> "transparent")
            const finalValue = typeof validatedValue === "string" ? validatedValue : value;

            // 3. Handle vendor prefixes
            if (property.startsWith("-")) {
                const standardProperty = property.replace(/^-(webkit|moz|ms|o)-/, "");
                if (computed.getPropertyValue(standardProperty)) {
                    // Standard property exists, ignore the prefixed one
                    continue;
                } else {
                    // Add the standard property
                    if(isValidCSSProperty(standardProperty)){
                        styles[standardProperty] = finalValue;
                    }
                    continue;
                }
            }

            styles[property] = finalValue;
        }

        return styles;
    }

    /**
     * Process a single element, extracting and storing its styles if important.
     */
    function processElement(element, selector) {
        if (!isImportantElement(element)) {
            return;
        }

        //This is where the styles are extracted and stored
        extractAndStoreStyles(element, selector);

        // Add a new function to handle interactive states
        processInteractiveStates(element, selector, data.styles); // Pass data.styles
    }

    function extractAndStoreStyles(element, identifier){
        const computedStyle = window.getComputedStyle(element);

        // Store computed styles, filtered
        data.styles.computedStyles[identifier] = {};
        filterAndStoreComputedStyles(element, computedStyle, data.styles.computedStyles[identifier]);

        // Merge inline styles with computed styles
        if (element.style.length) {
            for (let i = 0; i < element.style.length; i++) {
                const prop = element.style[i];
                data.styles.computedStyles[identifier][prop] = element.style[prop]; // Inline styles override computed
            }
        }

        // REMOVE INFERRED STYLES - This was causing the black background
        // Process pseudo-elements
        ['::before', '::after'].forEach(pseudo => {
            const pseudoStyle = window.getComputedStyle(element, pseudo);
            if (pseudoStyle.content !== 'none') {
                const pseudoIdentifier = `${identifier}${pseudo}`;
                data.styles.computedStyles[pseudoIdentifier] = {};
                filterAndStoreComputedStyles(element, pseudoStyle, data.styles.computedStyles[pseudoIdentifier]);
            }
        });
    }

    // Media Query Handling (Deduplication and Optimization)
    function addMediaQueryRule(query, rules) {
        // Normalize media query
        query = query.toLowerCase()
                    .replace(/\s+/g, ' ')
                    .replace(/0px/g, '0')
                    .replace(/\s*:\s*/g, ':')
                    .trim();
        
        // Find existing media query or create new one
        let existingMediaQuery = data.styles.mediaQueries.find(mq => mq.query === query);
        if (existingMediaQuery) {
            // Merge rules, avoiding duplicates
            rules.forEach(newRule => {
                const existingRule = existingMediaQuery.rules.find(r => 
                    r.selector === newRule.selector
                );
                if (existingRule) {
                    // Merge styles
                    Object.assign(existingRule.styles, newRule.styles);
                } else {
                    existingMediaQuery.rules.push(newRule);
                }
            });
        } else {
            data.styles.mediaQueries.push({ query, rules });
        }
    }

    // Helper function to determine if an element is important enough to process
    function isImportantElement(element) {
        // Skip script, style, meta, link, noscript, and iframe tags
        if (['SCRIPT', 'STYLE', 'META', 'LINK', 'NOSCRIPT', 'IFRAME'].includes(element.tagName)) {
            return false;
        }

        const computedStyle = window.getComputedStyle(element);
        if (computedStyle.display === 'none' ||
            computedStyle.visibility === 'hidden' ||
            parseFloat(computedStyle.opacity) < 0.1 ||
            element.offsetParent === null) {
            return false;
        }

        // Check for event listeners *first*
        if (element.hasAttributes() && Array.from(element.attributes).some(attr => attr.name.startsWith('on'))) {
            return true;
        }

        // Check for ARIA roles and other interactive attributes
        if (element.hasAttributes() && Array.from(element.attributes).some(attr => ['role', 'aria-label', 'aria-labelledby', 'aria-describedby', 'tabindex'].includes(attr.name))) {
            return true;
        }

        // Important semantic elements
        const importantTags = ['HEADER', 'FOOTER', 'NAV', 'MAIN', 'ARTICLE', 'SECTION', 'ASIDE', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'IMG', 'A']; // Expanded list
        if (importantTags.includes(element.tagName)) return true;

        // Important class/id patterns
        const importantPatterns = [
            'header', 'footer', 'nav', 'main', 'content',
            'container', 'wrapper', 'layout', 'banner', 'hero',
            'product', 'item', 'card', 'list', 'grid',
            '-root', '-main', '-primary', '-container', '-item' // More comprehensive patterns
        ];

        const elementText = (element.id + ' ' + element.className).toLowerCase();
        if (importantPatterns.some(pattern => elementText.includes(pattern))) {
            return true;
        }

        // Check for significant text content
        if (element.textContent.length > 20) {
            return true;
        }

        return false; // No longer using hasSignificantChildren
    }

    // Helper function to determine if styles are unique/important
    function hasImportantStyles(styles, parentStyles = null, element) {
        const criticalProperties = {
            layout: ['display', 'position', 'flex', 'grid', 'float'],
            sizing: ['width', 'height', 'min-width', 'max-width', 'min-height', 'max-height'],
            spacing: ['margin', 'padding'],
            visual: ['background', 'border', 'box-shadow', 'border-radius'],
            typography: ['font-family', 'font-size', 'font-weight', 'color', 'text-align']
        };

        // Create a temporary element of the *same type*
        const tempElement = document.createElement(element.tagName);
        document.body.appendChild(tempElement);
        const defaultStyles = window.getComputedStyle(tempElement);
        document.body.removeChild(tempElement);

        for (const prop in styles) {
            if (!styles.hasOwnProperty(prop)) continue;

            const value = styles[prop];

            // Check if property is critical - REMOVED the strict check
            // let isImportant = false;
            // for (const category in criticalProperties) {
            //     if (criticalProperties[category].some(pattern => prop.startsWith(pattern))) {
            //         isImportant = true;
            //         break;
            //     }
            // }
            // if (!isImportant) continue; // REMOVED

            // Check against default styles *for this element type*
            if (value === defaultStyles.getPropertyValue(prop)) continue;

            // Check against parent styles (if available)
            if (parentStyles && value === parentStyles[prop]) continue;

            // Special case for font-family (compare first font)
            if (prop === 'font-family' && parentStyles) {
                const parentFonts = parentStyles[prop].split(',');
                const elementFonts = value.split(',');
                if (elementFonts[0].trim() === parentFonts[0].trim()) continue;
            }

            // If we get here, the style is important
            return true;
        }

        return false; // No important styles found
    }

    // Add a new function to handle interactive states
    function processInteractiveStates(element, selector, allStyles) {
        const baseStyles = getComputedStyles(element); // Get base styles

        // Helper function to extract and store changed styles
        function storeChangedStyles(state, newStyles) {
            const diffStyles = {};
            for (const prop in newStyles) {
                if (newStyles.hasOwnProperty(prop) && newStyles[prop] !== baseStyles[prop]) {
                    diffStyles[prop] = newStyles[prop];
                }
            }

            if (Object.keys(diffStyles).length > 0) {
                const stateSelector = `${selector}${state}`;
                allStyles.computedStyles[stateSelector] = diffStyles;
                console.log(`%c    Stored styles for ${stateSelector}:`, 'color: orange;', diffStyles);
            } else if (state === ':hover' && element.tagName === 'A') {
                // *** Fallback for link hover ***
                allStyles.computedStyles[`${selector}:hover`] = { 'text-decoration': 'underline' };
                console.log(`%c    Added fallback :hover style for ${selector}:`, 'color: orange;', { 'text-decoration': 'underline' });
            }
        }

        // --- Simulate :hover ---
        const mouseEnterListener = () => {
            const hoverStyles = getComputedStyles(element);
            storeChangedStyles(':hover', hoverStyles);
            // Clean up listener immediately
            element.removeEventListener('mouseenter', mouseEnterListener);
        };
        element.addEventListener('mouseenter', mouseEnterListener);

        // --- Simulate :focus ---
        const focusListener = () => {
            console.log(`Focus event triggered for: ${selector}`); // DEBUG
            const focusStyles = getComputedStyles(element);
            console.log(`  Focus styles:`, focusStyles); // DEBUG
            storeChangedStyles(':focus', focusStyles);
            // Clean up listener immediately
            element.removeEventListener('focus', focusListener);
            // Also remove tabindex if we added it
            if (element.hasAttribute('data-added-tabindex')) {
                element.removeAttribute('tabindex');
                element.removeAttribute('data-added-tabindex');
            }
        };

        // Make the element focusable if it isn't already
        if (!element.hasAttribute('tabindex')) {
            element.setAttribute('tabindex', '-1');
            element.setAttribute('data-added-tabindex', 'true'); // Mark that we added it
        }
        element.addEventListener('focus', focusListener);
        element.focus(); // Trigger focus immediately


        // --- Simulate :active ---
        const mouseDownListener = () => {
            console.log(`Mousedown event triggered for: ${selector}`); // DEBUG
            const activeStyles = getComputedStyles(element);
            console.log(`  Active styles:`, activeStyles); // DEBUG
            storeChangedStyles(':active', activeStyles);

            const mouseUpListener = () => {
                // Clean up listeners
                element.removeEventListener('mousedown', mouseDownListener);
                element.removeEventListener('mouseup', mouseUpListener);
            }
            element.addEventListener('mouseup', mouseUpListener);
        };
        element.addEventListener('mousedown', mouseDownListener);
    }

    // Helper function to darken a color (RGB only)
    function darkenColor(rgbColor, factor = 0.8) {
        if (!rgbColor.startsWith('rgb')) return rgbColor; // Return original if not RGB

        try {
            let [r, g, b] = rgbColor.substring(rgbColor.indexOf('(') + 1, rgbColor.indexOf(')')).split(',').map(Number);
            r = Math.max(0, Math.floor(r * factor));
            g = Math.max(0, Math.floor(g * factor));
            b = Math.max(0, Math.floor(g * factor));
            return `rgb(${r}, ${g}, ${b})`;
        } catch (error){
            return rgbColor;
        }
    }

    // Listen for messages from extension
    unsafeWindow.addEventListener('message', function(event) {
        // Only accept messages from our own window
        if (event.source !== unsafeWindow) return;
        
        const { type, data, messageId } = event.data;
        // Only handle messages from extension
        if (!type?.startsWith('MM_ext:')) return;
        
        // Skip if we've already processed this message
        if (messageId && processedMessages.has(messageId)) {
            return;
        }
        
        // Mark message as processed if it has an ID
        if (messageId) {
            processedMessages.add(messageId);
            // Cleanup old message IDs after 5 seconds
            setTimeout(() => processedMessages.delete(messageId), 5000);
        }
        
        console.log('Userscript received message:', { type, data, messageId });
        
        if (type === MESSAGE_TYPES.STYLE_REQUEST) {
            console.log('Processing style request');
            getRealPageStyling().then(styleData => {
                console.log('Generated style data:', styleData);
                
                const response = {
                    type: MESSAGE_TYPES.STYLE_RESPONSE,
                    messageId: generateUUID(),
                    data: {
                        styles: styleData,
                        timestamp: Date.now()
                    }
                };
                console.log('Sending response:', response);
                unsafeWindow.postMessage(response, '*');
            }).catch(error => {
                console.error('Error processing style request:', error);
                unsafeWindow.postMessage({
                    type: MESSAGE_TYPES.STYLE_RESPONSE,
                    messageId: generateUUID(),
                    data: {
                        error: error.message,
                        timestamp: Date.now()
                    }
                }, '*');
            });
        }
    });

    console.log('Page Style Extractor initialized...');
})(); 