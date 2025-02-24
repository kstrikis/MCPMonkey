// ==UserScript==
// @name         Page Style Extractor
// @namespace    https://github.com/kstrikis/MCPMonkey
// @version      0.3
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
    function processExternalStylesheet(href, allStyles, sheetIndex) {
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
                        processStylesheetRules(sheet, allStyles);
                        
                        // Remove the temporary style element
                        document.head.removeChild(style);
                        resolve();
                    } catch (e) {
                        console.warn('Error processing external stylesheet:', href, e);
                        resolve(); // Resolve anyway to continue processing
                    }
                },
                onerror: function(error) {
                    console.warn('Failed to fetch external stylesheet:', href, error);
                    resolve(); // Resolve anyway to continue processing
                }
            });
        });
    }

    /**
     * Process all rules in a stylesheet
     */
    function processStylesheetRules(sheet, allStyles) {
        try {
            const rules = Array.from(sheet.cssRules || []);
            rules.forEach(rule => {
                if (rule instanceof CSSStyleRule) {
                    // Store *only* global styles that have !important
                    if (rule.style.cssText.includes('!important')) {
                        allStyles.importantRules[rule.selectorText] = rule.cssText;
                    }
                } else if (rule instanceof CSSMediaRule) {
                    allStyles.mediaQueries.push({
                        query: rule.conditionText,
                        rules: Array.from(rule.cssRules).map(r => r.cssText)
                    });
                } else if (rule instanceof CSSKeyframesRule) {
                    allStyles.animations[rule.name] = {
                        name: rule.name,
                        keyframes: Array.from(rule.cssRules).map(kf => ({
                            keyText: kf.keyText,
                            style: kf.style.cssText
                        }))
                    };
                }
            });
        } catch (e) {
            console.warn('Error processing stylesheet rules:', e);
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


            targetObject[prop] = value;
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
            const allStyles = {
                computedStyles: {},      // Focus on computed styles
                pseudoElements: {},       // Still useful
                animations: {},           // Keep, but could be simplified
                colorScheme: {},          // Keep
                typography: {},           // Keep
                mediaQueries: [],         // Keep
                importantRules: {},       // Keep !important rules from global styles
                customProperties: {},     // Keep
                layoutInfo: {},           // Keep
                errors: []                // Keep
            };

            // Get all stylesheets, including external ones
            const styleSheets = Array.from(document.styleSheets);
            
            // Process stylesheets in parallel
            const externalSheetPromises = [];
            
            // Process each stylesheet
            styleSheets.forEach((sheet, sheetIndex) => {
                try {
                    // For external stylesheets that might be CORS-restricted
                    if (sheet.href) {
                        // Queue this for separate XHR request to bypass CORS
                        externalSheetPromises.push(processExternalStylesheet(sheet.href, allStyles, sheetIndex));
                    } else {
                        // Try to access rules directly for same-origin stylesheets
                        try {
                            processStylesheetRules(sheet, allStyles);
                        } catch (e) {
                            if (e.name === 'SecurityError') {
                                allStyles.errors.push({
                                    type: 'stylesheet',
                                    message: 'CORS restriction on stylesheet',
                                    href: sheet.href
                                });
                            } else {
                                throw e;
                            }
                        }
                    }
                } catch (e) {
                    allStyles.errors.push({
                        type: 'stylesheet',
                        message: e.message,
                        href: sheet.href
                    });
                }
            });

            // Wait for all external stylesheets to be processed
            await Promise.all(externalSheetPromises);

            // Get all elements and their computed/inline styles
            const allElements = document.querySelectorAll('*');
            allElements.forEach(element => {
                try {
                    processElementStyles(element, allStyles);
                } catch (e) {
                    allStyles.errors.push({
                        type: 'element',
                        message: e.message,
                        element: getElementIdentifier(element)
                    });
                }
            });

            // --- MutationObserver Setup ---
            const observer = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                        const element = mutation.target;
                        const identifier = getElementIdentifier(element);
                        // Re-process styles for this element
                        allStyles.computedStyles[identifier] = {}; // Clear previous styles
                        const computedStyle = window.getComputedStyle(element);
                        filterAndStoreComputedStyles(element, computedStyle, allStyles.computedStyles[identifier]);

                        // Merge inline styles (again, as they might have changed)
                        if (element.style.length) {
                            for (let i = 0; i < element.style.length; i++) {
                                const prop = element.style[i];
                                allStyles.computedStyles[identifier][prop] = element.style[prop];
                            }
                        }
                    }
                });
            });

            // Start observing all changes in the document
            observer.observe(document, {
                attributes: true,
                attributeFilter: ['style'], // Only observe 'style' attribute changes
                subtree: true // Observe all descendants of the document
            });

            try {
                extractColorScheme(allStyles);
            } catch (e) {
                allStyles.errors.push({
                    type: 'colorScheme',
                    message: e.message
                });
            }

            try {
                extractTypography(allStyles);
            } catch (e) {
                allStyles.errors.push({
                    type: 'typography',
                    message: e.message
                });
            }

            try {
                extractLayoutInfo(allStyles);
            } catch (e) {
                allStyles.errors.push({
                    type: 'layout',
                    message: e.message
                });
            }

            try {
                extractCustomProperties(allStyles);
            } catch (e) {
                allStyles.errors.push({
                    type: 'customProperties',
                    message: e.message
                });
            }

            return allStyles;
        } catch (error) {
            console.error('Error extracting page styles:', error);
            throw error;
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